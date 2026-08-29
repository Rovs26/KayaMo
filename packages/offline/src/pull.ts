import type { DbClient } from '@kayamo/db';
import { incomingWins, isUnauthorizedError } from '@kayamo/db';
import type { Table } from 'dexie';
import { backoffMs } from './backoff';
import {
  assertOfflineScope,
  checkpointId,
  getOfflineScope,
  queueItemId,
  StaleOfflineScopeError,
  type KayaMoDB,
  type OfflineScope,
  type SyncCheckpoint,
  type SyncQueueItem,
  type SyncableTable,
} from './db';
import {
  BIDIRECTIONAL_SYNC_REGISTRY,
  syncSpecFor,
  type SyncTableSpec,
} from './sync-registry';

export type SyncCursor = {
  serverUpdatedAt: string;
  stableKey: string;
};

export type PullPageRequest = {
  client: DbClient;
  userId: string;
  spec: SyncTableSpec;
  cursor: SyncCursor | null;
  limit: number;
};

export type PullPageFetcher = (request: PullPageRequest) => Promise<unknown[]>;

export type PullStats = {
  pulled: number;
  applied: number;
  tombstones: number;
  skippedStale: number;
  conflicts: number;
  checkpointsAdvanced: number;
  failedTables: SyncableTable[];
  deferredTables: SyncableTable[];
  nextRetryAt: number | null;
};

type SyncRecord = Record<string, unknown> & {
  server_updated_at: string;
};

type SyncQueryResult = { data: unknown[] | null; error: unknown };

type SyncFilter = PromiseLike<SyncQueryResult> & {
  eq(column: string, value: string): SyncFilter;
  gt(column: string, value: string): SyncFilter;
  order(column: string, options: { ascending: boolean }): SyncFilter;
  limit(value: number): SyncFilter;
};

type SyncQueryClient = {
  from(table: string): { select(columns: string): SyncFilter };
};

type ApplyPageOptions = {
  beforeCheckpoint?: () => void | Promise<void>;
  scope?: OfflineScope;
};

const SERVER_TIMESTAMP =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/;

function timestampParts(value: string): { milliseconds: number; micros: number } {
  const match = SERVER_TIMESTAMP.exec(value);
  if (!match) throw new Error('Invalid canonical server timestamp');
  const milliseconds = Date.parse(`${match[1]}${match[3]}`);
  if (!Number.isFinite(milliseconds))
    throw new Error('Invalid canonical server timestamp');
  return {
    milliseconds,
    micros: Number((match[2] ?? '').padEnd(6, '0')),
  };
}

function lexicalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function compareSyncCursor(left: SyncCursor, right: SyncCursor): number {
  const leftTime = timestampParts(left.serverUpdatedAt);
  const rightTime = timestampParts(right.serverUpdatedAt);
  const milliseconds = leftTime.milliseconds - rightTime.milliseconds;
  if (milliseconds !== 0) return milliseconds < 0 ? -1 : 1;
  const micros = leftTime.micros - rightTime.micros;
  if (micros !== 0) return micros < 0 ? -1 : 1;
  return lexicalCompare(left.stableKey, right.stableKey);
}

