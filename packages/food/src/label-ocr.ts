import { z } from 'zod';
import { toConfidenceString, toNutrientString } from './numeric';
import { nutrientsPer100gSchema, type FoodServing, type NutrientsPer100g } from './types';

export const USER_FOOD_CONFIDENCE_MAX = 0.8;
export const OCR_LOW_CONFIDENCE = 0.6;

export const NUTRIENT_KEYS = [
  'kcal',
  'protein_g',
  'carbs_g',
  'fat_g',
  'fiber_g',
  'sugar_g',
  'sodium_mg',
] as const;

export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

const optionalNonNeg = z.number().nonnegative().optional();
const optionalPositive = z.number().positive().optional();

export const ocrFieldConfidenceSchema = z.object({
  productName: z.number().min(0).max(1).optional(),
  brand: z.number().min(0).max(1).optional(),
  servingGrams: z.number().min(0).max(1).optional(),
  servingsPerPack: z.number().min(0).max(1).optional(),
  kcal: z.number().min(0).max(1).optional(),
  protein_g: z.number().min(0).max(1).optional(),
  carbs_g: z.number().min(0).max(1).optional(),
  fat_g: z.number().min(0).max(1).optional(),
  fiber_g: z.number().min(0).max(1).optional(),
  sugar_g: z.number().min(0).max(1).optional(),
  sodium_mg: z.number().min(0).max(1).optional(),
});

/** Strict OCR extract. Missing numbers stay omitted — never invented. */
export const nutritionLabelOcrSchema = z.object({
  productName: z.string().min(1).optional(),
  brand: z.string().min(1).optional(),
  servingSizeText: z.string().min(1).optional(),
  servingGrams: optionalPositive,
  servingsPerPack: optionalPositive,
  basis: z.enum(['per_serving', 'per_100g']),
  kcal: optionalNonNeg,
  protein_g: optionalNonNeg,
  carbs_g: optionalNonNeg,
  fat_g: optionalNonNeg,
  fiber_g: optionalNonNeg,
  sugar_g: optionalNonNeg,
  sodium_mg: optionalNonNeg,
  fieldConfidence: ocrFieldConfidenceSchema.optional(),
  overallConfidence: z.number().min(0).max(1),
});

export type NutritionLabelOcr = z.infer<typeof nutritionLabelOcrSchema>;

export const userFoodConfirmSchema = z.object({
  name: z.string().trim().min(1).max(200),
  brand: z.string().trim().min(1).max(120).optional(),
  barcode: z.string().regex(/^\d{8,14}$/).optional(),
  nameTl: z.array(z.string().trim().min(1)).max(12).optional(),
  servingLabel: z.string().trim().min(1).max(80),
  servingGrams: z.number().positive(),
  per100g: nutrientsPer100gSchema,
  shared: z.boolean(),
  contributeToOff: z.boolean(),
  confidence: z.number().min(0).max(USER_FOOD_CONFIDENCE_MAX),
});

export type UserFoodConfirm = z.infer<typeof userFoodConfirmSchema>;

export type UserFoodDraft = {
  name?: string;
  brand?: string;
  barcode?: string;
  servingLabel: string;
  servingGrams?: number;
  servingsPerPack?: number;
  basis: 'per_serving' | 'per_100g';
  labeled: Partial<NutrientsPer100g>;
  per100g: Partial<NutrientsPer100g>;
  missing: string[];
  lowConfidence: string[];
  overallConfidence: number;
  canSave: boolean;
};

const SAVE_FIELDS = ['name', 'servingGrams', ...NUTRIENT_KEYS] as const;

function labeledFromOcr(ocr: NutritionLabelOcr): Partial<NutrientsPer100g> {
  const labeled: Partial<NutrientsPer100g> = {};
  for (const key of NUTRIENT_KEYS) {
    const value = ocr[key];
    if (value !== undefined) labeled[key] = value;
  }
  return labeled;
}

export function nutrientsFromLabel(input: {
  basis: 'per_serving' | 'per_100g';
  servingGrams?: number;
  labeled: Partial<NutrientsPer100g>;
}): Partial<NutrientsPer100g> {
  if (input.basis === 'per_100g') return { ...input.labeled };
  if (input.servingGrams === undefined || input.servingGrams <= 0) return {};
  const factor = 100 / input.servingGrams;
  const per100g: Partial<NutrientsPer100g> = {};
  for (const key of NUTRIENT_KEYS) {
    const value = input.labeled[key];
    if (value === undefined) continue;
    per100g[key] = value * factor;
  }
  return per100g;
}

function fieldConf(
  ocr: NutritionLabelOcr,
  field: keyof z.infer<typeof ocrFieldConfidenceSchema>,
): number {
  return ocr.fieldConfidence?.[field] ?? ocr.overallConfidence;
}

