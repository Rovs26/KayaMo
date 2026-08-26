import type { Food, Serving } from '@kayamo/db';
import { getOfflineDb } from './db';

/** iOS Safari quotas are tight. Cap remote catalog rows; never evict user or PH-core foods. */
export const FOOD_CACHE_MAX = 400;

const EVICTABLE = new Set(['usda_fdc', 'off']);

async function touchAccess(id: string): Promise<void> {
  await getOfflineDb().food_cache_access.put({ id, accessed_at: Date.now() });
}

export async function evictFoodCacheLru(max = FOOD_CACHE_MAX): Promise<number> {
  const db = getOfflineDb();
  const foods = (await db.foods.toArray()).filter(
    (row) => !row.deleted_at && EVICTABLE.has(row.source),
  );
  if (foods.length <= max) return 0;

  const access = await db.food_cache_access.bulkGet(foods.map((row) => row.id));
  const accessedAt = new Map<string, number>();
  foods.forEach((food, index) => {
    accessedAt.set(food.id, access[index]?.accessed_at ?? 0);
  });
  const ranked = [...foods].sort(
    (a, b) => (accessedAt.get(a.id) ?? 0) - (accessedAt.get(b.id) ?? 0),
  );
  const overflow = ranked.slice(0, foods.length - max);
  const ids = overflow.map((row) => row.id);
  await db.transaction('rw', db.foods, db.servings, db.food_cache_access, async () => {
    await db.foods.bulkDelete(ids);
    await db.food_cache_access.bulkDelete(ids);
    for (const id of ids) {
      await db.servings.where('food_id').equals(id).delete();
    }
  });
  return ids.length;
}

export async function cacheFood(food: Food): Promise<void> {
  await getOfflineDb().foods.put(food);
  await touchAccess(food.id);
  await evictFoodCacheLru();
}

export async function cacheFoodWithServings(food: Food, servings: Serving[]): Promise<void> {
  const db = getOfflineDb();
  await db.transaction('rw', db.foods, db.servings, async () => {
    await db.foods.put(food);
    await db.servings.where('food_id').equals(food.id).delete();
    if (servings.length > 0) {
      await db.servings.bulkPut(servings);
    }
  });
  await touchAccess(food.id);
  await evictFoodCacheLru();
}

export async function getCachedFood(id: string): Promise<Food | undefined> {
  const food = await getOfflineDb().foods.get(id);
  if (!food || food.deleted_at) return undefined;
  await touchAccess(id);
  return food;
}

export async function getCachedServings(foodId: string): Promise<Serving[]> {
  return getOfflineDb().servings.where('food_id').equals(foodId).toArray();
}

export async function listCachedFoodsWithServings(): Promise<
  Array<{ food: Food; servings: Serving[] }>
> {
  const db = getOfflineDb();
  const foods = (await db.foods.toArray()).filter((row) => !row.deleted_at);
  const servings = await db.servings.toArray();
  const byFood = new Map<string, Serving[]>();
  for (const serving of servings) {
    const list = byFood.get(serving.food_id) ?? [];
    list.push(serving);
    byFood.set(serving.food_id, list);
  }
  return foods.map((food) => ({ food, servings: byFood.get(food.id) ?? [] }));
}

export async function getFoodReadThrough(
  id: string,
  fetchRemote: () => Promise<Food | null>,
): Promise<Food | null> {
  const cached = await getCachedFood(id);
  if (cached) return cached;
  try {
    const remote = await fetchRemote();
    if (remote) await cacheFood(remote);
    return remote;
  } catch {
    return cached ?? null;
  }
}
