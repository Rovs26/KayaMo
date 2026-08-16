import type { DbClient, Food, Serving } from '@kayamo/db';
import {
  getFoodsByBarcode,
  getFoodsByIds,
  getFoodLogCounts,
  listFoodAliases,
  listServingsByFoodIds,
  searchFoods,
} from '@kayamo/db';
import type { CatalogFood, ResolveCatalog } from './catalog';
import { fromNumericString } from './numeric';
import type { ResolveSource } from './score';
import type { FoodServing } from './types';

function asResolveSource(source: string): ResolveSource | null {
  if (
    source === 'user' ||
    source === 'ph_core' ||
    source === 'usda_fdc' ||
    source === 'off' ||
    source === 'llm'
  ) {
    return source;
  }
  return null;
}

function servingsFor(rows: Serving[]): FoodServing[] {
  return rows.map((row) => ({
    label: row.label,
    grams: fromNumericString(row.grams_equivalent),
    isDefault: row.is_default,
  }));
}

export function foodRowToCatalog(food: Food, servings: Serving[], aliases: string[]): CatalogFood {
  const source = asResolveSource(food.source) ?? 'user';
  return {
    id: food.id,
    source,
    sourceId: food.source_id,
    name: food.name,
    nameTl: food.name_tl ?? [],
    aliases: [...(food.name_tl ?? []), ...aliases],
    brand: food.brand,
    barcode: food.barcode,
    per100g: {
      kcal: fromNumericString(food.kcal),
      protein_g: fromNumericString(food.protein_g),
      carbs_g: fromNumericString(food.carbs_g),
      fat_g: fromNumericString(food.fat_g),
      fiber_g: fromNumericString(food.fiber_g),
      sugar_g: fromNumericString(food.sugar_g),
      sodium_mg: fromNumericString(food.sodium_mg),
    },
    confidence: fromNumericString(food.confidence),
    servings: servingsFor(servings),
    createdBy: food.created_by,
    ...(food.verified_by_user ? { verified: true } : {}),
    ...(food.attribution ? { attribution: food.attribution } : {}),
    ...(food.source_note ? { sourceNote: food.source_note } : {}),
  };
}

async function hydrate(client: DbClient, foods: Food[]): Promise<CatalogFood[]> {
  const ids = foods.map((food) => food.id);
  const [servings, aliases] = await Promise.all([
    listServingsByFoodIds(client, ids),
    listFoodAliases(client, ids),
  ]);
  return foods.map((food) =>
    foodRowToCatalog(food, servings.get(food.id) ?? [], aliases.get(food.id) ?? []),
  );
}

export function supabaseResolveCatalog(client: DbClient): ResolveCatalog {
  return {
    async searchLocal(query) {
      if (!query.name) return [];
      const hits = await searchFoods(client, query.name, 25);
      const foods = await getFoodsByIds(
        client,
        hits.map((hit) => hit.food_id),
      );
      return hydrate(client, foods);
    },
    async getByBarcode(barcode) {
      const foods = await getFoodsByBarcode(client, barcode);
      return hydrate(client, foods);
    },
    async getLogCounts(userId, foodIds) {
      return getFoodLogCounts(client, { userId, foodIds });
    },
  };
}
