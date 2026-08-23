import type {
  DailyLoopPreference,
  DailyLoopPreferenceInsert,
  DailyPlan,
  DailyPlanInsert,
  FocusSession,
  FocusSessionInsert,
  ScripturePassage,
} from '../database';
import type { DbClient } from './client';
import { throwIfError } from './errors';
import { clampUpdatedAtIso, omitServerCursor } from './lww';

export type DailyPlanWrite = Omit<DailyPlanInsert, 'created_at' | 'id'> & {
  id: string;
  created_at?: string;
};
export type FocusSessionWrite = Omit<FocusSessionInsert, 'created_at' | 'id'> & {
  id: string;
  created_at?: string;
};
export type DailyLoopPreferenceWrite = DailyLoopPreferenceInsert;

export type DailyLoopUpsertResult<T> =
  | { applied: true; reason: 'inserted' | 'updated'; row: T }
  | { applied: false; reason: 'stale_or_tombstoned'; row: T | null };

function normalizePlan(row: DailyPlanWrite): DailyPlanInsert {
  return {
    ...omitServerCursor(row),
    selected_label_snapshot: row.selected_label_snapshot?.trim() || null,
    updated_at: clampUpdatedAtIso(row.updated_at),
  };
}

function normalizeFocus(row: FocusSessionWrite): FocusSessionInsert {
  return {
    ...omitServerCursor(row),
    target_label_snapshot: row.target_label_snapshot.trim(),
    updated_at: clampUpdatedAtIso(row.updated_at),
  };
}

async function getPlanForSync(
  client: DbClient,
  row: DailyPlanWrite,
): Promise<DailyPlan | null> {
  const byId = await client
    .from('daily_plans')
    .select('*')
    .eq('id', row.id)
    .eq('user_id', row.user_id)
    .maybeSingle();
  throwIfError(byId.error);
  if (byId.data) return byId.data;
  const byDate = await client
    .from('daily_plans')
    .select('*')
    .eq('user_id', row.user_id)
    .eq('logical_date', row.logical_date)
    .maybeSingle();
  throwIfError(byDate.error);
  return byDate.data;
}

async function getFocusForSync(
  client: DbClient,
  row: FocusSessionWrite,
): Promise<FocusSession | null> {
  const { data, error } = await client
    .from('focus_sessions')
    .select('*')
    .eq('id', row.id)
    .eq('user_id', row.user_id)
    .maybeSingle();
  throwIfError(error);
  return data;
}

export async function upsertDailyPlan(
  client: DbClient,
  row: DailyPlanWrite,
): Promise<DailyLoopUpsertResult<DailyPlan>> {
  const payload = normalizePlan(row);
  const updated = await client
    .from('daily_plans')
    .update(payload)
    .eq('id', row.id)
    .eq('user_id', row.user_id)
    .is('deleted_at', null)
    .lt('updated_at', payload.updated_at)
    .select('*');
  throwIfError(updated.error);
  if (updated.data?.[0]) return { applied: true, reason: 'updated', row: updated.data[0] };
  const inserted = await client.from('daily_plans').insert(payload).select('*').maybeSingle();
  if (inserted.error?.code === '23505') {
    return { applied: false, reason: 'stale_or_tombstoned', row: await getPlanForSync(client, row) };
  }
  throwIfError(inserted.error);
  if (inserted.data) return { applied: true, reason: 'inserted', row: inserted.data };
  return { applied: false, reason: 'stale_or_tombstoned', row: await getPlanForSync(client, row) };
}

export async function upsertFocusSession(
  client: DbClient,
  row: FocusSessionWrite,
): Promise<DailyLoopUpsertResult<FocusSession>> {
  const payload = normalizeFocus(row);
  const updated = await client
    .from('focus_sessions')
    .update(payload)
    .eq('id', row.id)
    .eq('user_id', row.user_id)
    .is('deleted_at', null)
    .lt('updated_at', payload.updated_at)
    .select('*');
  throwIfError(updated.error);
  if (updated.data?.[0]) return { applied: true, reason: 'updated', row: updated.data[0] };
  const inserted = await client
    .from('focus_sessions')
    .insert(payload)
    .select('*')
    .maybeSingle();
  if (inserted.error?.code === '23505') {
    return { applied: false, reason: 'stale_or_tombstoned', row: await getFocusForSync(client, row) };
  }
  throwIfError(inserted.error);
  if (inserted.data) return { applied: true, reason: 'inserted', row: inserted.data };
  return { applied: false, reason: 'stale_or_tombstoned', row: await getFocusForSync(client, row) };
}

export async function upsertDailyLoopPreferences(
  client: DbClient,
  row: DailyLoopPreferenceWrite,
): Promise<DailyLoopUpsertResult<DailyLoopPreference>> {
  const payload: DailyLoopPreferenceInsert = {
    ...omitServerCursor(row),
    updated_at: clampUpdatedAtIso(row.updated_at),
  };
  const updated = await client
    .from('daily_loop_preferences')
    .update(payload)
    .eq('user_id', row.user_id)
    .is('deleted_at', null)
    .lt('updated_at', payload.updated_at)
    .select('*');
  throwIfError(updated.error);
  if (updated.data?.[0]) return { applied: true, reason: 'updated', row: updated.data[0] };
  const inserted = await client
    .from('daily_loop_preferences')
    .insert(payload)
    .select('*')
    .maybeSingle();
  if (inserted.error?.code === '23505') {
    const existing = await getDailyLoopPreferences(client, row.user_id, true);
    return { applied: false, reason: 'stale_or_tombstoned', row: existing };
  }
  throwIfError(inserted.error);
  if (inserted.data) return { applied: true, reason: 'inserted', row: inserted.data };
  return { applied: false, reason: 'stale_or_tombstoned', row: null };
}

export async function getDailyPlan(
  client: DbClient,
  params: { userId: string; logicalDate: string },
): Promise<DailyPlan | null> {
  const { data, error } = await client
    .from('daily_plans')
    .select('*')
    .eq('user_id', params.userId)
    .eq('logical_date', params.logicalDate)
    .is('deleted_at', null)
    .maybeSingle();
  throwIfError(error);
  return data;
}

export async function listFocusSessions(
  client: DbClient,
  params: { userId: string; logicalDate: string },
): Promise<FocusSession[]> {
  const { data, error } = await client
    .from('focus_sessions')
    .select('*')
    .eq('user_id', params.userId)
    .eq('logical_date', params.logicalDate)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  throwIfError(error);
  return data ?? [];
}

export async function getDailyLoopPreferences(
  client: DbClient,
  userId: string,
  includeDeleted = false,
): Promise<DailyLoopPreference | null> {
  let query = client
    .from('daily_loop_preferences')
    .select('*')
    .eq('user_id', userId);
  if (!includeDeleted) query = query.is('deleted_at', null);
  const { data, error } = await query.maybeSingle();
  throwIfError(error);
  return data;
}

export async function listScriptureByTag(
  client: DbClient,
  params: { faithEnabled: boolean; tag?: string; limit?: number },
): Promise<ScripturePassage[]> {
  if (!params.faithEnabled) return [];
  let query = client.from('scripture_passages').select('*').eq('active', true);
  if (params.tag) query = query.contains('tags', [params.tag]);
  const { data, error } = await query
    .order('reference', { ascending: true })
    .limit(Math.min(Math.max(params.limit ?? 20, 1), 100));
  throwIfError(error);
  return data ?? [];
}
