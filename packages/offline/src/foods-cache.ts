import type { Food, Serving } from '@kayamo/db';
import { getOfflineDb } from './db';

export async function cacheFood(food: Food): Promise<void> {
  await getOfflineDb().foods.put(food);
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
}

export async function getCachedFood(id: string): Promise<Food | undefined> {
  const food = await getOfflineDb().foods.get(id);
  if (!food || food.deleted_at) return undefined;
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
