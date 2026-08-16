export type { DbClient } from './client';
export { DbQueryError, isMissingRpcError, isUnauthorizedError, isUniqueViolation } from './errors';
export {
  clampUpdatedAt,
  clampUpdatedAtIso,
  incomingWins,
  omitServerCursor,
} from './lww';
export {
  insertFoodEntry,
  listFoodEntriesByLogicalDate,
  tombstoneFoodEntry,
  upsertFoodEntry,
} from './food-entries';
export type { FoodEntryWrite, UpsertResult } from './food-entries';
export {
  getFood,
  getFoodBySource,
  getFoodsByBarcode,
  getFoodsByIds,
  getFoodLogCounts,
  insertCanonicalFood,
  insertServings,
  insertUserFood,
  listFoodAliases,
  listFoodsBySource,
  listServings,
  listServingsByFoodIds,
  listVisibleFoods,
  searchFoods,
  tombstoneUserFood,
} from './foods';
export type { FoodSearchHit } from './foods';
export { getProfile, updateProfile } from './profiles';
export { insertWeightLog, listWeightLogsByLogicalDate, tombstoneWeightLog } from './weight-logs';
export {
  insertWorkout,
  listWorkoutSets,
  listWorkoutsByLogicalDate,
  tombstoneWorkout,
  tombstoneWorkoutSet,
} from './workouts';
export { listAgentRuns, markAgentRunScrubbed } from './agent';
