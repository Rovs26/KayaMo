import { z } from 'zod';

export const PH_CORE_CATEGORIES = ['staple', 'ulam', 'merienda'] as const;
export type PhCoreCategory = (typeof PH_CORE_CATEGORIES)[number];

export const phCoreServingSchema = z.object({
  label: z.string().min(1),
  grams: z.number().positive(),
  is_default: z.boolean().optional(),
});

export const phCorePer100gSchema = z.object({
  kcal: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  fiber: z.number().nonnegative(),
  sugar: z.number().nonnegative(),
  sodium_mg: z.number().nonnegative(),
});

export const phCoreFoodSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'id must be a lowercase slug'),
  name: z.string().min(1),
  name_tl: z.array(z.string().min(1)).min(1),
  category: z.enum(['staple', 'ulam', 'merienda']),
  per100g: phCorePer100gSchema,
  servings: z.array(phCoreServingSchema).min(1),
  typical_prep: z.string().min(1),
  source_note: z.string().min(1),
  confidence: z.number().min(0).max(1),
  verified: z.boolean().optional().default(false),
});

export const phCoreFileSchema = z.object({
  foods: z.array(phCoreFoodSchema).min(1),
});

export type PhCoreServing = z.infer<typeof phCoreServingSchema>;
export type PhCorePer100g = z.infer<typeof phCorePer100gSchema>;
export type PhCoreFood = z.infer<typeof phCoreFoodSchema>;
export type PhCoreFile = z.infer<typeof phCoreFileSchema>;

export const ATWATER_PROTEIN = 4;
export const ATWATER_CARBS = 4;
export const ATWATER_FAT = 9;
export const ATWATER_TOLERANCE = 0.05;
export const UNVERIFIED_CONFIDENCE_MAX = 0.8;
