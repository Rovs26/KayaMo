export const PACKAGE = '@kayamo/offline';

export { backoffMs } from './backoff';
export { getOfflineDb, resetOfflineDb, type KayaMoDB } from './db';
export type {
  LocalFood,
  LocalFoodEntry,
  LocalServing,
  LocalWeightLog,
  LocalWorkout,
  LocalWorkoutSet,
  SyncQueueItem,
  SyncableTable,
} from './db';
export {
  cacheFood,
  cacheFoodWithServings,
  getCachedFood,
  getCachedServings,
  getFoodReadThrough,
} from './foods-cache';
export { useLiveFoodEntries, useSyncStatus } from './hooks';
export { logicalDateFromInstant } from './logical-date';
export { enqueueUpsert, pendingCount } from './queue';
export { getSyncStatusSnapshot, startSync, type SyncDeps, type SyncStatus } from './sync';
export {
  listLocalFoodEntries,
  logFoodEntry,
  logWeight,
  logWorkout,
  tombstoneLocalFoodEntry,
  type LogFoodEntryInput,
} from './writes';
