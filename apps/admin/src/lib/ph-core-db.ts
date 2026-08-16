import { getFoodBySource, listFoodsBySource, listServings, type Food, type Serving } from '@kayamo/db';
import { createServiceSupabase } from '@kayamo/db/service';

export async function loadPhCoreDbIndex(): Promise<Map<string, { name: string; kcal: string }>> {
  try {
    const rows = await listFoodsBySource(createServiceSupabase(), 'ph_core');
    return new Map(
      rows.map((row) => [row.source_id ?? '', { name: row.name, kcal: row.kcal }]),
    );
  } catch {
    return new Map();
  }
}

export async function loadPhCoreDbFood(
  sourceId: string,
): Promise<{ food: Food; servings: Serving[] } | null> {
  try {
    const client = createServiceSupabase();
    const food = await getFoodBySource(client, 'ph_core', sourceId);
    if (!food) return null;
    const servings = await listServings(client, food.id);
    return { food, servings };
  } catch {
    return null;
  }
}
