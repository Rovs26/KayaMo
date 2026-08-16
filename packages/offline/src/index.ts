export const PACKAGE = '@kayamo/offline';

export { backoffMs } from './backoff';
export { getOfflineDb, resetOfflineDb, type KayaMoDB } from './db';
export type {
  LocalFood,
  LocalFoodEntry,
  LocalMealTemplate,
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
  listCachedFoodsWithServings,
} from './foods-cache';
export { useLiveFoodEntries, useLiveFoodHistory, useLiveMealTemplates, useSyncStatus } from './hooks';
export { localHourFromInstant, logicalDateFromInstant } from './logical-date';
export { enqueueUpsert, pendingCount } from './queue';
export { getSyncStatusSnapshot, startSync, type SyncDeps, type SyncStatus } from './sync';
export {
  listLocalFoodEntries,
  listLocalFoodHistory,
  listLocalMealTemplates,
  logFoodEntries,
  logFoodEntry,
  logWeight,
  logWorkout,
  mergeRemoteFoodEntries,
  mergeRemoteMealTemplates,
  saveMealTemplate,
  tombstoneLocalFoodEntries,
  tombstoneLocalFoodEntry,
  tombstoneLocalMealTemplate,
  type LogFoodEntryInput,
} from './writes';
