import { getOfflineDb, queueItemId, type SyncQueueItem, type SyncableTable } from './db';
import { notifySyncStatus } from './status';

export async function enqueueUpsert(
  table: SyncableTable,
  entityId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const db = getOfflineDb();
  const owner = payload.user_id ?? payload.created_by;
  if (typeof owner !== 'string' || owner.length === 0) {
    throw new Error(`Cannot queue ${table} without an owner`);
  }
  const item: SyncQueueItem = {
    id: queueItemId(table, entityId, owner),
    userId: owner,
    table,
    entityId,
    payload,
    attempt: 0,
    nextAttemptAt: Date.now(),
    lastError: null,
  };
  await db.sync_queue.put(item);
  notifySyncStatus();
}

export async function pendingCount(userId?: string): Promise<number> {
  return userId
    ? getOfflineDb().sync_queue.where('userId').equals(userId).count()
    : getOfflineDb().sync_queue.count();
}

export async function dueQueueItems(
  now = Date.now(),
  userId?: string,
): Promise<SyncQueueItem[]> {
  const due = await getOfflineDb().sync_queue
    .where('nextAttemptAt')
    .belowOrEqual(now)
    .sortBy('nextAttemptAt');
  return userId ? due.filter((item) => item.userId === userId) : due;
}

export async function markQueueFailure(item: SyncQueueItem, nextAttemptAt: number, lastError: string): Promise<void> {
  await getOfflineDb().sync_queue.put({
    ...item,
    attempt: item.attempt + 1,
    nextAttemptAt,
    lastError,
  });
  notifySyncStatus();
}

export async function removeQueueItem(id: string): Promise<void> {
  await getOfflineDb().sync_queue.delete(id);
  notifySyncStatus();
}
