export const FOOD_SOURCES = ['ph_core', 'usda_fdc', 'off', 'user', 'llm'] as const;
export type FoodSource = (typeof FOOD_SOURCES)[number];

export const MEAL_SLOTS = ['almusal', 'tanghalian', 'hapunan', 'meryenda'] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export const INPUT_METHODS = ['search', 'chat', 'photo', 'barcode', 'quick'] as const;
export type InputMethod = (typeof INPUT_METHODS)[number];

export const RESOLVED_VIA = [
  'ph_core',
  'usda_fdc',
  'off',
  'user',
  'llm',
  'recipe',
] as const;
export type ResolvedVia = (typeof RESOLVED_VIA)[number];

export const LOCALES = ['en', 'fil', 'taglish'] as const;
export type Locale = (typeof LOCALES)[number];

export const SEXES = ['female', 'male'] as const;
export type Sex = (typeof SEXES)[number];

export const GOALS = ['lose', 'maintain', 'gain'] as const;
export type Goal = (typeof GOALS)[number];

export const DAY_TYPES = ['training', 'rest', 'refeed', 'deload'] as const;
export type DayType = (typeof DAY_TYPES)[number];

export const WEIGHT_SOURCES = ['manual', 'health_sync'] as const;
export type WeightSource = (typeof WEIGHT_SOURCES)[number];

export const EXERCISE_SOURCES = ['canonical', 'user'] as const;
export type ExerciseSource = (typeof EXERCISE_SOURCES)[number];

export const WORKOUT_STATUSES = ['active', 'completed', 'abandoned'] as const;
export type WorkoutStatus = (typeof WORKOUT_STATUSES)[number];

export const WORKOUT_SET_TYPES = ['warmup', 'normal', 'dropset'] as const;
export type WorkoutSetType = (typeof WORKOUT_SET_TYPES)[number];

export const EXERCISE_MEDIA_TYPES = ['image', 'video'] as const;
export type ExerciseMediaType = (typeof EXERCISE_MEDIA_TYPES)[number];

export const GOAL_KINDS = ['goal', 'campaign', 'chapter'] as const;
export type GoalKind = (typeof GOAL_KINDS)[number];

export const GOAL_STATUSES = ['active', 'paused', 'completed', 'released'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const HABIT_FREQUENCIES = ['daily', 'weekly'] as const;
export type HabitFrequency = (typeof HABIT_FREQUENCIES)[number];

export const COMPANION_EVENT_TYPES = [
  'task_completed',
  'routine_completed',
  'habit_completed',
  'milestone_completed',
  'goal_completed',
  'workout_completed',
  'food_logged',
  'recovery_return',
] as const;
export type CompanionEventType = (typeof COMPANION_EVENT_TYPES)[number];

export const ACHIEVEMENT_METRICS = [
  'total_points',
  'event_count',
  'event_type_count',
] as const;
export type AchievementMetric = (typeof ACHIEVEMENT_METRICS)[number];

/** Coco-originated tasks exist only after the user confirms the proposal. */
export const TASK_ORIGINS = ['user', 'coco_confirmed'] as const;
export type TaskOrigin = (typeof TASK_ORIGINS)[number];

export const DAILY_ACTION_KINDS = ['task', 'routine', 'custom'] as const;
export type DailyActionKind = (typeof DAILY_ACTION_KINDS)[number];

export const FOCUS_SESSION_STATUSES = [
  'scheduled',
  'active',
  'completed',
  'cancelled',
] as const;
export type FocusSessionStatus = (typeof FOCUS_SESSION_STATUSES)[number];

export const LIFE_AREAS = [
  'physical',
  'mind',
  'emotions',
  'faith',
  'work',
  'relationships',
  'money',
  'purpose',
] as const;
export type LifeArea = (typeof LIFE_AREAS)[number];

export const PRIVACY_LEVELS = ['private', 'standard', 'shareable'] as const;
export type PrivacyLevel = (typeof PRIVACY_LEVELS)[number];

export const RECORD_PROVENANCE = [
  'user',
  'device',
  'external',
  'mus_inference',
  'mus_plan',
  'estimate',
] as const;
export type RecordProvenance = (typeof RECORD_PROVENANCE)[number];

export const INBOX_KINDS = ['note', 'obligation', 'idea', 'voice'] as const;
export type InboxKind = (typeof INBOX_KINDS)[number];

export const DAY_CAPACITIES = ['great', 'normal', 'low', 'overwhelmed', 'sick'] as const;
export type DayCapacity = (typeof DAY_CAPACITIES)[number];

export const DAY_INTENTS = [
  'focused',
  'calm',
  'recovery',
  'family',
  'get_things_done',
] as const;
export type DayIntent = (typeof DAY_INTENTS)[number];

export const PLAN_MODES = ['standard', 'minimum', 'rescue', 'restructure'] as const;
export type PlanMode = (typeof PLAN_MODES)[number];

export const sqlIn = (values: readonly string[]) =>
  values.map((value) => `'${value}'`).join(', ');
