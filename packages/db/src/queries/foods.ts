import type { Food, FoodInsert, Serving, ServingInsert } from '../database';
import type { DbClient } from './client';
import { DbQueryError, isMissingRpcError, throwIfError } from './errors';
import { clampUpdatedAtIso, omitServerCursor } from './lww';

const CANONICAL_SOURCES = ['ph_core', 'usda_fdc', 'off', 'llm'] as const;
type CanonicalSource = (typeof CANONICAL_SOURCES)[number];

function isCanonicalSource(value: string): value is CanonicalSource {
  return (CANONICAL_SOURCES as readonly string[]).includes(value);
}

export async function listVisibleFoods(client: DbClient): Promise<Food[]> {
  const { data, error } = await client
    .from('foods')
    .select('*')
    .is('deleted_at', null)
    .order('name', { ascending: true });
  throwIfError(error);
  return data ?? [];
}

export async function getFood(client: DbClient, id: string): Promise<Food | null> {
  const { data, error } = await client
    .from('foods')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  throwIfError(error);
  return data;
}

export async function insertUserFood(
  client: DbClient,
  row: Omit<FoodInsert, 'server_updated_at' | 'created_at' | 'source'> & {
    source?: FoodInsert['source'];
    created_at?: string;
    server_updated_at?: string;
  },
): Promise<Food> {
  const payload = omitServerCursor({
    ...row,
    source: 'user' as const,
    updated_at: clampUpdatedAtIso(row.updated_at),
  });
  const { data, error } = await client.from('foods').insert(payload).select('*').single();
  throwIfError(error);
  if (!data) throw new DbQueryError('insertUserFood returned no row');
  return data;
}

export async function tombstoneUserFood(
  client: DbClient,
  params: { id: string; updatedAt: string },
): Promise<void> {
  const { data, error } = await client
    .from('foods')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: clampUpdatedAtIso(params.updatedAt),
    })
    .eq('id', params.id)
    .eq('source', 'user')
    .is('deleted_at', null)
    .select('id');
  throwIfError(error);
  if (!data?.length) {
    throw new DbQueryError('tombstoneUserFood matched no live row');
  }
}

export async function listServings(client: DbClient, foodId: string): Promise<Serving[]> {
  const { data, error } = await client
    .from('servings')
    .select('*')
    .eq('food_id', foodId)
    .order('is_default', { ascending: false });
  throwIfError(error);
  return data ?? [];
}

export async function listFoodsBySource(client: DbClient, source: string): Promise<Food[]> {
  const { data, error } = await client
    .from('foods')
    .select('*')
    .eq('source', source)
    .is('deleted_at', null)
    .order('name', { ascending: true });
  throwIfError(error);
  return data ?? [];
}

export async function getFoodBySource(
  client: DbClient,
  source: string,
  sourceId: string,
): Promise<Food | null> {
  const { data, error } = await client
    .from('foods')
    .select('*')
    .eq('source', source)
    .eq('source_id', sourceId)
    .is('deleted_at', null)
    .maybeSingle();
  throwIfError(error);
  return data;
}

export async function insertCanonicalFood(
  client: DbClient,
  row: Omit<FoodInsert, 'server_updated_at' | 'created_at' | 'created_by'> & {
    source: CanonicalSource;
    source_id: string;
    created_at?: string;
    server_updated_at?: string;
  },
): Promise<Food> {
  if (!isCanonicalSource(row.source)) {
    throw new DbQueryError('insertCanonicalFood requires a non-user source');
  }
  const payload = omitServerCursor({
    ...row,
    created_by: null,
    updated_at: clampUpdatedAtIso(row.updated_at),
  });
  const { data, error } = await client.from('foods').insert(payload).select('*').single();
  throwIfError(error);
  if (!data) throw new DbQueryError('insertCanonicalFood returned no row');
  return data;
}

export async function insertServings(
  client: DbClient,
  rows: Array<
    Omit<ServingInsert, 'server_updated_at' | 'created_at'> & {
      created_at?: string;
      server_updated_at?: string;
    }
  >,
): Promise<Serving[]> {
  if (rows.length === 0) return [];
  const payload = rows.map((row) =>
    omitServerCursor({
      ...row,
      updated_at: clampUpdatedAtIso(row.updated_at),
    }),
  );
  const { data, error } = await client.from('servings').insert(payload).select('*');
  throwIfError(error);
  return data ?? [];
}

const IN_CHUNK = 100;

async function mapChunks<T>(
  ids: string[],
  fn: (chunk: string[]) => Promise<T[]>,
): Promise<T[]> {
  if (ids.length === 0) return [];
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    out.push(...(await fn(ids.slice(i, i + IN_CHUNK))));
  }
  return out;
}

