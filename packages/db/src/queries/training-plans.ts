import type {
  Exercise,
  ExerciseInsert,
  WorkoutPlan,
  WorkoutPlanExercise,
  WorkoutPlanExerciseInsert,
  WorkoutPlanInsert,
} from '../database';
import type { DbClient } from './client';
import { DbQueryError, throwIfError } from './errors';
import { clampUpdatedAtIso, omitServerCursor } from './lww';

export type UserExerciseWrite = Omit<
  ExerciseInsert,
  'id' | 'server_updated_at' | 'created_at' | 'source'
> & {
  id: string;
  source?: 'user';
  created_at?: string;
};

export type WorkoutPlanWrite = Omit<
  WorkoutPlanInsert,
  'id' | 'server_updated_at' | 'created_at'
> & { id: string; created_at?: string };

export type WorkoutPlanExerciseWrite = Omit<
  WorkoutPlanExerciseInsert,
  'id' | 'server_updated_at' | 'created_at'
> & { id: string; created_at?: string };

export type TrainingUpsertResult<T> =
  | { applied: true; reason: 'inserted' | 'updated'; row: T }
  | { applied: false; reason: 'stale_or_tombstoned'; row: T | null };

async function lwwUpsert<T>(
  client: DbClient,
  table: 'exercises' | 'workout_plans' | 'workout_plan_exercises',
  row: Record<string, unknown> & { id: string; updated_at: string },
  ownerColumn: 'created_by' | 'user_id',
  ownerId: string,
): Promise<TrainingUpsertResult<T>> {
  const payload = {
    ...omitServerCursor(row),
    updated_at: clampUpdatedAtIso(row.updated_at),
  };
  const { data: updated, error: updateError } = await client
    .from(table)
    .update(payload as never)
    .eq('id', row.id)
    .eq(ownerColumn as never, ownerId)
    .is('deleted_at', null)
    .lt('updated_at', payload.updated_at)
    .select('*');
  throwIfError(updateError);
  if (updated?.[0]) {
    return { applied: true, reason: 'updated', row: updated[0] as T };
  }

  const { data: inserted, error: insertError } = await client
    .from(table)
    .insert(payload as never)
    .select('*')
    .maybeSingle();
  if (insertError?.code !== '23505') throwIfError(insertError);
  if (inserted) return { applied: true, reason: 'inserted', row: inserted as T };

  const { data: existing, error: existingError } = await client
    .from(table)
    .select('*')
    .eq('id', row.id)
    .maybeSingle();
  throwIfError(existingError);
  return {
    applied: false,
    reason: 'stale_or_tombstoned',
    row: (existing as T | null) ?? null,
  };
}

async function tombstone(
  client: DbClient,
  table: 'exercises' | 'workout_plans' | 'workout_plan_exercises',
  params: {
    id: string;
    ownerId: string;
    ownerColumn: 'created_by' | 'user_id';
    updatedAt: string;
  },
): Promise<void> {
  const updatedAt = clampUpdatedAtIso(params.updatedAt);
  const { data, error } = await client
    .from(table)
    .update({ deleted_at: updatedAt, updated_at: updatedAt })
    .eq('id', params.id)
    .eq(params.ownerColumn as never, params.ownerId)
    .is('deleted_at', null)
    .select('id');
  throwIfError(error);
  if (!data?.length) throw new DbQueryError(`tombstone ${table} matched no live row`);
}

export async function listExercises(
  client: DbClient,
  params: { search?: string; limit?: number } = {},
): Promise<Exercise[]> {
  let query = client
    .from('exercises')
    .select('*')
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .limit(Math.min(params.limit ?? 100, 200));
  if (params.search?.trim()) query = query.ilike('name', `%${params.search.trim()}%`);
  const { data, error } = await query;
  throwIfError(error);
  return data ?? [];
}

export async function getExercise(
  client: DbClient,
  id: string,
): Promise<Exercise | null> {
  const { data, error } = await client
    .from('exercises')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  throwIfError(error);
  return data;
}

export function upsertUserExercise(
  client: DbClient,
  row: UserExerciseWrite,
): Promise<TrainingUpsertResult<Exercise>> {
  const payload = { ...row, source: 'user' as const };
  return lwwUpsert(client, 'exercises', payload, 'created_by', row.created_by!);
}

export function tombstoneUserExercise(
  client: DbClient,
  params: { id: string; userId: string; updatedAt: string },
): Promise<void> {
  return tombstone(client, 'exercises', {
    id: params.id,
    ownerId: params.userId,
    ownerColumn: 'created_by',
    updatedAt: params.updatedAt,
  });
}

export async function listWorkoutPlans(
  client: DbClient,
  userId: string,
): Promise<WorkoutPlan[]> {
  const { data, error } = await client
    .from('workout_plans')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  throwIfError(error);
  return data ?? [];
}

export function upsertWorkoutPlan(
  client: DbClient,
  row: WorkoutPlanWrite,
): Promise<TrainingUpsertResult<WorkoutPlan>> {
  return lwwUpsert(client, 'workout_plans', row, 'user_id', row.user_id);
}

export function tombstoneWorkoutPlan(
  client: DbClient,
  params: { id: string; userId: string; updatedAt: string },
): Promise<void> {
  return tombstone(client, 'workout_plans', {
    id: params.id,
    ownerId: params.userId,
    ownerColumn: 'user_id',
    updatedAt: params.updatedAt,
  });
}

export async function listWorkoutPlanExercises(
  client: DbClient,
  params: { userId: string; planId: string; dayIndex?: number },
): Promise<WorkoutPlanExercise[]> {
  let query = client
    .from('workout_plan_exercises')
    .select('*')
    .eq('user_id', params.userId)
    .eq('plan_id', params.planId)
    .is('deleted_at', null)
    .order('day_index', { ascending: true })
    .order('exercise_order', { ascending: true });
  if (params.dayIndex !== undefined) query = query.eq('day_index', params.dayIndex);
  const { data, error } = await query;
  throwIfError(error);
  return data ?? [];
}

export function upsertWorkoutPlanExercise(
  client: DbClient,
  row: WorkoutPlanExerciseWrite,
): Promise<TrainingUpsertResult<WorkoutPlanExercise>> {
  return lwwUpsert(client, 'workout_plan_exercises', row, 'user_id', row.user_id);
}

export function tombstoneWorkoutPlanExercise(
  client: DbClient,
  params: { id: string; userId: string; updatedAt: string },
): Promise<void> {
  return tombstone(client, 'workout_plan_exercises', {
    id: params.id,
    ownerId: params.userId,
    ownerColumn: 'user_id',
    updatedAt: params.updatedAt,
  });
}
