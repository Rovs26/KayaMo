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
  listFoodEntriesSince,
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
  insertFoodAliases,
  insertServings,
  insertUserFood,
  listFoodAliases,
  listFoodsBySource,
  listServings,
  listServingsByFoodIds,
  listVisibleFoods,
  queueOffContribute,
  searchFoods,
  tombstoneUserFood,
} from './foods';
export type { FoodSearchHit } from './foods';
export { getProfile, updateProfile } from './profiles';
export { insertWeightLog, listWeightLogsByLogicalDate, tombstoneWeightLog } from './weight-logs';
export {
  listMealTemplates,
  mealTemplateItemSchema,
  mealTemplateWriteSchema,
  tombstoneMealTemplate,
  upsertMealTemplate,
} from './meal-templates';
export type { MealTemplateWrite, UpsertMealTemplateResult } from './meal-templates';
export {
  insertWorkout,
  listWorkoutSets,
  listWorkoutsByLogicalDate,
  tombstoneWorkout,
  tombstoneWorkoutSet,
} from './workouts';
export { listAgentRuns, markAgentRunScrubbed } from './agent';
