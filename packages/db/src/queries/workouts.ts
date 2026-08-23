import type { Workout, WorkoutInsert, WorkoutSet, WorkoutSetInsert } from '../database';
import type { DbClient } from './client';
import { DbQueryError, throwIfError } from './errors';
import { clampUpdatedAtIso, omitKeys, omitServerCursor } from './lww';

export type WorkoutWrite = Omit<
  WorkoutInsert,
  'logical_date' | 'server_updated_at' | 'created_at' | 'id'
> & {
  id: string;
  logical_date?: string;
  created_at?: string;
};

export type WorkoutSetWrite = Omit<
  WorkoutSetInsert,
  'server_updated_at' | 'created_at' | 'id'
> & {
  id: string;
  created_at?: string;
};

export type UpsertWorkoutResult =
  | { applied: true; reason: 'inserted' | 'updated'; row: Workout }
  | { applied: false; reason: 'stale_or_tombstoned'; row: Workout | null };

export type UpsertWorkoutSetResult =
  | { applied: true; reason: 'inserted' | 'updated'; row: WorkoutSet }
  | { applied: false; reason: 'stale_or_tombstoned'; row: WorkoutSet | null };

function toWorkoutInsert(row: WorkoutWrite): WorkoutInsert {
  const rest = omitKeys(omitServerCursor(row), ['logical_date']);
  return { ...rest, updated_at: clampUpdatedAtIso(row.updated_at) };
}

function toWorkoutSetInsert(row: WorkoutSetWrite): WorkoutSetInsert {
  return {
    ...omitServerCursor(row),
    updated_at: clampUpdatedAtIso(row.updated_at),
  };
}

export async function listWorkoutsByLogicalDate(
  client: DbClient,
  params: { userId: string; logicalDate: string },
): Promise<Workout[]> {
  const { data, error } = await client
    .from('workouts')
    .select('*')
    .eq('user_id', params.userId)
    .eq('logical_date', params.logicalDate)
    .is('deleted_at', null)
    .order('started_at', { ascending: true });
  throwIfError(error);
  return data ?? [];
}

export async function listWorkoutHistory(
  client: DbClient,
  params: { userId: string; limit?: number },
): Promise<Workout[]> {
  const { data, error } = await client
    .from('workouts')
    .select('*')
    .eq('user_id', params.userId)
    .is('deleted_at', null)
    .order('started_at', { ascending: false })
    .limit(Math.min(params.limit ?? 30, 100));
  throwIfError(error);
  return data ?? [];
}

export async function insertWorkout(
  client: DbClient,
  row: WorkoutWrite,
): Promise<Workout> {
  const { data, error } = await client
    .from('workouts')
    .insert(toWorkoutInsert(row))
    .select('*')
    .single();
  throwIfError(error);
  if (!data) throw new DbQueryError('insertWorkout returned no row');
  return data;
}

async function getWorkoutForSync(client: DbClient, id: string): Promise<Workout | null> {
  const { data, error } = await client
    .from('workouts')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  throwIfError(error);
  return data;
}

export async function upsertWorkout(
  client: DbClient,
  row: WorkoutWrite,
): Promise<UpsertWorkoutResult> {
  const payload = toWorkoutInsert(row);
  const { data: updated, error: updateError } = await client
    .from('workouts')
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
    .from('workouts')
    .insert(payload)
    .select('*')
    .maybeSingle();
  if (insertError?.code === '23505') {
    const existing = await getWorkoutForSync(client, row.id);
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
    row: await getWorkoutForSync(client, row.id),
  };
}

export async function tombstoneWorkout(
  client: DbClient,
  params: { id: string; userId: string; updatedAt: string },
): Promise<void> {
  const updatedAt = clampUpdatedAtIso(params.updatedAt);
  const { data, error } = await client
    .from('workouts')
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
    throw new DbQueryError('tombstoneWorkout matched no live row');
  }
}

export async function listWorkoutSets(
  client: DbClient,
  workoutId: string,
): Promise<WorkoutSet[]> {
  const { data, error } = await client
    .from('workout_sets')
    .select('*')
    .eq('workout_id', workoutId)
    .is('deleted_at', null)
    .order('exercise_order', { ascending: true })
    .order('set_index', { ascending: true });
  throwIfError(error);
  return data ?? [];
}

async function getWorkoutSetForSync(
  client: DbClient,
  id: string,
): Promise<WorkoutSet | null> {
  const { data, error } = await client
    .from('workout_sets')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  throwIfError(error);
  return data;
}

export async function upsertWorkoutSet(
  client: DbClient,
  row: WorkoutSetWrite,
): Promise<UpsertWorkoutSetResult> {
  const payload = toWorkoutSetInsert(row);
  const { data: updated, error: updateError } = await client
    .from('workout_sets')
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
    .from('workout_sets')
    .insert(payload)
    .select('*')
    .maybeSingle();
  if (insertError?.code === '23505') {
    const existing = await getWorkoutSetForSync(client, row.id);
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
    row: await getWorkoutSetForSync(client, row.id),
  };
}

export async function tombstoneWorkoutSet(
  client: DbClient,
  params: { id: string; userId: string; updatedAt: string },
): Promise<void> {
  const updatedAt = clampUpdatedAtIso(params.updatedAt);
  const { data, error } = await client
    .from('workout_sets')
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
    throw new DbQueryError('tombstoneWorkoutSet matched no live row');
  }
}
