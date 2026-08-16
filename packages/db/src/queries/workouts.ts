import type { Workout, WorkoutInsert, WorkoutSet } from '../database';
import type { DbClient } from './client';
import { DbQueryError, throwIfError } from './errors';
import { clampUpdatedAtIso, omitKeys, omitServerCursor } from './lww';

type WorkoutWrite = Omit<WorkoutInsert, 'logical_date' | 'server_updated_at' | 'created_at'> & {
  logical_date?: string;
  created_at?: string;
  server_updated_at?: string;
};

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

export async function insertWorkout(client: DbClient, row: WorkoutWrite): Promise<Workout> {
  const rest = omitKeys(omitServerCursor(row), ['logical_date']);
  const { data, error } = await client
    .from('workouts')
    .insert({ ...rest, updated_at: clampUpdatedAtIso(row.updated_at) })
    .select('*')
    .single();
  throwIfError(error);
  if (!data) throw new DbQueryError('insertWorkout returned no row');
  return data;
}

export async function tombstoneWorkout(
  client: DbClient,
  params: { id: string; userId: string; updatedAt: string },
): Promise<void> {
  const { data, error } = await client
    .from('workouts')
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
    throw new DbQueryError('tombstoneWorkout matched no live row');
  }
}

export async function listWorkoutSets(client: DbClient, workoutId: string): Promise<WorkoutSet[]> {
  const { data, error } = await client
    .from('workout_sets')
    .select('*')
    .eq('workout_id', workoutId)
    .is('deleted_at', null)
    .order('set_index', { ascending: true });
  throwIfError(error);
  return data ?? [];
}

export async function tombstoneWorkoutSet(
  client: DbClient,
  params: { id: string; updatedAt: string },
): Promise<void> {
  const { data, error } = await client
    .from('workout_sets')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: clampUpdatedAtIso(params.updatedAt),
    })
    .eq('id', params.id)
    .is('deleted_at', null)
    .select('id');
  throwIfError(error);
  if (!data?.length) {
    throw new DbQueryError('tombstoneWorkoutSet matched no live row');
  }
}
