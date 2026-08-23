import type { Profile } from '../database';
import type { DbClient } from './client';
import { DbQueryError, throwIfError } from './errors';
import { clampUpdatedAtIso } from './lww';

export async function getProfile(
  client: DbClient,
  userId: string,
): Promise<Profile | null> {
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  throwIfError(error);
  return data;
}

export async function updateProfile(
  client: DbClient,
  params: {
    userId: string;
    patch: Partial<
      Pick<
        Profile,
        | 'sex'
        | 'birth_year'
        | 'height_cm'
        | 'activity_baseline'
        | 'goal'
        | 'timezone'
        | 'locale'
        | 'day_starts_at'
      >
    >;
    updatedAt: string;
  },
): Promise<Profile> {
  const { data, error } = await client
    .from('profiles')
    .update({ ...params.patch, updated_at: clampUpdatedAtIso(params.updatedAt) })
    .eq('user_id', params.userId)
    .select('*')
    .single();
  throwIfError(error);
  if (!data) throw new DbQueryError('updateProfile returned no row');
  return data;
}

export type LogicalDateRecomputeResult = {
  food_entries: number;
  weight_logs: number;
  workouts: number;
};

/** Explicitly re-bucket live history after a timezone/day-boundary change. */
export async function recomputeLogicalDates(
  client: DbClient,
): Promise<LogicalDateRecomputeResult> {
  const { data, error } = await client.rpc('kayamo_recompute_logical_dates');
  throwIfError(error);
  if (!data) throw new DbQueryError('recomputeLogicalDates returned no result');
  return data;
}
