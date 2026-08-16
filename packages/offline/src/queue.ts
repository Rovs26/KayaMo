import { getOfflineDb, queueItemId, type SyncQueueItem, type SyncableTable } from './db';
import { notifySyncStatus } from './status';

export async function enqueueUpsert(
  table: SyncableTable,
  entityId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const db = getOfflineDb();
  const item: SyncQueueItem = {
    id: queueItemId(table, entityId),
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

export async function pendingCount(): Promise<number> {
  return getOfflineDb().sync_queue.count();
}

export async function dueQueueItems(now = Date.now()): Promise<SyncQueueItem[]> {
  return getOfflineDb().sync_queue.where('nextAttemptAt').belowOrEqual(now).sortBy('nextAttemptAt');
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