export async function getFoodsByIds(client: DbClient, ids: string[]): Promise<Food[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  const rows = await mapChunks(unique, async (chunk) => {
    const { data, error } = await client
      .from('foods')
      .select('*')
      .in('id', chunk)
      .is('deleted_at', null);
    throwIfError(error);
    return data ?? [];
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
}

export async function getFoodsByBarcode(client: DbClient, barcode: string): Promise<Food[]> {
  const code = barcode.trim();
  if (!code) return [];
  const { data, error } = await client
    .from('foods')
    .select('*')
    .eq('barcode', code)
    .is('deleted_at', null)
    .limit(10);
  throwIfError(error);
  return data ?? [];
}

export async function listServingsByFoodIds(
  client: DbClient,
  foodIds: string[],
): Promise<Map<string, Serving[]>> {
  const rows = await mapChunks([...new Set(foodIds.filter(Boolean))], async (chunk) => {
    const { data, error } = await client.from('servings').select('*').in('food_id', chunk);
    throwIfError(error);
    return data ?? [];
  });
  const grouped = new Map<string, Serving[]>();
  for (const row of rows) {
    const list = grouped.get(row.food_id) ?? [];
    list.push(row);
    grouped.set(row.food_id, list);
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => Number(b.is_default) - Number(a.is_default));
  }
  return grouped;
}

export async function listFoodAliases(
  client: DbClient,
  foodIds: string[],
): Promise<Map<string, string[]>> {
  const rows = await mapChunks([...new Set(foodIds.filter(Boolean))], async (chunk) => {
    const { data, error } = await client
      .from('food_aliases')
      .select('food_id, alias')
      .in('food_id', chunk);
    throwIfError(error);
    return data ?? [];
  });
  const grouped = new Map<string, string[]>();
  for (const row of rows) {
    const list = grouped.get(row.food_id) ?? [];
    list.push(row.alias);
    grouped.set(row.food_id, list);
  }
  return grouped;
}

export type FoodSearchHit = { food_id: string; similarity: number };

function nameHaystack(food: Food): string {
  return [food.name, ...(food.name_tl ?? [])].join(' ').toLowerCase();
}

async function searchFoodsFallback(
  client: DbClient,
  query: string,
  limit: number,
): Promise<FoodSearchHit[]> {
  const foods = await listVisibleFoods(client);
  const aliases = await listFoodAliases(
    client,
    foods.map((food) => food.id),
  );
  const q = query.toLowerCase();
  const hits: FoodSearchHit[] = [];
  for (const food of foods) {
    const aliasText = (aliases.get(food.id) ?? []).join(' ').toLowerCase();
    const haystack = `${nameHaystack(food)} ${aliasText}`;
    if (!haystack.includes(q) && !q.split(' ').every((token) => haystack.includes(token))) {
      continue;
    }
    hits.push({ food_id: food.id, similarity: haystack.includes(q) ? 1 : 0.5 });
  }
  return hits.slice(0, limit);
}

export async function searchFoods(
  client: DbClient,
  query: string,
  limit = 25,
): Promise<FoodSearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const { data, error } = await client.rpc('kayamo_search_foods', {
    p_query: trimmed,
    p_limit: limit,
  });
  if (error && isMissingRpcError(error)) {
    return searchFoodsFallback(client, trimmed, limit);
  }
  throwIfError(error);
  return (data ?? []).map((row) => ({
    food_id: row.food_id,
    similarity: row.similarity,
  }));
}

export async function getFoodLogCounts(
  client: DbClient,
  params: { userId: string; foodIds: string[] },
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const foodIds = [...new Set(params.foodIds.filter(Boolean))];
  if (foodIds.length === 0) return counts;

  const { data, error } = await client.rpc('kayamo_food_log_counts', {
    p_food_ids: foodIds,
  });
  if (error && isMissingRpcError(error)) {
    const rows = await mapChunks(foodIds, async (chunk) => {
      const { data: entries, error: entryError } = await client
        .from('food_entries')
        .select('food_id')
        .eq('user_id', params.userId)
        .in('food_id', chunk)
        .is('deleted_at', null);
      throwIfError(entryError);
      return entries ?? [];
    });
    for (const row of rows) {
      if (!row.food_id) continue;
      counts.set(row.food_id, (counts.get(row.food_id) ?? 0) + 1);
    }
    return counts;
  }
  throwIfError(error);
  for (const row of data ?? []) {
    counts.set(row.food_id, row.times_logged);
  }
  return counts;
}
