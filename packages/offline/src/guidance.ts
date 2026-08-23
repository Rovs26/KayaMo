import type { GuidanceSnapshot } from '@kayamo/core';
import { getOfflineDb, type LocalGuidanceSnapshot } from './db';

/**
 * Guidance is derived server-side from confirmed records, so the device keeps
 * a read cache rather than an editable copy. Nothing here enters the sync
 * queue; a stale snapshot is replaced whole on the next successful fetch.
 */
export async function cacheGuidanceSnapshot(
  userId: string,
  snapshot: GuidanceSnapshot,
): Promise<void> {
  await getOfflineDb().guidance_snapshots.put({
    user_id: userId,
    snapshot,
    cached_at: new Date().toISOString(),
  });
}

export async function getCachedGuidanceSnapshot(
  userId: string,
): Promise<LocalGuidanceSnapshot | null> {
  return (await getOfflineDb().guidance_snapshots.get(userId)) ?? null;
}

export async function clearCachedGuidanceSnapshot(userId: string): Promise<void> {
  await getOfflineDb().guidance_snapshots.delete(userId);
}
