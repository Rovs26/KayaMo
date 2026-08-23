import type {
  AchievementDefinitionRow,
  CompanionEvent,
  CompanionState,
  CosmeticDefinition,
  CosmeticUnlock,
  EvolutionStage,
  GoalMilestone,
  GoalMilestoneInsert,
  Habit,
  HabitCompletion,
  HabitCompletionInsert,
  HabitInsert,
  UserAchievement,
  UserGoal,
  UserGoalInsert,
} from '../database';
import type { DbClient } from './client';
import { DbQueryError, throwIfError } from './errors';
import { clampUpdatedAtIso, omitKeys, omitServerCursor } from './lww';

export type GoalWrite = Omit<
  UserGoalInsert,
  'id' | 'created_at' | 'server_updated_at'
> & { id: string; created_at?: string };
export type GoalMilestoneWrite = Omit<
  GoalMilestoneInsert,
  'id' | 'created_at' | 'server_updated_at'
> & { id: string; created_at?: string };
export type HabitWrite = Omit<HabitInsert, 'id' | 'created_at' | 'server_updated_at'> & {
  id: string;
  created_at?: string;
};
export type HabitCompletionWrite = Omit<
  HabitCompletionInsert,
  'id' | 'created_at' | 'server_updated_at' | 'logical_date'
> & { id: string; created_at?: string; logical_date?: string };
export type CompanionEventWrite = Pick<
  CompanionEvent,
  'id' | 'user_id' | 'event_key' | 'event_type' | 'source_table' | 'source_id'
> & { logical_date?: string; created_at?: string };

export type JourneyUpsertResult<T> =
  | { applied: true; reason: 'inserted' | 'updated'; row: T }
  | { applied: false; reason: 'stale_or_tombstoned'; row: T | null };

type JourneyTable = 'goals' | 'goal_milestones' | 'habits' | 'habit_completions';

async function lwwUpsert<T>(
  client: DbClient,
  table: JourneyTable,
  input: Record<string, unknown> & { id: string; user_id: string; updated_at: string },
): Promise<JourneyUpsertResult<T>> {
  const withoutCursor = omitServerCursor(input);
  const payload = {
    ...(table === 'habit_completions'
      ? omitKeys(withoutCursor, ['logical_date'])
      : withoutCursor),
    updated_at: clampUpdatedAtIso(input.updated_at),
  };
  const { data: updated, error: updateError } = await client
    .from(table)
    .update(payload as never)
    .eq('id', input.id)
    .eq('user_id' as never, input.user_id)
    .is('deleted_at', null)
    .lt('updated_at', payload.updated_at)
    .select('*');
  throwIfError(updateError);
  if (updated?.[0]) return { applied: true, reason: 'updated', row: updated[0] as T };

  const { data: inserted, error: insertError } = await client
    .from(table)
    .insert(payload as never)
    .select('*')
    .maybeSingle();
  if (insertError?.code !== '23505') throwIfError(insertError);
  if (inserted) return { applied: true, reason: 'inserted', row: inserted as T };
  const { data: existing, error: readError } = await client
    .from(table)
    .select('*')
    .eq('id', input.id)
    .maybeSingle();
  throwIfError(readError);
  return {
    applied: false,
    reason: 'stale_or_tombstoned',
    row: (existing as T | null) ?? null,
  };
}

async function tombstone(
  client: DbClient,
  table: JourneyTable,
  params: { id: string; userId: string; updatedAt: string },
): Promise<void> {
  const updatedAt = clampUpdatedAtIso(params.updatedAt);
  const { data, error } = await client
    .from(table)
    .update({ deleted_at: updatedAt, updated_at: updatedAt })
    .eq('id', params.id)
    .eq('user_id' as never, params.userId)
    .is('deleted_at', null)
    .select('id');
  throwIfError(error);
  // A successful tombstone may be hidden from RETURNING by the SELECT policy.
  if (data === null) throw new DbQueryError(`tombstone ${table} failed`);
}

export async function listGoals(client: DbClient, userId: string): Promise<UserGoal[]> {
  const { data, error } = await client
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  throwIfError(error);
  return data ?? [];
}

export const upsertGoal = (client: DbClient, row: GoalWrite) =>
  lwwUpsert<UserGoal>(client, 'goals', row);
export const tombstoneGoal = (
  client: DbClient,
  params: { id: string; userId: string; updatedAt: string },
) => tombstone(client, 'goals', params);

export async function listGoalMilestones(
  client: DbClient,
  params: { userId: string; goalId: string },
): Promise<GoalMilestone[]> {
  const { data, error } = await client
    .from('goal_milestones')
    .select('*')
    .eq('user_id', params.userId)
    .eq('goal_id', params.goalId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true });
  throwIfError(error);
  return data ?? [];
}

export const upsertGoalMilestone = (client: DbClient, row: GoalMilestoneWrite) =>
  lwwUpsert<GoalMilestone>(client, 'goal_milestones', row);
