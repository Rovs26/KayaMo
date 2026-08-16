export type { DbClient } from './client';
export { DbQueryError, isUnauthorizedError, isUniqueViolation } from './errors';
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
  insertCanonicalFood,
  insertServings,
  insertUserFood,
  listFoodsBySource,
  listServings,
  listVisibleFoods,
  tombstoneUserFood,
} from './foods';
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
