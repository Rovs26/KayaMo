import { z } from 'zod';

export const nutrientsPer100gSchema = z.object({
  kcal: z.number().nonnegative(),
  protein_g: z.number().nonnegative(),
  carbs_g: z.number().nonnegative(),
  fat_g: z.number().nonnegative(),
  fiber_g: z.number().nonnegative(),
  sugar_g: z.number().nonnegative(),
  sodium_mg: z.number().nonnegative(),
});

export const servingSchema = z.object({
  label: z.string().min(1),
  grams: z.number().positive(),
  isDefault: z.boolean().optional(),
});

export const remoteSourceSchema = z.enum(['usda_fdc', 'off']);

export const normalizedFoodSchema = z.object({
  name: z.string().min(1),
  brand: z.string().min(1).optional(),
  barcode: z.string().min(1).optional(),
  per100g: nutrientsPer100gSchema,
  servings: z.array(servingSchema).min(1),
  source: remoteSourceSchema,
  sourceId: z.string().min(1),
  confidence: z.number().min(0).max(1),
  attribution: z.string().min(1).optional(),
  sourceNote: z.string().min(1).optional(),
});

export type NutrientsPer100g = z.infer<typeof nutrientsPer100gSchema>;
export type FoodServing = z.infer<typeof servingSchema>;
export type RemoteSource = z.infer<typeof remoteSourceSchema>;
export type NormalizedFood = z.infer<typeof normalizedFoodSchema>;

export class FoodSourceError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'FoodSourceError';
    this.status = status;
  }
}
