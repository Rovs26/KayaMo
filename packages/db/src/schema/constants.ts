export const FOOD_SOURCES = ['ph_core', 'usda_fdc', 'off', 'user', 'llm'] as const;
export type FoodSource = (typeof FOOD_SOURCES)[number];

export const MEAL_SLOTS = ['almusal', 'tanghalian', 'hapunan', 'meryenda'] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export const INPUT_METHODS = ['search', 'chat', 'photo', 'barcode', 'quick'] as const;
export type InputMethod = (typeof INPUT_METHODS)[number];

export const RESOLVED_VIA = ['ph_core', 'usda_fdc', 'off', 'user', 'llm', 'recipe'] as const;
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

export const sqlIn = (values: readonly string[]) =>
  values.map((value) => `'${value}'`).join(', ');