export function draftFromOcr(ocr: NutritionLabelOcr, barcode?: string): UserFoodDraft {
  const parsed = nutritionLabelOcrSchema.parse(ocr);
  const servingGrams =
    parsed.servingGrams ?? (parsed.basis === 'per_100g' ? 100 : undefined);
  const labeled = labeledFromOcr(parsed);
  const per100g = nutrientsFromLabel({
    basis: parsed.basis,
    servingGrams,
    labeled,
  });

  const missing: string[] = [];
  for (const key of SAVE_FIELDS) {
    if (key === 'name' && !parsed.productName?.trim()) missing.push('name');
    else if (key === 'servingGrams' && servingGrams === undefined) missing.push('servingGrams');
    else if (key !== 'name' && key !== 'servingGrams' && per100g[key] === undefined) {
      missing.push(key);
    }
  }

  const lowConfidence: string[] = [];
  if (parsed.productName && fieldConf(parsed, 'productName') < OCR_LOW_CONFIDENCE) {
    lowConfidence.push('name');
  }
  if (servingGrams !== undefined && fieldConf(parsed, 'servingGrams') < OCR_LOW_CONFIDENCE) {
    lowConfidence.push('servingGrams');
  }
  for (const key of NUTRIENT_KEYS) {
    if (parsed[key] === undefined) continue;
    if (fieldConf(parsed, key) < OCR_LOW_CONFIDENCE) lowConfidence.push(key);
  }

  const servingLabel =
    parsed.servingSizeText?.trim() ||
    (servingGrams !== undefined ? `${servingGrams} g` : '1 serving');

  return {
    ...(parsed.productName ? { name: parsed.productName.trim() } : {}),
    ...(parsed.brand ? { brand: parsed.brand.trim() } : {}),
    ...(barcode ? { barcode } : {}),
    servingLabel,
    ...(servingGrams !== undefined ? { servingGrams } : {}),
    ...(parsed.servingsPerPack !== undefined ? { servingsPerPack: parsed.servingsPerPack } : {}),
    basis: parsed.basis,
    labeled,
    per100g,
    missing,
    lowConfidence,
    overallConfidence: parsed.overallConfidence,
    canSave: missing.length === 0,
  };
}

export function confirmConfidence(ocrOverall: number): number {
  return Math.min(USER_FOOD_CONFIDENCE_MAX, Math.max(0.5, ocrOverall));
}

export type UserFoodRows = {
  food: {
    id: string;
    created_by: string;
    source: 'user';
    name: string;
    name_tl: string[];
    brand: string | null;
    barcode: string | null;
    kcal: string;
    protein_g: string;
    carbs_g: string;
    fat_g: string;
    fiber_g: string;
    sugar_g: string;
    sodium_mg: string;
    confidence: string;
    shared: boolean;
    verified_by_user: boolean;
    source_note: string;
    updated_at: string;
  };
  servings: FoodServing[];
  aliases: string[];
  contributeToOff: boolean;
};

export function userFoodToRows(
  confirm: UserFoodConfirm,
  userId: string,
  id: string = crypto.randomUUID(),
  updatedAt = new Date().toISOString(),
): UserFoodRows {
  const parsed = userFoodConfirmSchema.parse(confirm);
  const aliases = [
    parsed.name,
    ...(parsed.brand ? [parsed.brand] : []),
    ...(parsed.nameTl ?? []),
  ];
  return {
    food: {
      id,
      created_by: userId,
      source: 'user',
      name: parsed.name,
      name_tl: parsed.nameTl ?? [],
      brand: parsed.brand ?? null,
      barcode: parsed.barcode ?? null,
      kcal: toNutrientString(parsed.per100g.kcal),
      protein_g: toNutrientString(parsed.per100g.protein_g),
      carbs_g: toNutrientString(parsed.per100g.carbs_g),
      fat_g: toNutrientString(parsed.per100g.fat_g),
      fiber_g: toNutrientString(parsed.per100g.fiber_g),
      sugar_g: toNutrientString(parsed.per100g.sugar_g),
      sodium_mg: toNutrientString(parsed.per100g.sodium_mg),
      confidence: toConfidenceString(Math.min(USER_FOOD_CONFIDENCE_MAX, parsed.confidence)),
      shared: parsed.shared,
      verified_by_user: false,
      source_note:
        'User-confirmed nutrition facts label. Stored per 100 g from the labeled serving grams.',
      updated_at: updatedAt,
    },
    servings: [
      { label: parsed.servingLabel, grams: parsed.servingGrams, isDefault: true },
      ...(Math.abs(parsed.servingGrams - 100) < 0.05 ||
      parsed.servingLabel.trim().toLowerCase() === '100 g'
        ? []
        : [{ label: '100 g', grams: 100, isDefault: false }]),
    ],
    aliases: [...new Set(aliases.map((value) => value.trim()).filter(Boolean))],
    contributeToOff: parsed.contributeToOff,
  };
}