export const tombstoneGoalMilestone = (
  client: DbClient,
  params: { id: string; userId: string; updatedAt: string },
) => tombstone(client, 'goal_milestones', params);

export async function listActiveHabits(
  client: DbClient,
  userId: string,
): Promise<Habit[]> {
  const { data, error } = await client
    .from('habits')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  throwIfError(error);
  return data ?? [];
}

export const upsertHabit = (client: DbClient, row: HabitWrite) =>
  lwwUpsert<Habit>(client, 'habits', row);
export const tombstoneHabit = (
  client: DbClient,
  params: { id: string; userId: string; updatedAt: string },
) => tombstone(client, 'habits', params);

export async function listHabitCompletions(
  client: DbClient,
  params: { userId: string; logicalDate?: string },
): Promise<HabitCompletion[]> {
  let query = client
    .from('habit_completions')
    .select('*')
    .eq('user_id', params.userId)
    .is('deleted_at', null)
    .order('completed_at', { ascending: true });
  if (params.logicalDate) query = query.eq('logical_date', params.logicalDate);
  const { data, error } = await query;
  throwIfError(error);
  return data ?? [];
}

export const upsertHabitCompletion = (client: DbClient, row: HabitCompletionWrite) =>
  lwwUpsert<HabitCompletion>(client, 'habit_completions', row);
export const tombstoneHabitCompletion = (
  client: DbClient,
  params: { id: string; userId: string; updatedAt: string },
) => tombstone(client, 'habit_completions', params);

export async function recordCompanionEvent(
  client: DbClient,
  row: CompanionEventWrite,
): Promise<{ inserted: boolean; row: CompanionEvent }> {
  const payload = { ...row, logical_date: row.logical_date ?? '1970-01-01' };
  const { data, error } = await client
    .from('companion_events')
    .insert(payload)
    .select('*')
    .maybeSingle();
  if (error?.code !== '23505') throwIfError(error);
  if (data) return { inserted: true, row: data };
  const { data: existing, error: existingError } = await client
    .from('companion_events')
    .select('*')
    .eq('user_id', row.user_id)
    .eq('event_key', row.event_key)
    .single();
  throwIfError(existingError);
  if (!existing) throw new DbQueryError('duplicate companion event was not readable');
  return { inserted: false, row: existing };
}

export async function listCompanionEvents(
  client: DbClient,
  userId: string,
): Promise<CompanionEvent[]> {
  const { data, error } = await client
    .from('companion_events')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  throwIfError(error);
  return data ?? [];
}

export async function getCompanionState(
  client: DbClient,
  userId: string,
): Promise<CompanionState | null> {
  const { data, error } = await client
    .from('companion_state')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  throwIfError(error);
  return data;
}

export async function listAchievementDefinitions(
  client: DbClient,
): Promise<AchievementDefinitionRow[]> {
  const { data, error } = await client
    .from('achievement_definitions')
    .select('*')
    .eq('active', true)
    .order('threshold', { ascending: true });
  throwIfError(error);
  return data ?? [];
}

export async function listUserAchievements(
  client: DbClient,
  userId: string,
): Promise<UserAchievement[]> {
  const { data, error } = await client
    .from('user_achievements')
    .select('*')
    .eq('user_id', userId)
    .order('earned_at', { ascending: true });
  throwIfError(error);
  return data ?? [];
}

export async function listEvolutionStages(client: DbClient): Promise<EvolutionStage[]> {
  const { data, error } = await client
    .from('evolution_stages')
    .select('*')
    .order('sort_order', { ascending: true });
  throwIfError(error);
  return data ?? [];
}

export async function listCosmeticDefinitions(
  client: DbClient,
): Promise<CosmeticDefinition[]> {
  const { data, error } = await client
    .from('cosmetic_definitions')
    .select('*')
    .eq('active', true)
    .order('title', { ascending: true });
  throwIfError(error);
  return data ?? [];
}

export async function listCosmeticUnlocks(
  client: DbClient,
  userId: string,
): Promise<CosmeticUnlock[]> {
  const { data, error } = await client
    .from('cosmetic_unlocks')
    .select('*')
    .eq('user_id', userId)
    .order('unlocked_at', { ascending: true });
  throwIfError(error);
  return data ?? [];
}

export async function selectCompanionCosmetic(
  client: DbClient,
  params: { userId: string; cosmeticId: string | null; updatedAt: string },
): Promise<CompanionState> {
  const { data, error } = await client
    .from('companion_state')
    .update({
      selected_cosmetic_id: params.cosmeticId,
      updated_at: clampUpdatedAtIso(params.updatedAt),
    })
    .eq('user_id', params.userId)
    .select('*')
    .single();
  throwIfError(error);
  if (!data) throw new DbQueryError('selectCompanionCosmetic returned no row');
  return data;
}
