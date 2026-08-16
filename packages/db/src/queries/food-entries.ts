import type { FoodEntry, FoodEntryInsert } from '../database';
import type { DbClient } from './client';
import { DbQueryError, throwIfError } from './errors';
import { clampUpdatedAtIso, omitKeys, omitServerCursor } from './lww';

export type FoodEntryWrite = Omit<
  FoodEntryInsert,
  'logical_date' | 'server_updated_at' | 'created_at' | 'id'
> & {
  id: string;
  logical_date?: string;
  created_at?: string;
  server_updated_at?: string;
};

function toInsert(row: FoodEntryWrite): FoodEntryInsert {
  return {
    ...omitKeys(omitServerCursor(row), ['logical_date']),
    id: row.id,
    updated_at: clampUpdatedAtIso(row.updated_at),
  };
}

export async function listFoodEntriesByLogicalDate(
  client: DbClient,
  params: { userId: string; logicalDate: string },
): Promise<FoodEntry[]> {
  const { data, error } = await client
    .from('food_entries')
    .select('*')
    .eq('user_id', params.userId)
    .eq('logical_date', params.logicalDate)
    .is('deleted_at', null)
    .order('logged_at', { ascending: true });
  throwIfError(error);
  return data ?? [];
}

export async function listFoodEntriesSince(
  client: DbClient,
  params: { userId: string; sinceLogicalDate: string },
): Promise<FoodEntry[]> {
  const { data, error } = await client
    .from('food_entries')
    .select('*')
    .eq('user_id', params.userId)
    .gte('logical_date', params.sinceLogicalDate)
    .is('deleted_at', null)
    .order('logged_at', { ascending: true });
  throwIfError(error);
  return data ?? [];
}

export async function insertFoodEntry(client: DbClient, row: FoodEntryWrite): Promise<FoodEntry> {
  const { data, error } = await client
    .from('food_entries')
    .insert(toInsert(row))
    .select('*')
    .single();
  throwIfError(error);
  if (!data) throw new DbQueryError('insertFoodEntry returned no row');
  return data;
}

export type UpsertResult =
  | { applied: true; reason: 'inserted' | 'updated'; row: FoodEntry }
  | { applied: false; reason: 'stale_or_tombstoned' };

export async function upsertFoodEntry(client: DbClient, row: FoodEntryWrite): Promise<UpsertResult> {
  const payload = toInsert(row);
  const { data: updated, error: updateError } = await client
    .from('food_entries')
    .update(payload)
    .eq('id', row.id)
    .eq('user_id', row.user_id)
    .is('deleted_at', null)
    .lt('updated_at', payload.updated_at)
    .select('*');
  throwIfError(updateError);
  const updatedRow = updated?.[0];
  if (updatedRow) {
    return { applied: true, reason: 'updated', row: updatedRow };
  }

  const { data: inserted, error: insertError } = await client
    .from('food_entries')
    .insert(payload)
    .select('*')
    .maybeSingle();
  if (insertError?.code === '23505') {
    return { applied: false, reason: 'stale_or_tombstoned' };
  }
  throwIfError(insertError);
  if (inserted) {
    return { applied: true, reason: 'inserted', row: inserted };
  }
  return { applied: false, reason: 'stale_or_tombstoned' };
}

export async function tombstoneFoodEntry(
  client: DbClient,
  params: { id: string; userId: string; updatedAt: string },
): Promise<void> {
  const { data, error } = await client
    .from('food_entries')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: clampUpdatedAtIso(params.updatedAt),
    })
    .eq('id', params.id)
    .eq('user_id', params.userId)
    .is('deleted_at', null)
    .select('id');
  throwIfError(error);
  if (!data?.length) {
    throw new DbQueryError('tombstoneFoodEntry matched no live row');
  }
}
