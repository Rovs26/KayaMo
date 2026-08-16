import type { PhCoreFoodRow } from '@kayamo/db';
import { toConfidenceString, toNutrientString } from '../numeric';
import type { PhCoreFood } from './schema';

export function toPhCoreFoodRow(food: PhCoreFood): PhCoreFoodRow {
  const defaultIndex = food.servings.findIndex((serving) => serving.is_default === true);
  return {
    sourceId: food.id,
    name: food.name,
    nameTl: food.name_tl,
    kcal: toNutrientString(food.per100g.kcal),
    protein_g: toNutrientString(food.per100g.protein),
    carbs_g: toNutrientString(food.per100g.carbs),
    fat_g: toNutrientString(food.per100g.fat),
    fiber_g: toNutrientString(food.per100g.fiber),
    sugar_g: toNutrientString(food.per100g.sugar),
    sodium_mg: toNutrientString(food.per100g.sodium_mg),
    confidence: toConfidenceString(food.confidence),
    sourceNote: food.source_note.trim(),
    verified: food.verified === true,
    servings: food.servings.map((serving, index) => ({
      label: serving.label,
      grams: toNutrientString(serving.grams),
      isDefault: serving.is_default === true || (defaultIndex < 0 && index === 0),
    })),
  };
}
