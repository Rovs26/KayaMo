import type { Food, FoodInsert, Serving } from '../database';
import type { DbClient } from './client';
import { DbQueryError, throwIfError } from './errors';
import { clampUpdatedAtIso, omitServerCursor } from './lww';

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
