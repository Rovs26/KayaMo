import type { DbClient, Task } from '@kayamo/db';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getOfflineDatabaseName,
  getOfflineDb,
  KayaMoDB,
  migrateLegacyAccount,
  resetOfflineDb,
  setOfflineUserScope,
  type SyncQueueItem,
  type SyncableTable,
} from './db';
import { compareSyncCursor, pullRemoteChanges, type PullPageFetcher } from './pull';
import { enqueueUpsert } from './queue';
import { applySyncQueueItem, syncUserOnce, type SyncPushHandler } from './sync';

const client = {} as DbClient;
const userA = 'user-a';
const userB = 'user-b';
const timestamp = '2026-08-29T04:12:33+00:00';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function task(id: string, userId = userA, title = id): Task {
  return {
    id,
    user_id: userId,
    title,
    notes: null,
    scheduled_for: null,
    due_at: null,
    completed_at: null,
    sort_order: 0,
    origin: 'user',
    created_at: timestamp,
    updated_at: timestamp,
    server_updated_at: timestamp,
    deleted_at: null,
  };
}

describe('adversarial sync repair reproductions', () => {
  beforeEach(resetOfflineDb);
  afterEach(async () => {
    vi.restoreAllMocks();
    await resetOfflineDb();
  });

  it('binds the next database before an awaited account transition can yield', async () => {
    await setOfflineUserScope(userA);
    const realExists = Dexie.exists.bind(Dexie);
    const blocked = deferred<boolean>();
    const exists = vi
      .spyOn(Dexie, 'exists')
      .mockImplementationOnce(() => blocked.promise)
      .mockImplementation((name) => realExists(name));

    const transition = setOfflineUserScope(userB);
    await vi.waitFor(() => expect(exists).toHaveBeenCalled());
    const nameDuringTransition = getOfflineDb().name;
    blocked.resolve(false);
    await transition;

    expect(nameDuringTransition).toContain(encodeURIComponent(userB));
    expect(getOfflineDb().name).toBe(getOfflineDatabaseName());
  });

  it('does not write an in-flight User A pull into User B storage', async () => {
    await setOfflineUserScope(userA);
    const response = deferred<unknown[]>();
    const started = deferred<void>();
    const pull = pullRemoteChanges({
      client,
      userId: userA,
      tables: ['tasks'],
      fetchPage: async () => {
        started.resolve();
        return response.promise;
      },
    });
    await started.promise;
    await setOfflineUserScope(userB);
    response.resolve([task('private-a')]);

    await expect(pull).rejects.toThrow(/scope/i);
    expect(await getOfflineDb().tasks.get('private-a')).toBeUndefined();
  });

  it('does not write an authenticated in-flight pull into signed-out storage', async () => {
    await setOfflineUserScope(userA);
    const response = deferred<unknown[]>();
    const started = deferred<void>();
    const pull = pullRemoteChanges({
      client,
      userId: userA,
      tables: ['tasks'],
      fetchPage: async () => {
        started.resolve();
        return response.promise;
      },
    });
    await started.promise;
    await setOfflineUserScope(null);
    response.resolve([task('private-a')]);

    await expect(pull).rejects.toThrow(/scope/i);
    expect(getOfflineDb().name).toBe('kayamo:signed-out');
    expect(await getOfflineDb().tasks.count()).toBe(0);
  });

  it('recovers pre-existing signed-out contamination into the correct account stores', async () => {
    const signedOut = getOfflineDb();
    await signedOut.tasks.bulkPut([
      task('signed-out-a', userA),
      task('signed-out-b', userB),
    ]);
    await signedOut.local_journal_entries.bulkPut([
      {
        id: 'signed-out-journal-a',
        user_id: userA,
        kind: 'diary',
        content: 'A only',
        created_at: timestamp,
        updated_at: timestamp,
      },
      {
        id: 'signed-out-journal-b',
        user_id: userB,
        kind: 'diary',
        content: 'B only',
        created_at: timestamp,
        updated_at: timestamp,
      },
    ]);

    await setOfflineUserScope(null);
    expect(await getOfflineDb().tasks.count()).toBe(0);
    expect(await getOfflineDb().local_journal_entries.count()).toBe(0);

    await setOfflineUserScope(userA);
    expect(await getOfflineDb().tasks.get('signed-out-a')).toBeTruthy();
    expect(await getOfflineDb().tasks.get('signed-out-b')).toBeUndefined();
    expect(
      await getOfflineDb().local_journal_entries.get('signed-out-journal-a'),
    ).toBeTruthy();

    await setOfflineUserScope(userB);
    expect(await getOfflineDb().tasks.get('signed-out-b')).toBeTruthy();
    expect(await getOfflineDb().tasks.get('signed-out-a')).toBeUndefined();
    expect(
      await getOfflineDb().local_journal_entries.get('signed-out-journal-b'),
    ).toBeTruthy();
  });

  it('resumes legacy migration when an account database exists only partially', async () => {
    const legacy = new KayaMoDB('kayamo');
    await legacy.open();
    await legacy.tasks.put(task('legacy-task'));
    await legacy.local_journal_entries.put({
      id: 'legacy-reflection',
      user_id: userA,
      kind: 'reflection',
      content: 'private reflection',
      created_at: timestamp,
      updated_at: timestamp,
    });
    legacy.close();

    const partial = new KayaMoDB(`kayamo:default:user:${encodeURIComponent(userA)}`);
    await partial.open();
    await partial.tasks.put(task('legacy-task'));
    partial.close();

    await setOfflineUserScope(userA);
    expect(await getOfflineDb().tasks.get('legacy-task')).toBeTruthy();
    expect(
      await getOfflineDb().local_journal_entries.get('legacy-reflection'),
    ).toBeTruthy();
  });

  it('keeps V2 queued when V1 completes after a second edit', async () => {
    await setOfflineUserScope(userA);
    const v1 = task('task-a', userA, 'V1');
    const v2 = task('task-a', userA, 'V2');
    await getOfflineDb().tasks.put(v1);
    await enqueueUpsert('tasks', v1.id, v1);

    const entered = deferred<void>();
    const release = deferred<void>();
    const pushItem: SyncPushHandler = async () => {
      entered.resolve();
      await release.promise;
    };
    const cycle = syncUserOnce({
      client,
      userId: userA,
      tables: ['tasks'],
      fetchPage: async () => [],
      pushItem,
    });
    await entered.promise;
    await getOfflineDb().tasks.put(v2);
    await enqueueUpsert('tasks', v2.id, v2);
    release.resolve();
    await cycle;

    const queued = await getOfflineDb().sync_queue.toArray();
    expect(queued).toHaveLength(1);
    expect(queued[0]?.payload.title).toBe('V2');
  });

  it('continues to later tables when one pull table is poisoned', async () => {
    await setOfflineUserScope(userA);
    const fetchPage: PullPageFetcher = async ({ spec }) => {
      if (spec.table === 'food_entries') throw new Error('poisoned table');
      return spec.table === 'tasks' ? [task('task-after-failure')] : [];
    };

    const result = await pullRemoteChanges({
      client,
      userId: userA,
      tables: ['food_entries', 'tasks'],
      fetchPage,
    });

    expect(await getOfflineDb().tasks.get('task-after-failure')).toBeTruthy();
    expect(result).toMatchObject({ failedTables: ['food_entries'] });
  });

  it('stops a stale paginated cycle after its scope epoch changes', async () => {
    await setOfflineUserScope(userA);
    const secondRequest = deferred<void>();
    const releaseSecond = deferred<unknown[]>();
    let calls = 0;
    const pull = pullRemoteChanges({
      client,
      userId: userA,
      tables: ['tasks'],
      pageSize: 1,
      fetchPage: async () => {
        calls += 1;
        if (calls === 1) return [task('first')];
        secondRequest.resolve();
        return releaseSecond.promise;
      },
    });
    await secondRequest.promise;
    await setOfflineUserScope(userB);
    releaseSecond.resolve([task('must-not-write')]);
    await expect(pull).rejects.toThrow(/scope/i);
    expect(await getOfflineDb().tasks.count()).toBe(0);

    await setOfflineUserScope(userA);
    expect(await getOfflineDb().tasks.get('first')).toBeTruthy();
    expect(await getOfflineDb().tasks.get('must-not-write')).toBeUndefined();
  });

  it('recovers every eligible row after an interrupted legacy migration', async () => {
    const legacy = new KayaMoDB('kayamo');
    await legacy.open();
    await legacy.tasks.put(task('recover-task'));
    await legacy.local_journal_entries.put({
      id: 'recover-prayer',
      user_id: userA,
      kind: 'prayer',
      content: 'local only',
      created_at: timestamp,
      updated_at: timestamp,
    });
    legacy.close();

    const name = `kayamo:recovery:user:${encodeURIComponent(userA)}`;
    const partial = new KayaMoDB(name);
    await partial.open();
    await expect(
      migrateLegacyAccount('kayamo', partial, userA, {
        afterTable: (tableName) => {
          if (tableName === 'tasks') throw new Error('simulated browser crash');
        },
      }),
    ).rejects.toThrow('simulated browser crash');
    expect(await partial.tasks.get('recover-task')).toBeTruthy();
    expect(await partial.migration_markers.count()).toBe(0);
    partial.close();

    const restarted = new KayaMoDB(name);
    await restarted.open();
    expect(await migrateLegacyAccount('kayamo', restarted, userA)).toBe(true);
    expect(await restarted.tasks.get('recover-task')).toBeTruthy();
    expect(await restarted.local_journal_entries.get('recover-prayer')).toBeTruthy();
    expect(await restarted.migration_markers.count()).toBe(1);
    restarted.close();
  });

  it('makes completed legacy migration idempotent', async () => {
    const legacy = new KayaMoDB('kayamo');
    const destination = new KayaMoDB('kayamo:idempotent:user:user-a');
    await legacy.open();
    await destination.open();
    await legacy.tasks.put(task('once'));
    expect(await migrateLegacyAccount('kayamo', destination, userA)).toBe(true);
    expect(await migrateLegacyAccount('kayamo', destination, userA)).toBe(false);
    expect(await destination.tasks.count()).toBe(1);
    expect(await destination.migration_markers.count()).toBe(1);
    legacy.close();
    destination.close();
  });

  it('migrates only the matching owner for multiple legacy accounts', async () => {
    const legacy = new KayaMoDB('kayamo');
    await legacy.open();
    await legacy.tasks.bulkPut([task('a', userA), task('b', userB)]);
    await legacy.local_journal_entries.bulkPut([
      {
        id: 'journal-a',
        user_id: userA,
        kind: 'vent',
        content: 'A',
        created_at: timestamp,
        updated_at: timestamp,
      },
      {
        id: 'journal-b',
        user_id: userB,
        kind: 'vent',
        content: 'B',
        created_at: timestamp,
        updated_at: timestamp,
      },
    ]);
    legacy.close();

    const dbA = new KayaMoDB('kayamo:multi:user:user-a');
    const dbB = new KayaMoDB('kayamo:multi:user:user-b');
    await dbA.open();
    await dbB.open();
    await migrateLegacyAccount('kayamo', dbA, userA);
    await migrateLegacyAccount('kayamo', dbB, userB);
    expect((await dbA.tasks.toArray()).map((row) => row.id)).toEqual(['a']);
    expect((await dbB.tasks.toArray()).map((row) => row.id)).toEqual(['b']);
    expect((await dbA.local_journal_entries.toArray()).map((row) => row.id)).toEqual([
      'journal-a',
    ]);
    expect((await dbB.local_journal_entries.toArray()).map((row) => row.id)).toEqual([
      'journal-b',
    ]);
    dbA.close();
    dbB.close();
  });

  it('removes an unchanged mutation after a normal successful push', async () => {
    await setOfflineUserScope(userA);
    const row = task('normal-push');
    await enqueueUpsert('tasks', row.id, row);
    await syncUserOnce({
      client,
      userId: userA,
      tables: ['tasks'],
      fetchPage: async () => [],
      pushItem: async () => undefined,
    });
    expect(await getOfflineDb().sync_queue.count()).toBe(0);
  });

  it('orders canonical Postgres timestamps by time and then stable key', () => {
    const cursor = (serverUpdatedAt: string, stableKey = 'a') => ({
      serverUpdatedAt,
      stableKey,
    });
    expect(
      compareSyncCursor(cursor(timestamp), cursor('2026-08-29T04:12:33.000001+00:00')),
    ).toBeLessThan(0);
    expect(
      compareSyncCursor(
        cursor('2026-08-29T04:12:33.1+00:00'),
        cursor('2026-08-29T04:12:33.01+00:00'),
      ),
    ).toBeGreaterThan(0);
    expect(
      compareSyncCursor(
        cursor('2026-08-29T04:12:33.1+00:00'),
        cursor('2026-08-29T04:12:33.100000+00:00'),
      ),
    ).toBe(0);
    expect(
      compareSyncCursor(cursor(timestamp, 'a'), cursor(timestamp, 'b')),
    ).toBeLessThan(0);
    expect(compareSyncCursor(cursor(timestamp, 'same'), cursor(timestamp, 'same'))).toBe(
      0,
    );
  });

  it('records bounded per-table retry attempts with growing backoff', async () => {
    await setOfflineUserScope(userA);
    let now = 1_000;
    let calls = 0;
    const run = () =>
      pullRemoteChanges({
        client,
        userId: userA,
        tables: ['tasks'],
        now: () => now,
        fetchPage: async () => {
          calls += 1;
          throw new TypeError('Failed to fetch');
        },
      });
    const first = await run();
    expect(first.nextRetryAt).toBe(3_000);
    expect((await getOfflineDb().sync_pull_failures.toArray())[0]).toMatchObject({
      attempt: 1,
      nextRetryAt: 3_000,
    });
    now = 2_999;
    const deferredResult = await run();
    expect(deferredResult.deferredTables).toEqual(['tasks']);
    expect(calls).toBe(1);
    now = 3_000;
    const second = await run();
    expect(second.nextRetryAt).toBe(7_000);
    expect((await getOfflineDb().sync_pull_failures.toArray())[0]).toMatchObject({
      attempt: 2,
      nextRetryAt: 7_000,
    });
  });

  it('never rolls a pull checkpoint backward when another tab advances it', async () => {
    await setOfflineUserScope(userA);
    const response = deferred<unknown[]>();
    const started = deferred<void>();
    const olderPull = pullRemoteChanges({
      client,
      userId: userA,
      tables: ['tasks'],
      fetchPage: async () => {
        started.resolve();
        return response.promise;
      },
    });
    await started.promise;
    await pullRemoteChanges({
      client,
      userId: userA,
      tables: ['tasks'],
      fetchPage: async () => [
        {
          ...task('newer'),
          updated_at: '2026-08-29T04:12:34+00:00',
          server_updated_at: '2026-08-29T04:12:34+00:00',
        },
      ],
    });
    response.resolve([task('older')]);
    await olderPull;

    expect(
      (await getOfflineDb().sync_checkpoints.get(`${userA}:tasks`))?.server_updated_at,
    ).toBe('2026-08-29T04:12:34+00:00');
  });

  it('fails loudly for a runtime table missing a push implementation', async () => {
    await setOfflineUserScope(userA);
    const item: SyncQueueItem = {
      id: 'future',
      revision: 'revision',
      userId: userA,
      table: 'future_table' as SyncableTable,
      entityId: 'future',
      payload: { user_id: userA },
      attempt: 0,
      nextAttemptAt: 0,
      lastError: null,
    };
    await expect(applySyncQueueItem(client, item)).rejects.toThrow(
      'Unsupported sync push table: future_table',
    );
  });

  it('keeps local-only journal content isolated across account switches and out of sync', async () => {
    const sentinel = 'KAYAMO_LOCAL_ONLY_ACCOUNT_SWITCH_SENTINEL_9281';
    await setOfflineUserScope(userA);
    await getOfflineDb().local_journal_entries.put({
      id: 'private-a',
      user_id: userA,
      kind: 'reflection',
      content: sentinel,
      created_at: timestamp,
      updated_at: timestamp,
    });
    await setOfflineUserScope(userB);
    expect(await getOfflineDb().local_journal_entries.count()).toBe(0);
    expect(JSON.stringify(await getOfflineDb().sync_queue.toArray())).not.toContain(
      sentinel,
    );
    await setOfflineUserScope(userA);
    expect((await getOfflineDb().local_journal_entries.get('private-a'))?.content).toBe(
      sentinel,
    );
    expect(await getOfflineDb().sync_queue.count()).toBe(0);
  });
});
