import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  getDbIntegrationEnv,
  getServiceSupabaseEnv,
  isDbIntegrationConfigured,
} from './env';
import { BIDIRECTIONAL_SYNC_CONTRACT } from './sync-contract';

const configured = isDbIntegrationConfigured();
const describeWithDatabase = configured ? describe : describe.skip;

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function sequence(value: bigint): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error('Unsafe test server sequence');
  return parsed;
}

describeWithDatabase('commit-ordered sync database invariants', () => {
  const runId = randomUUID();
  const password = `${randomUUID()}Aa1!`;
  let userA = '';
  let userB = '';
  let admin: ReturnType<typeof openDatabase>;
  let transactionA: ReturnType<typeof openDatabase>;
  let transactionB: ReturnType<typeof openDatabase>;
  let reader: ReturnType<typeof openDatabase>;
  let service: ReturnType<typeof createServiceClient>;

  beforeAll(async () => {
    if (!configured) return;
    admin = openDatabase();
    transactionA = openDatabase();
    transactionB = openDatabase();
    reader = openDatabase();
    service = createServiceClient();
    userA = await createUser(service, `sync-db-a-${runId}@kayamo.test`, password);
    userB = await createUser(service, `sync-db-b-${runId}@kayamo.test`, password);
  });

  afterEach(async () => {
    if (!admin || !userA || !userB) return;
    await admin`delete from public.tasks where user_id in (${userA}::uuid, ${userB}::uuid)`;
    await admin`delete from private.sync_user_counters where user_id in (${userA}::uuid, ${userB}::uuid)`;
  });

  afterAll(async () => {
    if (!configured) return;
    if (service && userA) await service.auth.admin.deleteUser(userA);
    if (service && userB) await service.auth.admin.deleteUser(userB);
    await Promise.all(
      [admin, transactionA, transactionB, reader]
        .filter(Boolean)
        .map((connection) => connection.end()),
    );
  });

  it('serializes same-user commits and exposes only a complete committed prefix', async () => {
    const firstId = rememberTask();
    const secondId = rememberTask();
    const firstReady = deferred<number>();
    const secondPid = deferred<number>();
    const releaseFirst = deferred<void>();

    const first = transactionA.begin(async (sql) => {
      const [row] = await sql<{ server_seq: bigint }[]>`
        insert into public.tasks (id, user_id, title, updated_at)
        values (${firstId}::uuid, ${userA}::uuid, 'commit-order first', now())
        returning server_seq
      `;
      firstReady.resolve(sequence(row!.server_seq));
      await releaseFirst.promise;
      return sequence(row!.server_seq);
    });
    const firstSeq = await firstReady.promise;

    let secondSettled = false;
    const second = transactionB
      .begin(async (sql) => {
        const [backend] = await sql<{ pid: number }[]>`select pg_backend_pid() as pid`;
        secondPid.resolve(backend!.pid);
        const [row] = await sql<{ server_seq: bigint }[]>`
          insert into public.tasks (id, user_id, title, updated_at)
          values (${secondId}::uuid, ${userA}::uuid, 'commit-order second', now())
          returning server_seq
        `;
        return sequence(row!.server_seq);
      })
      .finally(() => {
        secondSettled = true;
      });

    try {
      await expectBackendBlocked(await secondPid.promise);
      expect(secondSettled).toBe(false);
      expect(
        await reader<{ id: string }[]>`
          select id::text from public.tasks
          where id in (${firstId}::uuid, ${secondId}::uuid)
        `,
      ).toEqual([]);
      expect(
        await reader<{ server_seq: bigint }[]>`
          select server_seq from public.tasks
          where user_id = ${userA}::uuid and server_seq > 0
        `,
      ).toEqual([]);

      releaseFirst.resolve();
      const [committedFirst, committedSecond] = await Promise.all([first, second]);
      expect(committedFirst).toBe(firstSeq);
      expect(committedSecond).toBeGreaterThan(committedFirst);

      const prefix = await reader<{ id: string; server_seq: bigint }[]>`
        select id::text, server_seq from public.tasks
        where user_id = ${userA}::uuid and server_seq > 0
        order by server_seq asc
      `;
      expect(prefix.map((row) => row.id)).toEqual([firstId, secondId]);
      expect(prefix.map((row) => sequence(row.server_seq))).toEqual([
        committedFirst,
        committedSecond,
      ]);
    } finally {
      releaseFirst.resolve();
      await Promise.allSettled([first, second]);
    }
  });

  it('rolls back sequence allocation transactionally and safely reuses it', async () => {
    const rolledBackId = rememberTask();
    const committedId = rememberTask();
    const firstReady = deferred<number>();
    const secondPid = deferred<number>();
    const releaseRollback = deferred<void>();

    const rolledBack = transactionA.begin(async (sql) => {
      const [row] = await sql<{ server_seq: bigint }[]>`
        insert into public.tasks (id, user_id, title, updated_at)
        values (${rolledBackId}::uuid, ${userA}::uuid, 'rollback owner', now())
        returning server_seq
      `;
      firstReady.resolve(sequence(row!.server_seq));
      await releaseRollback.promise;
      throw new Error('intentional sequence rollback');
    });
    const allocatedSeq = await firstReady.promise;
    const committed = transactionB.begin(async (sql) => {
      const [backend] = await sql<{ pid: number }[]>`select pg_backend_pid() as pid`;
      secondPid.resolve(backend!.pid);
      const [row] = await sql<{ server_seq: bigint }[]>`
        insert into public.tasks (id, user_id, title, updated_at)
        values (${committedId}::uuid, ${userA}::uuid, 'rollback successor', now())
        returning server_seq
      `;
      return sequence(row!.server_seq);
    });

    try {
      await expectBackendBlocked(await secondPid.promise);
      releaseRollback.resolve();
      await expect(rolledBack).rejects.toThrow('intentional sequence rollback');
      const committedSeq = await committed;
      expect(committedSeq).toBe(allocatedSeq);
      expect(
        await reader<{ id: string }[]>`
          select id::text from public.tasks where id = ${rolledBackId}::uuid
        `,
      ).toEqual([]);
      const owners = await reader<{ id: string }[]>`
        select id::text from public.tasks
        where user_id = ${userA}::uuid and server_seq = ${committedSeq}
      `;
      expect(owners.map((row) => row.id)).toEqual([committedId]);
    } finally {
      releaseRollback.resolve();
      await Promise.allSettled([rolledBack, committed]);
    }
  });

  it('holds the same-user counter lock across a multi-row transaction', async () => {
    const firstId = rememberTask();
    const secondId = rememberTask();
    const competitorId = rememberTask();
    const rowsReady = deferred<[number, number]>();
    const competitorPid = deferred<number>();
    const releaseRows = deferred<void>();

    const multiRow = transactionA.begin(async (sql) => {
      const [first] = await sql<{ server_seq: bigint }[]>`
        insert into public.tasks (id, user_id, title, updated_at)
        values (${firstId}::uuid, ${userA}::uuid, 'multi-row first', now())
        returning server_seq
      `;
      const [second] = await sql<{ server_seq: bigint }[]>`
        insert into public.tasks (id, user_id, title, updated_at)
        values (${secondId}::uuid, ${userA}::uuid, 'multi-row second', now())
        returning server_seq
      `;
      const result: [number, number] = [
        sequence(first!.server_seq),
        sequence(second!.server_seq),
      ];
      rowsReady.resolve(result);
      await releaseRows.promise;
      return result;
    });
    const allocated = await rowsReady.promise;
    expect(allocated[1]).toBe(allocated[0] + 1);

    const competitor = transactionB.begin(async (sql) => {
      const [backend] = await sql<{ pid: number }[]>`select pg_backend_pid() as pid`;
      competitorPid.resolve(backend!.pid);
      const [row] = await sql<{ server_seq: bigint }[]>`
        insert into public.tasks (id, user_id, title, updated_at)
        values (${competitorId}::uuid, ${userA}::uuid, 'multi-row competitor', now())
        returning server_seq
      `;
      return sequence(row!.server_seq);
    });

    try {
      await expectBackendBlocked(await competitorPid.promise);
      expect(
        await reader<{ id: string }[]>`
          select id::text from public.tasks
          where id in (${firstId}::uuid, ${secondId}::uuid, ${competitorId}::uuid)
        `,
      ).toEqual([]);
      releaseRows.resolve();
      const [committedRows, competitorSeq] = await Promise.all([multiRow, competitor]);
      expect(competitorSeq).toBeGreaterThan(Math.max(...committedRows));
    } finally {
      releaseRows.resolve();
      await Promise.allSettled([multiRow, competitor]);
    }
  });

  it('allows a different user to progress while another owner holds a counter lock', async () => {
    const heldId = rememberTask();
    const independentId = rememberTask();
    const heldReady = deferred<number>();
    const releaseHeld = deferred<void>();

    const held = transactionA.begin(async (sql) => {
      const [row] = await sql<{ server_seq: bigint }[]>`
        insert into public.tasks (id, user_id, title, updated_at)
        values (${heldId}::uuid, ${userA}::uuid, 'held user A row', now())
        returning server_seq
      `;
      heldReady.resolve(sequence(row!.server_seq));
      await releaseHeld.promise;
      return sequence(row!.server_seq);
    });
    await heldReady.promise;

    try {
      const [independent] = await transactionB.begin(async (sql) => {
        await sql`set local statement_timeout = '2s'`;
        return sql<{ server_seq: bigint }[]>`
          insert into public.tasks (id, user_id, title, updated_at)
          values (${independentId}::uuid, ${userB}::uuid, 'independent user B row', now())
          returning server_seq
        `;
      });
      expect(sequence(independent!.server_seq)).toBeGreaterThan(0);
      expect(
        await reader<{ id: string }[]>`
          select id::text from public.tasks where id = ${independentId}::uuid
        `,
      ).toEqual([{ id: independentId }]);
      expect(
        await reader<{ id: string }[]>`
          select id::text from public.tasks where id = ${heldId}::uuid
        `,
      ).toEqual([]);
    } finally {
      releaseHeld.resolve();
      await Promise.allSettled([held]);
    }
  });

  it('matches every registry table to real sequence, trigger, index, and tombstone infrastructure', async () => {
    expect(BIDIRECTIONAL_SYNC_CONTRACT).toHaveLength(26);
    for (const spec of BIDIRECTIONAL_SYNC_CONTRACT) {
      const [column] = await admin<
        {
          is_nullable: 'YES' | 'NO';
        }[]
      >`
        select is_nullable
        from information_schema.columns
        where table_schema = 'public'
          and table_name = ${spec.table}
          and column_name = 'server_seq'
      `;
      expect(column, `${spec.table}.server_seq`).toBeDefined();
      expect(column!.is_nullable, `${spec.table}.server_seq nullability`).toBe(
        spec.serverSeqNullable ? 'YES' : 'NO',
      );

      const triggers = await admin<{ definition: string }[]>`
        select pg_get_triggerdef(trigger.oid) as definition
        from pg_trigger trigger
        join pg_class relation on relation.oid = trigger.tgrelid
        join pg_namespace namespace on namespace.oid = relation.relnamespace
        where namespace.nspname = 'public'
          and relation.relname = ${spec.table}
          and not trigger.tgisinternal
      `;
      const sequenceTrigger = triggers.find((trigger) =>
        trigger.definition.includes('kayamo_assign_server_seq'),
      );
      expect(sequenceTrigger, `${spec.table} sequence trigger`).toBeDefined();
      expect(sequenceTrigger!.definition).toContain('BEFORE INSERT OR UPDATE');
      expect(sequenceTrigger!.definition).toContain(`'${spec.ownerColumn}'`);

      const indexes = await admin<{ indexdef: string }[]>`
        select indexdef from pg_indexes
        where schemaname = 'public' and tablename = ${spec.table}
      `;
      expect(
        indexes.some(
          (index) =>
            index.indexdef.includes('UNIQUE INDEX') &&
            index.indexdef.includes(`(${spec.ownerColumn}, server_seq)`),
        ),
        `${spec.table} owner/server_seq unique index`,
      ).toBe(true);

      const constraints = await admin<{ definition: string }[]>`
        select pg_get_constraintdef(constraint_row.oid) as definition
        from pg_constraint constraint_row
        join pg_class relation on relation.oid = constraint_row.conrelid
        join pg_namespace namespace on namespace.oid = relation.relnamespace
        where namespace.nspname = 'public'
          and relation.relname = ${spec.table}
          and constraint_row.contype = 'c'
      `;
      expect(
        constraints.some((constraint) => constraint.definition.includes('server_seq')),
        `${spec.table} server_seq constraint`,
      ).toBe(true);

      const [tombstone] = await admin<{ present: boolean }[]>`
        select exists (
          select 1 from information_schema.columns
          where table_schema = 'public'
            and table_name = ${spec.table}
            and column_name = 'deleted_at'
        ) as present
      `;
      expect(tombstone!.present, `${spec.table} tombstone contract`).toBe(
        spec.tombstones,
      );
    }

    const [privileges] = await admin<
      {
        anon_schema: boolean;
        authenticated_schema: boolean;
        anon_table: boolean;
        authenticated_table: boolean;
        anon_function: boolean;
        authenticated_function: boolean;
      }[]
    >`
      select
        has_schema_privilege('anon', 'private', 'usage') as anon_schema,
        has_schema_privilege('authenticated', 'private', 'usage') as authenticated_schema,
        has_table_privilege('anon', 'private.sync_user_counters', 'select') as anon_table,
        has_table_privilege('authenticated', 'private.sync_user_counters', 'select') as authenticated_table,
        has_function_privilege('anon', 'private.kayamo_next_sync_seq(uuid)', 'execute') as anon_function,
        has_function_privilege('authenticated', 'private.kayamo_next_sync_seq(uuid)', 'execute') as authenticated_function
    `;
    expect(privileges).toEqual({
      anon_schema: false,
      authenticated_schema: false,
      anon_table: false,
      authenticated_table: false,
      anon_function: false,
      authenticated_function: false,
    });
  });

  function rememberTask(): string {
    return randomUUID();
  }

  async function expectBackendBlocked(pid: number): Promise<void> {
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      const [activity] = await reader<
        {
          wait_event_type: string | null;
          blockers: number;
        }[]
      >`
        select wait_event_type, cardinality(pg_blocking_pids(pid))::integer as blockers
        from pg_stat_activity where pid = ${pid}
      `;
      if (activity?.wait_event_type === 'Lock' && activity.blockers > 0) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`Backend ${pid} did not block on the production sequence lock`);
  }
});

function openDatabase() {
  const { databaseUrl } = getDbIntegrationEnv();
  return postgres(databaseUrl, {
    max: 1,
    prepare: false,
    types: { bigint: postgres.BigInt },
  });
}

function createServiceClient() {
  const { url, serviceRoleKey } = getServiceSupabaseEnv();
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function createUser(
  service: ReturnType<typeof createServiceClient>,
  email: string,
  password: string,
): Promise<string> {
  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw created.error ?? new Error('createUser returned no user');
  }
  return created.data.user.id;
}
