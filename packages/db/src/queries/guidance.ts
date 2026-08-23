import type {
  ExpenditureEstimate,
  ExpenditureEstimateInsert,
  NutritionTarget,
  NutritionTargetInsert,
} from '../database';
import type { DbClient } from './client';
import { DbQueryError, isUniqueViolation, throwIfError } from './errors';
import { clampUpdatedAtIso, omitServerCursor } from './lww';

export type ExpenditureEstimateWrite = Omit<
  ExpenditureEstimateInsert,
  'id' | 'revision' | 'created_at' | 'server_updated_at'
> & {
  id: string;
  revision?: number;
  created_at?: string;
};

export type NutritionTargetWrite = Omit<
  NutritionTargetInsert,
  'id' | 'created_at' | 'server_updated_at'
> & {
  id: string;
  created_at?: string;
};

export async function listExpenditureEstimates(
  client: DbClient,
  params: { userId: string; throughDate?: string },
): Promise<ExpenditureEstimate[]> {
  let query = client
    .from('expenditure_estimates')
    .select('*')
    .eq('user_id', params.userId);
  if (params.throughDate) query = query.lte('date', params.throughDate);
  const { data, error } = await query
    .order('date', { ascending: false })
    .order('revision', { ascending: false });
  throwIfError(error);
  return data ?? [];
}

export async function getLatestExpenditureEstimate(
  client: DbClient,
  params: { userId: string; throughDate?: string },
): Promise<ExpenditureEstimate | null> {
  return (await listExpenditureEstimates(client, params))[0] ?? null;
}

async function latestRevision(
  client: DbClient,
  userId: string,
  date: string,
): Promise<number> {
  const { data, error } = await client
    .from('expenditure_estimates')
    .select('revision')
    .eq('user_id', userId)
    .eq('date', date)
    .order('revision', { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIfError(error);
  return data?.revision ?? 0;
}

/** Appends a correction; an existing estimate is never overwritten. */
export async function appendExpenditureEstimate(
  client: DbClient,
  row: ExpenditureEstimateWrite,
): Promise<ExpenditureEstimate> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const revision =
      row.revision ?? (await latestRevision(client, row.user_id, row.date)) + 1;
    const payload = {
      ...omitServerCursor(row),
      revision,
      updated_at: clampUpdatedAtIso(row.updated_at),
    };
    const { data, error } = await client
      .from('expenditure_estimates')
      .insert(payload)
      .select('*')
      .maybeSingle();
    if (!error && data) return data;
    if (row.revision !== undefined || !isUniqueViolation(error) || attempt === 1) {
      throwIfError(error);
      break;
    }
  }
  throw new DbQueryError('appendExpenditureEstimate returned no row');
}

export async function insertNutritionTargets(
  client: DbClient,
  rows: readonly NutritionTargetWrite[],
): Promise<NutritionTarget[]> {
  if (rows.length === 0) return [];
  const payload = rows.map((row) => ({
    ...omitServerCursor(row),
    updated_at: clampUpdatedAtIso(row.updated_at),
  }));
  const { data, error } = await client.from('targets').insert(payload).select('*');
  throwIfError(error);
  return data ?? [];
}

export async function listEffectiveNutritionTargets(
  client: DbClient,
  params: { userId: string; date: string },
): Promise<NutritionTarget[]> {
  const { data, error } = await client
    .from('targets')
    .select('*')
    .eq('user_id', params.userId)
    .lte('effective_from', params.date)
    .order('effective_from', { ascending: false });
  throwIfError(error);
  const byDayType = new Map<string, NutritionTarget>();
  for (const row of data ?? []) {
    if (!byDayType.has(row.day_type)) byDayType.set(row.day_type, row);
  }
  return [...byDayType.values()];
}
