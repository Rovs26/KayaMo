import type { DbClient } from '@kayamo/db';
import { incomingWins } from '@kayamo/db';
import type { Table } from 'dexie';
import {
  checkpointId,
  getOfflineDb,
  queueItemId,
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
};

function compareCursor(left: SyncCursor, right: SyncCursor): number {
  const time = left.serverUpdatedAt.localeCompare(right.serverUpdatedAt);
  return time === 0 ? left.stableKey.localeCompare(right.stableKey) : time;
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
    !Number.isFinite(new Date(serverUpdatedAt).getTime())
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
  table: SyncableTable,
  entityId: string,
  userId: string,
): Promise<SyncQueueItem | undefined> {
  const db = getOfflineDb();
  const current = await db.sync_queue.get(queueItemId(table, entityId, userId));
  if (current) return current;
  const legacy = await db.sync_queue.get(queueItemId(table, entityId));
  return legacy?.userId === userId ? legacy : undefined;
}

function isTombstone(row: Record<string, unknown>): boolean {
  return typeof row.deleted_at === 'string';
}

async function mergeRecord(
  spec: SyncTableSpec,
  table: Table<SyncRecord, string>,
  row: SyncRecord,
  userId: string,
): Promise<'applied' | 'tombstone' | 'skipped' | 'conflict'> {
  const key = row[spec.stableKeyColumn] as string;
  const existing = await table.get(key);
  const queued = await findQueuedMutation(spec.table, key, userId);
  const remoteDeleted = spec.tombstones && isTombstone(row);
  const localDeleted = existing ? isTombstone(existing) : false;
  const queuedDeleted = queued ? isTombstone(queued.payload) : false;

  // KayaMo tombstones are irreversible on the server. Delete therefore wins
  // over a stale live row in either direction.
  if (remoteDeleted) {
    await table.put(row);
    if (queued) await getOfflineDb().sync_queue.delete(queued.id);
    return 'tombstone';
  }
  if (localDeleted || queuedDeleted) return 'skipped';

  if (spec.table === 'companion_events') {
    const eventKey = row.event_key;
    if (typeof eventKey !== 'string') throw new Error('Malformed companion event');
    const duplicate = await getOfflineDb().companion_events
      .where('[user_id+event_key]')
      .equals([userId, eventKey])
      .first();
    if (duplicate && duplicate.id !== key) {
      await getOfflineDb().companion_events.delete(duplicate.id);
    }
    await table.put(row);
    if (queued) await getOfflineDb().sync_queue.delete(queued.id);
    return 'applied';
  }

  const remoteUpdatedAt = row.updated_at as string;
  if (queued) {
    const localUpdatedAt = queuedTimestamp(queued);
    if (!localUpdatedAt || !incomingWins(localUpdatedAt, remoteUpdatedAt)) {
      return 'skipped';
    }
    await table.put(row);
    await getOfflineDb().sync_queue.delete(queued.id);
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
    .sort((left, right) => compareCursor(rowCursor(spec, left), rowCursor(spec, right)));
  const stats: PullStats = {
    pulled: rows.length,
    applied: 0,
    tombstones: 0,
    skippedStale: 0,
    conflicts: 0,
    checkpointsAdvanced: 0,
  };
  if (rows.length === 0) return stats;

  const db = getOfflineDb();
  const localTable = db.table<SyncRecord, string>(spec.table);
  await db.transaction(
    'rw',
    localTable,
    db.sync_queue,
    db.sync_checkpoints,
    db.companion_events,
    async () => {
      for (const row of rows) {
        const result = await mergeRecord(spec, localTable, row, params.userId);
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
      const cursor = rowCursor(spec, rows.at(-1)!);
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
}): Promise<PullStats> {
  const fetchPage = params.fetchPage ?? fetchServerSyncPage;
  const pageSize = params.pageSize ?? 100;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) {
    throw new Error('Sync page size must be between 1 and 500');
  }
  const specs = params.tables
    ? params.tables.map(syncSpecFor)
    : BIDIRECTIONAL_SYNC_REGISTRY;
  const total: PullStats = {
    pulled: 0,
    applied: 0,
    tombstones: 0,
    skippedStale: 0,
    conflicts: 0,
    checkpointsAdvanced: 0,
  };

  for (const spec of specs) {
    let checkpoint = await getOfflineDb().sync_checkpoints.get(
      checkpointId(params.userId, spec.table),
    );
    for (;;) {
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
      if (rows.length === 0) break;
      if (rows.length > pageSize) throw new Error('Sync page exceeded its requested limit');
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
            compareCursor(rowCursor(spec, parseRecord(spec, params.userId, row)), priorCursor) <=
            0,
        )
      ) {
        throw new Error(`Non-advancing ${spec.table} sync page`);
      }
      const page = await applyPullPage({
        userId: params.userId,
        table: spec.table,
        rows,
      });
      total.pulled += page.pulled;
      total.applied += page.applied;
      total.tombstones += page.tombstones;
      total.skippedStale += page.skippedStale;
      total.conflicts += page.conflicts;
      total.checkpointsAdvanced += page.checkpointsAdvanced;
      checkpoint = await getOfflineDb().sync_checkpoints.get(
        checkpointId(params.userId, spec.table),
      );
      if (rows.length < pageSize) break;
    }
  }
  return total;
}
