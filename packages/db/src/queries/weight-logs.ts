import type { WeightLog, WeightLogInsert } from '../database';
import type { DbClient } from './client';
import { DbQueryError, throwIfError } from './errors';
import { clampUpdatedAtIso, omitKeys, omitServerCursor } from './lww';

export type WeightLogWrite = Omit<
  WeightLogInsert,
  'logical_date' | 'server_updated_at' | 'created_at' | 'id'
> & {
  id: string;
  logical_date?: string;
  created_at?: string;
};

export type UpsertWeightLogResult =
  | { applied: true; reason: 'inserted' | 'updated'; row: WeightLog }
  | { applied: false; reason: 'stale_or_tombstoned'; row: WeightLog | null };

function toInsert(row: WeightLogWrite): WeightLogInsert {
  const rest = omitKeys(omitServerCursor(row), ['logical_date']);
  return { ...rest, updated_at: clampUpdatedAtIso(row.updated_at) };
}

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

export async function listWeightLogsSince(
  client: DbClient,
  params: { userId: string; sinceLogicalDate: string },
): Promise<WeightLog[]> {
  const { data, error } = await client
    .from('weight_logs')
    .select('*')
    .eq('user_id', params.userId)
    .gte('logical_date', params.sinceLogicalDate)
    .is('deleted_at', null)
    .order('logged_at', { ascending: true });
  throwIfError(error);
  return data ?? [];
}

export async function insertWeightLog(
  client: DbClient,
  row: WeightLogWrite,
): Promise<WeightLog> {
  const { data, error } = await client
    .from('weight_logs')
    .insert(toInsert(row))
    .select('*')
    .single();
  throwIfError(error);
  if (!data) throw new DbQueryError('insertWeightLog returned no row');
  return data;
}

async function getWeightLogForSync(
  client: DbClient,
  params: { id: string; userId: string },
): Promise<WeightLog | null> {
  const { data, error } = await client
    .from('weight_logs')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', params.userId)
    .maybeSingle();
  throwIfError(error);
  return data;
}

export async function upsertWeightLog(
  client: DbClient,
  row: WeightLogWrite,
): Promise<UpsertWeightLogResult> {
  const payload = toInsert(row);
  const { data: updated, error: updateError } = await client
    .from('weight_logs')
    .update(payload)
    .eq('id', row.id)
    .eq('user_id', row.user_id)
    .is('deleted_at', null)
    .lt('updated_at', payload.updated_at)
    .select('*');
  throwIfError(updateError);
  const updatedRow = updated?.[0];
  if (updatedRow) return { applied: true, reason: 'updated', row: updatedRow };

  const { data: inserted, error: insertError } = await client
    .from('weight_logs')
    .insert(payload)
    .select('*')
    .maybeSingle();
  if (insertError?.code === '23505') {
    const existing = await getWeightLogForSync(client, {
      id: row.id,
      userId: row.user_id,
    });
    if (!existing) throwIfError(insertError);
    return {
      applied: false,
      reason: 'stale_or_tombstoned',
      row: existing,
    };
  }
  throwIfError(insertError);
  if (inserted) return { applied: true, reason: 'inserted', row: inserted };
  return {
    applied: false,
    reason: 'stale_or_tombstoned',
    row: await getWeightLogForSync(client, { id: row.id, userId: row.user_id }),
  };
}

export async function tombstoneWeightLog(
  client: DbClient,
  params: { id: string; userId: string; updatedAt: string },
): Promise<void> {
  const updatedAt = clampUpdatedAtIso(params.updatedAt);
  const { data, error } = await client
    .from('weight_logs')
    .update({
      deleted_at: updatedAt,
      updated_at: updatedAt,
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
