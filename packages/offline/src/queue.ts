import {
  createMutationRevision,
  getOfflineDb,
  queueItemId,
  type KayaMoDB,
  type SyncQueueItem,
  type SyncableTable,
} from './db';
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
    revision: createMutationRevision(),
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

export async function pendingCount(
  userId?: string,
  db: KayaMoDB = getOfflineDb(),
): Promise<number> {
  return userId
    ? db.sync_queue.where('userId').equals(userId).count()
    : db.sync_queue.count();
}

export async function dueQueueItems(
  now = Date.now(),
  userId?: string,
  db: KayaMoDB = getOfflineDb(),
): Promise<SyncQueueItem[]> {
  const due = await db.sync_queue
    .where('nextAttemptAt')
    .belowOrEqual(now)
    .sortBy('nextAttemptAt');
  return userId ? due.filter((item) => item.userId === userId) : due;
}

export async function markQueueFailure(
  item: SyncQueueItem,
  nextAttemptAt: number,
  lastError: string,
  db: KayaMoDB = getOfflineDb(),
): Promise<boolean> {
  const updated = await db.transaction('rw', db.sync_queue, async () => {
    const current = await db.sync_queue.get(item.id);
    if (!current || current.revision !== item.revision) return false;
    await db.sync_queue.put({
      ...current,
      attempt: current.attempt + 1,
      nextAttemptAt,
      lastError,
    });
    return true;
  });
  notifySyncStatus();
  return updated;
}

export async function removeQueueItemIfUnchanged(
  item: SyncQueueItem,
  db: KayaMoDB = getOfflineDb(),
): Promise<boolean> {
  const removed = await db.transaction('rw', db.sync_queue, async () => {
    const current = await db.sync_queue.get(item.id);
    if (!current || current.revision !== item.revision) return false;
    await db.sync_queue.delete(item.id);
    return true;
  });
  notifySyncStatus();
  return removed;
}
