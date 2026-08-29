import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database, Task } from './database';
import { getServiceSupabaseEnv, isDbTestConfigured } from './env';
import { tombstoneTask, upsertTask } from './queries/planning';

const configured = isDbTestConfigured();
const describeWithDatabase = configured ? describe : describe.skip;

type AuthedUser = {
  id: string;
  client: SupabaseClient<Database>;
};

describeWithDatabase('real PostgREST sync protocol', () => {
  const runId = randomUUID();
  const password = `${randomUUID()}Aa1!`;
  const taskIds: string[] = [];
  let service: ReturnType<typeof createServiceClient>;
  let userA: AuthedUser;
  let userB: AuthedUser;

  beforeAll(async () => {
    if (!configured) return;
    service = createServiceClient();
    const { url, anonKey } = getServiceSupabaseEnv();
    userA = await createAuthedUser(
      service,
      url,
      anonKey,
      `sync-rest-a-${runId}@kayamo.test`,
      password,
    );
    userB = await createAuthedUser(
      service,
      url,
      anonKey,
      `sync-rest-b-${runId}@kayamo.test`,
      password,
    );
  });

  afterAll(async () => {
    if (!service) return;
    if (userA) await service.auth.admin.deleteUser(userA.id);
    if (userB) await service.auth.admin.deleteUser(userB.id);
  });

  it('paginates a user feed by server_seq without duplicates, gaps, or cross-user rows', async () => {
    const baseTime = Date.now() - 60_000;
    for (let index = 0; index < 5; index += 1) {
      const id = randomUUID();
      taskIds.push(id);
      const result = await upsertTask(
        userA.client,
        taskWrite({
          id,
          userId: userA.id,
          title: `PostgREST page fixture ${index + 1}`,
          updatedAt: new Date(baseTime + index * 1_000).toISOString(),
        }),
      );
      expect(result.applied).toBe(true);
    }
    const userBId = randomUUID();
    const userBResult = await upsertTask(
      userB.client,
      taskWrite({
        id: userBId,
        userId: userB.id,
        title: 'Cross-user pagination sentinel',
        updatedAt: new Date(baseTime).toISOString(),
      }),
    );
    expect(userBResult.applied).toBe(true);

    const pages: Task[][] = [];
    let checkpoint = 0;
    for (;;) {
      const page = await fetchTaskPage(userA.client, userA.id, checkpoint, 2);
      if (page.length === 0) break;
      pages.push(page);
      checkpoint = page.at(-1)!.server_seq;
      if (page.length < 2) break;
    }

    expect(pages.map((page) => page.map((row) => row.server_seq))).toEqual([
      [1, 2],
      [3, 4],
      [5],
    ]);
    const rows = pages.flat();
    expect(rows.map((row) => row.id)).toEqual(taskIds);
    expect(new Set(rows.map((row) => row.id)).size).toBe(5);
    expect(rows.every((row) => Number.isSafeInteger(row.server_seq))).toBe(true);
    expect(rows.some((row) => row.id === userBId)).toBe(false);

    const asOther = await fetchTaskPage(userB.client, userA.id, 0, 10);
    expect(asOther).toEqual([]);
  });

  it('returns authoritative LWW updates and owner-visible tombstones incrementally', async () => {
    const id = randomUUID();
    const baseTime = Date.now() - 60_000;
    const inserted = await upsertTask(
      userA.client,
      taskWrite({
        id,
        userId: userA.id,
        title: 'LWW v1',
        updatedAt: new Date(baseTime).toISOString(),
      }),
    );
    expect(inserted.applied).toBe(true);
    if (!inserted.applied) throw new Error('Expected initial PostgREST insert');

    const newer = await upsertTask(
      userA.client,
      taskWrite({
        id,
        userId: userA.id,
        title: 'LWW v2 authoritative',
        updatedAt: new Date(baseTime + 20_000).toISOString(),
      }),
    );
    expect(newer.applied).toBe(true);
    if (!newer.applied) throw new Error('Expected newer PostgREST update');
    expect(newer.reason).toBe('updated');
    expect(newer.row.title).toBe('LWW v2 authoritative');
    expect(newer.row.server_seq).toBeGreaterThan(inserted.row.server_seq);

    const stale = await upsertTask(
      userA.client,
      taskWrite({
        id,
        userId: userA.id,
        title: 'LWW stale overwrite',
        updatedAt: new Date(baseTime + 10_000).toISOString(),
      }),
    );
    expect(stale).toMatchObject({
      applied: false,
      reason: 'stale_or_tombstoned',
      row: { title: 'LWW v2 authoritative', server_seq: newer.row.server_seq },
    });

    const beforeTombstone = newer.row.server_seq;
    const deletedAt = new Date(baseTime + 30_000).toISOString();
    await tombstoneTask(userA.client, {
      id,
      userId: userA.id,
      updatedAt: deletedAt,
    });
    const incremental = await fetchTaskPage(userA.client, userA.id, beforeTombstone, 2);
    expect(incremental).toHaveLength(1);
    expect(incremental[0]?.id).toBe(id);
    expect(new Date(incremental[0]!.deleted_at!).toISOString()).toBe(deletedAt);
    expect(incremental[0]!.server_seq).toBeGreaterThan(beforeTombstone);
    expect(await fetchTaskPage(userB.client, userA.id, beforeTombstone, 2)).toEqual([]);

    const resurrection = await upsertTask(
      userA.client,
      taskWrite({
        id,
        userId: userA.id,
        title: 'Must not resurrect',
        updatedAt: new Date(baseTime + 40_000).toISOString(),
      }),
    );
    expect(resurrection).toMatchObject({
      applied: false,
      reason: 'stale_or_tombstoned',
      row: { id },
    });
    expect(new Date(resurrection.row!.deleted_at!).toISOString()).toBe(deletedAt);
  });
});

async function fetchTaskPage(
  client: SupabaseClient<Database>,
  userId: string,
  checkpoint: number,
  limit: number,
): Promise<Task[]> {
  const { data, error } = await client
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .gt('server_seq', String(checkpoint))
    .order('server_seq', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

function taskWrite(params: {
  id: string;
  userId: string;
  title: string;
  updatedAt: string;
}) {
  return {
    id: params.id,
    user_id: params.userId,
    title: params.title,
    notes: null,
    scheduled_for: null,
    due_at: null,
    completed_at: null,
    sort_order: 0,
    origin: 'user' as const,
    updated_at: params.updatedAt,
    deleted_at: null,
  };
}

function createServiceClient() {
  const { url, serviceRoleKey } = getServiceSupabaseEnv();
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function createAuthedUser(
  service: ReturnType<typeof createServiceClient>,
  url: string,
  anonKey: string,
  email: string,
  password: string,
): Promise<AuthedUser> {
  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw created.error ?? new Error('createUser returned no user');
  }
  const client = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.user) {
    throw signedIn.error ?? new Error('signInWithPassword failed');
  }
  return { id: signedIn.data.user.id, client };
}