function parseRecord(spec: SyncTableSpec, userId: string, value: unknown): SyncRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Malformed ${spec.table} sync row`);
  }
  const row = value as Record<string, unknown>;
  const owner = row[spec.ownerColumn];
  const stableKey = row[spec.stableKeyColumn];
  const serverUpdatedAt = row.server_updated_at;
  if (owner !== userId) throw new Error(`Owner mismatch in ${spec.table} sync row`);
  if (typeof stableKey !== 'string' || stableKey.length === 0) {
    throw new Error(`Missing stable key in ${spec.table} sync row`);
  }
  if (
    typeof serverUpdatedAt !== 'string' ||
    (() => {
      try {
        timestampParts(serverUpdatedAt);
        return false;
      } catch {
        return true;
      }
    })()
  ) {
    throw new Error(`Invalid server cursor in ${spec.table} sync row`);
  }
  if (spec.conflictColumn) {
    const conflictTimestamp = row[spec.conflictColumn];
    if (
      typeof conflictTimestamp !== 'string' ||
      !Number.isFinite(new Date(conflictTimestamp).getTime())
    ) {
      throw new Error(`Invalid conflict timestamp in ${spec.table} sync row`);
    }
  }
  if (
    spec.tombstones &&
    row.deleted_at !== null &&
    (typeof row.deleted_at !== 'string' ||
      !Number.isFinite(new Date(row.deleted_at).getTime()))
  ) {
    throw new Error(`Invalid tombstone in ${spec.table} sync row`);
  }
  return { ...row, server_updated_at: serverUpdatedAt };
}

function rowCursor(spec: SyncTableSpec, row: SyncRecord): SyncCursor {
  return {
    serverUpdatedAt: row.server_updated_at,
    stableKey: row[spec.stableKeyColumn] as string,
  };
}

function queuedTimestamp(item: SyncQueueItem): string | null {
  const value = item.payload.updated_at;
  return typeof value === 'string' ? value : null;
}

async function findQueuedMutation(
  db: KayaMoDB,
  table: SyncableTable,
  entityId: string,
  userId: string,
): Promise<SyncQueueItem | undefined> {
  const current = await db.sync_queue.get(queueItemId(table, entityId, userId));
  if (current) return current;
  const legacy = await db.sync_queue.get(queueItemId(table, entityId));
  return legacy?.userId === userId ? legacy : undefined;
}

function isTombstone(row: Record<string, unknown>): boolean {
  return typeof row.deleted_at === 'string';
}

async function mergeRecord(
  db: KayaMoDB,
  spec: SyncTableSpec,
  table: Table<SyncRecord, string>,
  row: SyncRecord,
  userId: string,
): Promise<'applied' | 'tombstone' | 'skipped' | 'conflict'> {
  const key = row[spec.stableKeyColumn] as string;
  const existing = await table.get(key);
  const queued = await findQueuedMutation(db, spec.table, key, userId);
  const remoteDeleted = spec.tombstones && isTombstone(row);
  const localDeleted = existing ? isTombstone(existing) : false;
  const queuedDeleted = queued ? isTombstone(queued.payload) : false;

  // KayaMo tombstones are irreversible on the server. Delete therefore wins
  // over a stale live row in either direction.
  if (remoteDeleted) {
    await table.put(row);
    if (queued) await db.sync_queue.delete(queued.id);
    return 'tombstone';
  }
  if (localDeleted || queuedDeleted) return 'skipped';

  if (spec.table === 'companion_events') {
    const eventKey = row.event_key;
    if (typeof eventKey !== 'string') throw new Error('Malformed companion event');
    const duplicate = await db.companion_events
      .where('[user_id+event_key]')
      .equals([userId, eventKey])
      .first();
    if (duplicate && duplicate.id !== key) {
      await db.companion_events.delete(duplicate.id);
    }
    await table.put(row);
    if (queued) await db.sync_queue.delete(queued.id);
    return 'applied';
  }

  const remoteUpdatedAt = row.updated_at as string;
  if (queued) {
    const localUpdatedAt = queuedTimestamp(queued);
    if (!localUpdatedAt || !incomingWins(localUpdatedAt, remoteUpdatedAt)) {
      return 'skipped';
    }
    await table.put(row);
    await db.sync_queue.delete(queued.id);
    return 'conflict';
  }
  if (!existing || incomingWins(existing.updated_at as string, remoteUpdatedAt)) {
    await table.put(row);
    return 'applied';
  }
  return 'skipped';
}

export async function applyPullPage(
  params: {
    userId: string;
    table: SyncableTable;
    rows: unknown[];
  },
  options: ApplyPageOptions = {},
): Promise<PullStats> {
  const spec = syncSpecFor(params.table);
  const rows = params.rows
    .map((row) => parseRecord(spec, params.userId, row))
    .sort((left, right) =>
      compareSyncCursor(rowCursor(spec, left), rowCursor(spec, right)),
    );
  const stats: PullStats = {
    pulled: rows.length,
    applied: 0,
    tombstones: 0,
    skippedStale: 0,
    conflicts: 0,
    checkpointsAdvanced: 0,
    failedTables: [],
    deferredTables: [],
    nextRetryAt: null,
  };
  if (rows.length === 0) return stats;

  const scope = options.scope ?? getOfflineScope();
  const { db } = scope;
  assertOfflineScope(scope);
  if (scope.userId !== params.userId) throw new StaleOfflineScopeError();
  const localTable = db.table<SyncRecord, string>(spec.table);
  await db.transaction(
    'rw',
    localTable,
    db.sync_queue,
    db.sync_checkpoints,
    db.companion_events,
    async () => {
      for (const row of rows) {
        assertOfflineScope(scope);
        const result = await mergeRecord(db, spec, localTable, row, params.userId);
        if (result === 'applied') stats.applied += 1;
        if (result === 'tombstone') {
          stats.applied += 1;
          stats.tombstones += 1;
        }
        if (result === 'skipped') stats.skippedStale += 1;
        if (result === 'conflict') {
          stats.applied += 1;
          stats.conflicts += 1;
        }
      }
      await options.beforeCheckpoint?.();
      assertOfflineScope(scope);
      const cursor = rowCursor(spec, rows.at(-1)!);
      const currentCheckpoint = await db.sync_checkpoints.get(
        checkpointId(params.userId, params.table),
      );
      if (
        currentCheckpoint &&
        compareSyncCursor(cursor, {
          serverUpdatedAt: currentCheckpoint.server_updated_at,
          stableKey: currentCheckpoint.stable_key,
        }) <= 0
      ) {
        return;
      }
      const checkpoint: SyncCheckpoint = {
        id: checkpointId(params.userId, params.table),
        user_id: params.userId,
        table: params.table,
        server_updated_at: cursor.serverUpdatedAt,
        stable_key: cursor.stableKey,
        updatedAt: Date.now(),
      };
      await db.sync_checkpoints.put(checkpoint);
      stats.checkpointsAdvanced = 1;
    },
  );
  return stats;
}

async function fetchOrderedRows(
  request: PullPageRequest,
  filter: { sameTime: boolean; limit: number },
): Promise<unknown[]> {
  const client = request.client as unknown as SyncQueryClient;
  let query = client
    .from(request.spec.table)
    .select('*')
    .eq(request.spec.ownerColumn, request.userId);
  if (request.cursor) {
    query = filter.sameTime
      ? query
          .eq('server_updated_at', request.cursor.serverUpdatedAt)
          .gt(request.spec.stableKeyColumn, request.cursor.stableKey)
      : query.gt('server_updated_at', request.cursor.serverUpdatedAt);
  }
  const { data, error } = await query
    .order('server_updated_at', { ascending: true })
    .order(request.spec.stableKeyColumn, { ascending: true })
    .limit(filter.limit);
  if (error) throw error;
  return data ?? [];
}

export const fetchServerSyncPage: PullPageFetcher = async (request) => {
  if (!request.cursor) {
    return fetchOrderedRows(request, { sameTime: false, limit: request.limit });
  }
  const tied = await fetchOrderedRows(request, {
    sameTime: true,
    limit: request.limit,
  });
  if (tied.length >= request.limit) return tied;
  const newer = await fetchOrderedRows(request, {
    sameTime: false,
    limit: request.limit - tied.length,
  });
  return [...tied, ...newer];
};

export async function pullRemoteChanges(params: {
  client: DbClient;
  userId: string;
  fetchPage?: PullPageFetcher;
  pageSize?: number;
  tables?: readonly SyncableTable[];
  scope?: OfflineScope;
  now?: () => number;
}): Promise<PullStats> {
  const fetchPage = params.fetchPage ?? fetchServerSyncPage;
  const pageSize = params.pageSize ?? 100;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) {
    throw new Error('Sync page size must be between 1 and 500');
  }
  const specs = params.tables
    ? params.tables.map(syncSpecFor)
    : BIDIRECTIONAL_SYNC_REGISTRY;
  const scope = params.scope ?? getOfflineScope();
  const { db } = scope;
  if (scope.userId !== params.userId) throw new StaleOfflineScopeError();
  const now = params.now ?? Date.now;
  const total: PullStats = {
    pulled: 0,
    applied: 0,
    tombstones: 0,
    skippedStale: 0,
    conflicts: 0,
    checkpointsAdvanced: 0,
    failedTables: [],
    deferredTables: [],
    nextRetryAt: null,
  };

  for (const spec of specs) {
    assertOfflineScope(scope);
    const failureId = checkpointId(params.userId, spec.table);
    const priorFailure = await db.sync_pull_failures.get(failureId);
    if (priorFailure && priorFailure.nextRetryAt > now()) {
      total.deferredTables.push(spec.table);
      total.nextRetryAt = minimumRetry(total.nextRetryAt, priorFailure.nextRetryAt);
      continue;
    }
    try {
      let checkpoint = await db.sync_checkpoints.get(failureId);
      for (;;) {
        assertOfflineScope(scope);
        const rows = await fetchPage({
          client: params.client,
          userId: params.userId,
          spec,
          cursor: checkpoint
            ? {
                serverUpdatedAt: checkpoint.server_updated_at,
                stableKey: checkpoint.stable_key,
              }
            : null,
          limit: pageSize,
        });
        assertOfflineScope(scope);
        if (rows.length === 0) break;
        if (rows.length > pageSize)
          throw new Error('Sync page exceeded its requested limit');
        const priorCursor = checkpoint
          ? {
              serverUpdatedAt: checkpoint.server_updated_at,
              stableKey: checkpoint.stable_key,
            }
          : null;
        if (
          priorCursor &&
          rows.some(
            (row) =>
              compareSyncCursor(
                rowCursor(spec, parseRecord(spec, params.userId, row)),
                priorCursor,
              ) <= 0,
          )
        ) {
          throw new Error(`Non-advancing ${spec.table} sync page`);
        }
        const page = await applyPullPage(
          { userId: params.userId, table: spec.table, rows },
          { scope },
        );
        total.pulled += page.pulled;
        total.applied += page.applied;
        total.tombstones += page.tombstones;
        total.skippedStale += page.skippedStale;
        total.conflicts += page.conflicts;
        total.checkpointsAdvanced += page.checkpointsAdvanced;
        checkpoint = await db.sync_checkpoints.get(failureId);
        if (rows.length < pageSize) break;
      }
      await db.sync_pull_failures.delete(failureId);
    } catch (error) {
      if (error instanceof StaleOfflineScopeError || isUnauthorizedError(error))
        throw error;
      assertOfflineScope(scope);
      const attempt = (priorFailure?.attempt ?? 0) + 1;
      const nextRetryAt = now() + backoffMs(attempt - 1);
      await db.sync_pull_failures.put({
        id: failureId,
        user_id: params.userId,
        table: spec.table,
        attempt,
        nextRetryAt,
        lastError: pullErrorCode(error),
        updatedAt: now(),
      });
      total.failedTables.push(spec.table);
      total.nextRetryAt = minimumRetry(total.nextRetryAt, nextRetryAt);
    }
  }
  return total;
}

function minimumRetry(current: number | null, candidate: number): number {
  return current === null ? candidate : Math.min(current, candidate);
}

function pullErrorCode(error: unknown): string {
  if (error instanceof TypeError) return 'network';
  if (error instanceof Error && error.message.toLowerCase().includes('fetch'))
    return 'network';
  return 'invalid-page';
}
