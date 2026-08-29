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
  type StoredSyncCheckpoint,
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
  serverSeq: number;
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
  server_seq: number;
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

export function compareSyncCursor(left: SyncCursor, right: SyncCursor): number {
  return left.serverSeq < right.serverSeq ? -1 : left.serverSeq > right.serverSeq ? 1 : 0;
}

function parseRecord(spec: SyncTableSpec, userId: string, value: unknown): SyncRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Malformed ${spec.table} sync row`);
  }
  const row = value as Record<string, unknown>;
  const owner = row[spec.ownerColumn];
  const stableKey = row[spec.stableKeyColumn];
  const serverSeq = row.server_seq;
  if (owner !== userId) throw new Error(`Owner mismatch in ${spec.table} sync row`);
  if (typeof stableKey !== 'string' || stableKey.length === 0) {
    throw new Error(`Missing stable key in ${spec.table} sync row`);
  }
  if (!Number.isSafeInteger(serverSeq) || (serverSeq as number) < 1) {
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
  return { ...row, server_seq: serverSeq as number };
}

function rowCursor(row: SyncRecord): SyncCursor {
  return {
    serverSeq: row.server_seq,
  };
}

function sequenceCursor(checkpoint: StoredSyncCheckpoint | undefined): SyncCursor | null {
  if (!checkpoint || checkpoint.cursor_version !== 2) return null;
  if (!Number.isSafeInteger(checkpoint.server_seq) || checkpoint.server_seq < 0) {
    throw new Error('Invalid local sequence checkpoint');
  }
  return { serverSeq: checkpoint.server_seq };
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
    .sort((left, right) => compareSyncCursor(rowCursor(left), rowCursor(right)));
  for (let index = 1; index < rows.length; index += 1) {
    if (rows[index - 1]!.server_seq >= rows[index]!.server_seq) {
      throw new Error(`Duplicate or non-advancing ${spec.table} server sequence`);
    }
  }
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
      const cursor = rowCursor(rows.at(-1)!);
      const currentCheckpoint = await db.sync_checkpoints.get(
        checkpointId(params.userId, params.table),
      );
      const currentCursor = sequenceCursor(currentCheckpoint);
      if (currentCursor && compareSyncCursor(cursor, currentCursor) <= 0) {
        return;
      }
      const checkpoint: SyncCheckpoint = {
        id: checkpointId(params.userId, params.table),
        user_id: params.userId,
        table: params.table,
        cursor_version: 2,
        server_seq: cursor.serverSeq,
        updatedAt: Date.now(),
      };
      await db.sync_checkpoints.put(checkpoint);
      stats.checkpointsAdvanced = 1;
    },
  );
  return stats;
}

async function fetchOrderedRows(request: PullPageRequest): Promise<unknown[]> {
  const client = request.client as unknown as SyncQueryClient;
  let query = client
    .from(request.spec.table)
    .select('*')
    .eq(request.spec.ownerColumn, request.userId);
  if (request.cursor) {
    query = query.gt('server_seq', String(request.cursor.serverSeq));
  }
  const { data, error } = await query
    .order('server_seq', { ascending: true })
    .limit(request.limit);
  if (error) throw error;
  return data ?? [];
}

export const fetchServerSyncPage: PullPageFetcher = async (request) => {
  return fetchOrderedRows(request);
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
      if (checkpoint && checkpoint.cursor_version !== 2) {
        // Timestamp checkpoints cannot be translated safely. Replace only this
        // table's checkpoint and replay its server feed from sequence zero.
        await db.sync_checkpoints.delete(failureId);
        checkpoint = undefined;
      }
      for (;;) {
        assertOfflineScope(scope);
        const rows = await fetchPage({
          client: params.client,
          userId: params.userId,
          spec,
          cursor: sequenceCursor(checkpoint),
          limit: pageSize,
        });
        assertOfflineScope(scope);
        if (rows.length === 0) break;
        if (rows.length > pageSize)
          throw new Error('Sync page exceeded its requested limit');
        const priorCursor = sequenceCursor(checkpoint);
        if (
          priorCursor &&
          rows.some(
            (row) =>
              compareSyncCursor(
                rowCursor(parseRecord(spec, params.userId, row)),
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
