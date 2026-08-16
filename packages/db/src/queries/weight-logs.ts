import type { WeightLog, WeightLogInsert } from '../database';
import type { DbClient } from './client';
import { DbQueryError, throwIfError } from './errors';
import { clampUpdatedAtIso, omitKeys, omitServerCursor } from './lww';

type WeightLogWrite = Omit<WeightLogInsert, 'logical_date' | 'server_updated_at' | 'created_at'> & {
  logical_date?: string;
  created_at?: string;
  server_updated_at?: string;
};

export async function listWeightLogsByLogicalDate(
  client: DbClient,
  params: { userId: string; logicalDate: string },
): Promise<WeightLog[]> {
  const { data, error } = await client
    .from('weight_logs')
    .select('*')
    .eq('user_id', params.userId)
    .eq('logical_date', params.logicalDate)
    .is('deleted_at', null)
    .order('logged_at', { ascending: true });
  throwIfError(error);
  return data ?? [];
}

export async function insertWeightLog(client: DbClient, row: WeightLogWrite): Promise<WeightLog> {
  const rest = omitKeys(omitServerCursor(row), ['logical_date']);
  const { data, error } = await client
    .from('weight_logs')
    .insert({ ...rest, updated_at: clampUpdatedAtIso(row.updated_at) })
    .select('*')
    .single();
  throwIfError(error);
  if (!data) throw new DbQueryError('insertWeightLog returned no row');
  return data;
}

export async function tombstoneWeightLog(
  client: DbClient,
  params: { id: string; userId: string; updatedAt: string },
): Promise<void> {
  const { data, error } = await client
    .from('weight_logs')
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
    throw new DbQueryError('tombstoneWeightLog matched no live row');
  }
}
