import type { DbClient, Food, Task } from '@kayamo/db';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getOfflineDb,
  KayaMoDB,
  resetOfflineDb,
  setOfflineUserScope,
  type SyncQueueItem,
  type SyncableTable,
} from './db';
import { createLocalGoal, listLocalGoals, tombstoneLocalGoal } from './journey';
import { createLocalTask, listLocalTasks, setLocalTaskScheduledFor } from './planning';
import {
  applyPullPage,
  pullRemoteChanges,
  type PullPageFetcher,
  type PullPageRequest,
} from './pull';
import { enqueueUpsert } from './queue';
import { BIDIRECTIONAL_SYNC_REGISTRY, LOCAL_ONLY_TABLES } from './sync-registry';
import { syncUserOnce, type SyncPushHandler } from './sync';

const client = {} as DbClient;
const userA = 'user-a';
const cursor1 = '2026-08-20T01:00:00.000Z';
const cursor2 = '2026-08-20T02:00:00.000Z';
const cursor3 = '2026-08-20T03:00:00.000Z';
const seq1 = 1;
const seq2 = 2;
const seq3 = 3;

function task(
  id: string,
  options: {
    userId?: string;
    title?: string;
    updatedAt?: string;
    serverUpdatedAt?: string;
    serverSeq?: number;
    deletedAt?: string | null;
  } = {},
): Task {
  return {
    id,
    user_id: options.userId ?? userA,
    title: options.title ?? id,
    notes: null,
    scheduled_for: null,
    due_at: null,
    completed_at: null,
    sort_order: 0,
    origin: 'user',
    created_at: cursor1,
    updated_at: options.updatedAt ?? cursor1,
    server_updated_at: options.serverUpdatedAt ?? cursor1,
    server_seq: options.serverSeq ?? seq1,
    deleted_at: options.deletedAt ?? null,
  };
}

function food(id: string, createdBy: string | null): Food {
  return {
    id,
    source: createdBy ? 'user' : 'ph_core',
    source_id: createdBy ? null : id,
    name: id,
    name_tl: [],
    brand: null,
    barcode: null,
    kcal: '100',
    protein_g: '0',
    carbs_g: '0',
    fat_g: '0',
    fiber_g: '0',
    sugar_g: '0',
    sodium_mg: '0',
    confidence: '0.5',
    verified_by_user: false,
    created_by: createdBy,
    shared: false,
    attribution: null,
    source_note: null,
    created_at: cursor1,
    updated_at: cursor1,
    server_updated_at: cursor1,
    deleted_at: null,
  };
}

function compareRequestCursor(
  request: PullPageRequest,
  row: Record<string, unknown>,
): boolean {
  if (!request.cursor) return true;
  return (row.server_seq as number) > request.cursor.serverSeq;
}

function memoryFetcher(rows: unknown[]): PullPageFetcher {
  return async (request) =>
    rows
      .filter(
        (value): value is Record<string, unknown> =>
          typeof value === 'object' && value !== null,
      )
      .filter((row) => row[request.spec.ownerColumn] === request.userId)
      .filter((row) => compareRequestCursor(request, row))
      .sort((left, right) => Number(left.server_seq) - Number(right.server_seq))
      .slice(0, request.limit);
}

