export { PACKAGE, getPublicSupabaseEnv, getServiceSupabaseEnv, isDbTestConfigured, isSupabaseConfigured } from './env';
export { loadRootEnv } from './load-root-env';
export {
  createBrowserSupabase,
  createCookieSupabase,
  type CookieMethodsServer,
} from './client';
export type {
  AgentRun,
  Database,
  Food,
  FoodEntry,
  FoodEntryInsert,
  FoodInsert,
  Profile,
  Recipe,
  Serving,
  ServingInsert,
  WeightLog,
  Workout,
  WorkoutSet,
} from './database';
export {
  DbQueryError,
  isUnauthorizedError,
  isUniqueViolation,
  clampUpdatedAt,
  clampUpdatedAtIso,
  getFood,
  getFoodBySource,
  getProfile,
  incomingWins,
  insertCanonicalFood,
  insertFoodEntry,
  insertServings,
  insertUserFood,
  listFoodsBySource,
  insertWeightLog,
  insertWorkout,
  listAgentRuns,
  listFoodEntriesByLogicalDate,
  listServings,
  listVisibleFoods,
  listWeightLogsByLogicalDate,
  listWorkoutSets,
  listWorkoutsByLogicalDate,
  markAgentRunScrubbed,
  omitServerCursor,
  tombstoneFoodEntry,
  tombstoneUserFood,
  tombstoneWeightLog,
  tombstoneWorkout,
  tombstoneWorkoutSet,
  updateProfile,
  upsertFoodEntry,
} from './queries';
export { upsertPhCoreFoods } from './ph-core';
export type { PhCoreFoodRow } from './ph-core';
export type { DbClient, FoodEntryWrite, UpsertResult } from './queries';
