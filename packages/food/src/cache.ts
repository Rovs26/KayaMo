import type { DbClient, Food, FoodInsert, Serving, ServingInsert } from '@kayamo/db';
import {
  DbQueryError,
  getFoodBySource,
  insertCanonicalFood,
  insertServings,
  isUniqueViolation,
} from '@kayamo/db';
import { toConfidenceString, toNutrientString } from './numeric';
import type { NormalizedFood } from './types';

export type CanonicalFoodStore = {
  getBySource(source: string, sourceId: string): Promise<Food | null>;
  insertFood(row: FoodInsert): Promise<Food>;
  insertServings(rows: ServingInsert[]): Promise<Serving[]>;
};

function canonicalSource(
  source: string,
): 'ph_core' | 'usda_fdc' | 'off' | 'llm' {
  if (source === 'ph_core' || source === 'usda_fdc' || source === 'off' || source === 'llm') {
    return source;
  }
  throw new DbQueryError('canonical cache requires a non-user source');
}

export function supabaseCanonicalStore(client: DbClient): CanonicalFoodStore {
  return {
    getBySource: (source, sourceId) => getFoodBySource(client, source, sourceId),
    insertFood: (row) => {
      const source = canonicalSource(row.source);
      if (!row.source_id) {
        throw new DbQueryError('canonical cache requires source_id');
      }
      return insertCanonicalFood(client, {
        ...row,
        source,
        source_id: row.source_id,
      });
    },
    insertServings: (rows) => insertServings(client, rows),
  };
}

export function normalizedToFoodInsert(food: NormalizedFood, updatedAt = new Date().toISOString()): FoodInsert {
  return {
    source: food.source,
    source_id: food.sourceId,
    name: food.name,
    brand: food.brand ?? null,
    barcode: food.barcode ?? null,
    kcal: toNutrientString(food.per100g.kcal),
    protein_g: toNutrientString(food.per100g.protein_g),
    carbs_g: toNutrientString(food.per100g.carbs_g),
    fat_g: toNutrientString(food.per100g.fat_g),
    fiber_g: toNutrientString(food.per100g.fiber_g),
    sugar_g: toNutrientString(food.per100g.sugar_g),
    sodium_mg: toNutrientString(food.per100g.sodium_mg),
    confidence: toConfidenceString(food.confidence),
    attribution: food.attribution ?? null,
    source_note: food.sourceNote ?? null,
    updated_at: updatedAt,
  };
}

function servingsInsert(foodId: string, food: NormalizedFood, updatedAt: string): ServingInsert[] {
  return food.servings.map((serving) => ({
    food_id: foodId,
    label: serving.label,
    grams_equivalent: toNutrientString(serving.grams),
    is_default: serving.isDefault === true,
    updated_at: updatedAt,
  }));
}

export async function cacheOnFirstHit(
  store: CanonicalFoodStore,
  food: NormalizedFood,
): Promise<Food> {
  const existing = await store.getBySource(food.source, food.sourceId);
  if (existing) return existing;

  const updatedAt = new Date().toISOString();
  const insert = normalizedToFoodInsert(food, updatedAt);
  try {
    const created = await store.insertFood(insert);
    if (food.servings.length > 0) {
      await store.insertServings(servingsInsert(created.id, food, updatedAt));
    }
    return created;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const raced = await store.getBySource(food.source, food.sourceId);
    if (raced) return raced;
    throw error;
  }
}