describe('bidirectional pull invariants', () => {
  beforeEach(async () => {
    await resetOfflineDb();
    await setOfflineUserScope(userA);
  });
  afterEach(resetOfflineDb);

  it('hydrates an empty device from the first server page', async () => {
    await pullRemoteChanges({
      client,
      userId: userA,
      tables: ['tasks'],
      fetchPage: memoryFetcher([task('task-a')]),
    });
    expect((await getOfflineDb().tasks.get('task-a'))?.title).toBe('task-a');
  });

  it('uses its durable cursor for an incremental pull', async () => {
    const rows = [
      task('task-a'),
      task('task-b', { serverUpdatedAt: cursor2, updatedAt: cursor2, serverSeq: seq2 }),
    ];
    await pullRemoteChanges({
      client,
      userId: userA,
      tables: ['tasks'],
      fetchPage: memoryFetcher(rows.slice(0, 1)),
    });
    const requests: PullPageRequest[] = [];
    await pullRemoteChanges({
      client,
      userId: userA,
      tables: ['tasks'],
      fetchPage: async (request) => {
        requests.push(request);
        return memoryFetcher(rows)(request);
      },
    });
    expect(requests[0]?.cursor).toEqual({ serverSeq: seq1 });
    expect(await getOfflineDb().tasks.get('task-b')).toBeTruthy();
  });

  it('replaces only a legacy timestamp checkpoint and rehydrates from sequence zero', async () => {
    const local = task('task-a', {
      title: 'newer unsynced local edit',
      updatedAt: cursor2,
      serverSeq: seq2,
    });
    await getOfflineDb().tasks.put(local);
    await enqueueUpsert('tasks', local.id, local);
    await getOfflineDb().local_journal_entries.put({
      id: 'local-only',
      user_id: userA,
      kind: 'reflection',
      content: 'never synchronized',
      created_at: cursor1,
      updated_at: cursor1,
    });
    await getOfflineDb().sync_checkpoints.put({
      id: `${userA}:tasks`,
      user_id: userA,
      table: 'tasks',
      server_updated_at: cursor3,
      stable_key: 'legacy-last-key',
      updatedAt: 1,
    });

    const requests: PullPageRequest[] = [];
    await pullRemoteChanges({
      client,
      userId: userA,
      tables: ['tasks'],
      fetchPage: async (request) => {
        requests.push(request);
        return memoryFetcher([task('task-a', { title: 'older server row' })])(request);
      },
    });

    expect(requests[0]?.cursor).toBeNull();
    expect((await getOfflineDb().tasks.get('task-a'))?.title).toBe(
      'newer unsynced local edit',
    );
    expect(await getOfflineDb().sync_queue.count()).toBe(1);
    expect(await getOfflineDb().local_journal_entries.get('local-only')).toBeTruthy();
    expect(await getOfflineDb().sync_checkpoints.get(`${userA}:tasks`)).toMatchObject({
      cursor_version: 2,
      server_seq: 1,
    });
  });

  it('replays a duplicate page idempotently', async () => {
    const row = task('task-a');
    await applyPullPage({ userId: userA, table: 'tasks', rows: [row] });
    await applyPullPage({ userId: userA, table: 'tasks', rows: [row] });
    expect(await getOfflineDb().tasks.count()).toBe(1);
  });

  it('rejects duplicate sequence values within one server page', async () => {
    await expect(
      applyPullPage({
        userId: userA,
        table: 'tasks',
        rows: [task('task-a'), task('task-b')],
      }),
    ).rejects.toThrow('Duplicate or non-advancing tasks server sequence');
    expect(await getOfflineDb().tasks.count()).toBe(0);
    expect(await getOfflineDb().sync_checkpoints.count()).toBe(0);
  });

  it('deduplicates immutable companion events by stable event key', async () => {
    const event = {
      id: 'server-event',
      user_id: userA,
      event_key: 'task:task-a:completed',
      event_type: 'task_completed',
      source_table: 'tasks',
      source_id: 'task-a',
      logical_date: '2026-08-20',
      points: 5,
      created_at: cursor1,
      server_updated_at: cursor1,
      server_seq: seq1,
    };
    await getOfflineDb().companion_events.put({ ...event, id: 'local-event' });
    await applyPullPage({ userId: userA, table: 'companion_events', rows: [event] });
    expect(await getOfflineDb().companion_events.count()).toBe(1);
    expect(await getOfflineDb().companion_events.get('server-event')).toBeTruthy();
  });

  it('applies a newer remote update to a clean local row', async () => {
    await getOfflineDb().tasks.put(task('task-a', { title: 'old' }));
    await applyPullPage({
      userId: userA,
      table: 'tasks',
      rows: [
        task('task-a', {
          title: 'new',
          updatedAt: cursor2,
          serverUpdatedAt: cursor2,
          serverSeq: seq2,
        }),
      ],
    });
    expect((await getOfflineDb().tasks.get('task-a'))?.title).toBe('new');
  });

  it('preserves a newer queued local edit over a stale remote row', async () => {
    const local = task('task-a', { title: 'local-v2', updatedAt: cursor2 });
    await getOfflineDb().tasks.put(local);
    await enqueueUpsert('tasks', local.id, local);
    await applyPullPage({
      userId: userA,
      table: 'tasks',
      rows: [task('task-a', { title: 'server-v1' })],
    });
    expect((await getOfflineDb().tasks.get('task-a'))?.title).toBe('local-v2');
    expect(await getOfflineDb().sync_queue.count()).toBe(1);
  });

  it('ingests a remote tombstone and hides it from normal reads', async () => {
    await getOfflineDb().tasks.put(task('task-a'));
    await applyPullPage({
      userId: userA,
      table: 'tasks',
      rows: [
        task('task-a', {
          updatedAt: cursor2,
          serverUpdatedAt: cursor2,
          serverSeq: seq2,
          deletedAt: cursor2,
        }),
      ],
    });
    expect((await getOfflineDb().tasks.get('task-a'))?.deleted_at).toBe(cursor2);
    expect(await listLocalTasks(userA)).toEqual([]);
  });

  it('never resurrects a tombstone from stale local or remote live state', async () => {
    const local = task('task-a', { title: 'queued live', updatedAt: cursor2 });
    await getOfflineDb().tasks.put(local);
    await enqueueUpsert('tasks', local.id, local);
    await applyPullPage({
      userId: userA,
      table: 'tasks',
      rows: [task('task-a', { updatedAt: cursor1, deletedAt: cursor1 })],
    });
    expect(await getOfflineDb().sync_queue.count()).toBe(0);
    await applyPullPage({
      userId: userA,
      table: 'tasks',
      rows: [
        task('task-a', {
          title: 'stale live',
          updatedAt: cursor3,
          serverUpdatedAt: cursor3,
          serverSeq: seq3,
        }),
      ],
    });
    expect((await getOfflineDb().tasks.get('task-a'))?.deleted_at).toBe(cursor1);
  });

  it('does not skip rows whose diagnostic timestamps are identical', async () => {
    const rows = ['a', 'b', 'c'].map((id, index) => task(id, { serverSeq: index + 1 }));
    await pullRemoteChanges({
      client,
      userId: userA,
      tables: ['tasks'],
      pageSize: 1,
      fetchPage: memoryFetcher(rows),
    });
    expect((await getOfflineDb().tasks.toArray()).map((row) => row.id).sort()).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('paginates a larger stream without semantic duplicates', async () => {
    const rows = Array.from({ length: 7 }, (_, index) =>
      task(`task-${index}`, {
        updatedAt: new Date(Date.parse(cursor1) + index * 1_000).toISOString(),
        serverUpdatedAt: new Date(Date.parse(cursor1) + index * 1_000).toISOString(),
        serverSeq: index + 1,
      }),
    );
    await pullRemoteChanges({
      client,
      userId: userA,
      tables: ['tasks'],
      pageSize: 2,
      fetchPage: memoryFetcher(rows),
    });
    expect(await getOfflineDb().tasks.count()).toBe(7);
  });

  it('rolls back rows when interrupted before checkpoint advancement', async () => {
    await expect(
      applyPullPage(
        { userId: userA, table: 'tasks', rows: [task('task-a')] },
        {
          beforeCheckpoint: () => {
            throw new Error('crash');
          },
        },
      ),
    ).rejects.toThrow('crash');
    expect(await getOfflineDb().tasks.get('task-a')).toBeUndefined();
    expect(await getOfflineDb().sync_checkpoints.count()).toBe(0);
  });

  it('does not advance its cursor for a malformed server row', async () => {
    await expect(
      applyPullPage({
        userId: userA,
        table: 'tasks',
        rows: [{ id: 'bad', user_id: userA, server_updated_at: cursor1 }],
      }),
    ).rejects.toThrow('Invalid server cursor');
    expect(await getOfflineDb().sync_checkpoints.count()).toBe(0);
  });

  it('does not advance its cursor when the network fails before a pull', async () => {
    const result = await pullRemoteChanges({
      client,
      userId: userA,
      tables: ['tasks'],
      fetchPage: async () => {
        throw new TypeError('Failed to fetch');
      },
    });
    expect(result.failedTables).toEqual(['tasks']);
    expect(await getOfflineDb().sync_checkpoints.count()).toBe(0);
    expect(await getOfflineDb().sync_pull_failures.count()).toBe(1);
  });

  it('resumes from the last committed page after a mid-stream network failure', async () => {
    const rows = [
      task('a', { serverSeq: 1 }),
      task('b', { serverSeq: 2 }),
      task('c', { serverSeq: 3 }),
    ];
    let requests = 0;
    let now = 1_000;
    const interrupted = await pullRemoteChanges({
      client,
      userId: userA,
      tables: ['tasks'],
      pageSize: 1,
      now: () => now,
      fetchPage: async (request) => {
        requests += 1;
        if (requests === 2) throw new TypeError('Failed to fetch');
        return memoryFetcher(rows)(request);
      },
    });
    expect(interrupted.failedTables).toEqual(['tasks']);
    expect((await getOfflineDb().tasks.toArray()).map((row) => row.id)).toEqual(['a']);
    now = interrupted.nextRetryAt!;
    await pullRemoteChanges({
      client,
      userId: userA,
      tables: ['tasks'],
      pageSize: 1,
      now: () => now,
      fetchPage: memoryFetcher(rows),
    });
    expect(await getOfflineDb().tasks.count()).toBe(3);
  });

  it('rolls back row application when checkpoint storage fails', async () => {
    const put = vi
      .spyOn(getOfflineDb().sync_checkpoints, 'put')
      .mockRejectedValueOnce(new Error('cursor write failed'));
    await expect(
      applyPullPage({ userId: userA, table: 'tasks', rows: [task('task-a')] }),
    ).rejects.toThrow('cursor write failed');
    put.mockRestore();
    expect(await getOfflineDb().tasks.get('task-a')).toBeUndefined();
  });

  it('isolates account stores and restores each account on switch', async () => {
    await setOfflineUserScope(userA);
    await getOfflineDb().tasks.put(task('private-a'));
    const accountADatabase = getOfflineDb().name;
    await setOfflineUserScope('user-b');
    expect(getOfflineDb().name).not.toBe(accountADatabase);
    expect(await getOfflineDb().tasks.get('private-a')).toBeUndefined();
    await setOfflineUserScope(userA);
    expect((await getOfflineDb().tasks.get('private-a'))?.user_id).toBe(userA);
  });

  it('rejects a cross-owner row before it can enter the local transaction', async () => {
    await expect(
      applyPullPage({
        userId: userA,
        table: 'tasks',
        rows: [task('private-b', { userId: 'user-b' })],
      }),
    ).rejects.toThrow('Owner mismatch');
    expect(await getOfflineDb().tasks.count()).toBe(0);
    expect(await getOfflineDb().sync_checkpoints.count()).toBe(0);
  });

  it("migrates legacy caches without copying another user's private food", async () => {
    const legacy = new KayaMoDB('kayamo');
    await legacy.open();
    await legacy.foods.bulkPut([
      food('canonical', null),
      food('food-a', userA),
      food('food-b', 'user-b'),
    ]);
    legacy.close();
    await setOfflineUserScope(null);
    await setOfflineUserScope(userA);
    expect(await getOfflineDb().foods.get('canonical')).toBeTruthy();
    expect(await getOfflineDb().foods.get('food-a')).toBeTruthy();
    expect(await getOfflineDb().foods.get('food-b')).toBeUndefined();
  });

  it('keeps local-only reflection sentinels outside every sync surface', async () => {
    const sentinel = 'KAYAMO_LOCAL_ONLY_REFLECTION_SYNC_SENTINEL_7712';
    await getOfflineDb().local_journal_entries.put({
      id: 'reflection',
      user_id: userA,
      kind: 'reflection',
      content: sentinel,
      created_at: cursor1,
      updated_at: cursor1,
    });
    expect(LOCAL_ONLY_TABLES).toContain('local_journal_entries');
    expect(BIDIRECTIONAL_SYNC_REGISTRY.map((spec) => spec.table)).not.toContain(
      'local_journal_entries',
    );
    expect(JSON.stringify(await getOfflineDb().sync_queue.toArray())).not.toContain(
      sentinel,
    );
    expect(JSON.stringify(await getOfflineDb().sync_checkpoints.toArray())).not.toContain(
      sentinel,
    );
  });

  it('remains usable from local data when no sync cycle can start', async () => {
    await getOfflineDb().tasks.put(task('offline-task'));
    expect((await listLocalTasks(userA)).map((row) => row.id)).toContain('offline-task');
  });

  it('keeps local data and its queue intact when a push is unauthorized', async () => {
    const local = task('unsent');
    await getOfflineDb().tasks.put(local);
    await enqueueUpsert('tasks', local.id, local);
    await expect(
      syncUserOnce({
        client,
        userId: userA,
        pushItem: async () => {
          throw { status: 401 };
        },
        fetchPage: memoryFetcher([]),
        tables: ['tasks'],
      }),
    ).rejects.toEqual({ status: 401 });
    expect((await getOfflineDb().tasks.get(local.id))?.title).toBe('unsent');
    expect(await getOfflineDb().sync_queue.count()).toBe(1);
  });
});

describe('cross-device bidirectional scenario', () => {
  beforeEach(resetOfflineDb);
  afterEach(resetOfflineDb);

  it('converges Device A to server to Device B and back, including deletion', async () => {
    const server = new Map<SyncableTable, Map<string, Record<string, unknown>>>();
    let serverTick = 0;
    const nextCursor = () => ++serverTick;
    const fetchPage: PullPageFetcher = async (request) => {
      const rows = [...(server.get(request.spec.table)?.values() ?? [])];
      return memoryFetcher(rows)(request);
    };
    const pushItem: SyncPushHandler = async (_client, item: SyncQueueItem) => {
      const table = server.get(item.table) ?? new Map<string, Record<string, unknown>>();
      const existing = table.get(item.entityId);
      const incoming = { ...item.payload };
      if (existing?.deleted_at && !incoming.deleted_at)
        incoming.deleted_at = existing.deleted_at;
      table.set(item.entityId, {
        ...incoming,
        server_updated_at: cursor1,
        server_seq: nextCursor(),
      });
      server.set(item.table, table);
    };
    const cycle = (namespace: string) =>
      syncUserOnce({
        client,
        userId: userA,
        namespace,
        fetchPage,
        pushItem,
        tables: ['tasks', 'goals'],
      });

    await setOfflineUserScope(userA, { namespace: 'device-a' });
    const goal = await createLocalGoal({ userId: userA, title: 'Ship KayaMo' });
    const todo = await createLocalTask({ userId: userA, title: 'Write tests' });
    await cycle('device-a');

    await setOfflineUserScope(userA, { namespace: 'device-b' });
    await cycle('device-b');
    expect((await listLocalGoals(userA)).map((row) => row.id)).toContain(goal.id);
    expect((await listLocalTasks(userA)).map((row) => row.id)).toContain(todo.id);

    await setOfflineUserScope(userA, { namespace: 'device-a' });
    await setLocalTaskScheduledFor({
      id: todo.id,
      userId: userA,
      scheduledFor: '2026-08-30',
    });
    await tombstoneLocalGoal({ id: goal.id, userId: userA });
    await cycle('device-a');

    await setOfflineUserScope(userA, { namespace: 'device-b' });
    await cycle('device-b');
    expect(
      (await listLocalTasks(userA)).find((row) => row.id === todo.id)?.scheduled_for,
    ).toBe('2026-08-30');
    expect((await listLocalGoals(userA)).map((row) => row.id)).not.toContain(goal.id);

    await setLocalTaskScheduledFor({
      id: todo.id,
      userId: userA,
      scheduledFor: '2026-08-31',
    });
    await cycle('device-b');
    await setOfflineUserScope(userA, { namespace: 'device-a' });
    await cycle('device-a');
    expect(
      (await listLocalTasks(userA)).find((row) => row.id === todo.id)?.scheduled_for,
    ).toBe('2026-08-31');
  });
});
