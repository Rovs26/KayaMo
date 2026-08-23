import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getOfflineDb, KayaMoDB, resetOfflineDb } from './db';
import { pendingCount } from './queue';
import {
  completeLocalWorkoutSet,
  finishLocalWorkout,
  getLocalRestTimer,
  listLocalWorkoutHistory,
  listLocalWorkoutSets,
  mergeRemoteWorkoutSets,
  mergeRemoteWorkouts,
  startLocalRestTimer,
  startLocalWorkout,
  tombstoneLocalWorkout,
} from './training';

vi.mock('./sync', async () => {
  const status = await import('./status');
  return {
    drainQueue: vi.fn(async () => undefined),
    startSync: vi.fn(),
    getSyncStatusSnapshot: vi.fn(() => ({ kind: 'synced' })),
    bindStatusStore: status.subscribeSyncStatus,
    resumeSync: vi.fn(),
  };
});

describe('offline workout sessions', () => {
  beforeEach(resetOfflineDb);
  afterEach(resetOfflineDb);

  it('survives a database close and resumes the active workout and rest timer', async () => {
    const workout = await startLocalWorkout({
      id: '40000000-0000-4000-8000-000000000001',
      userId: 'user-a',
      startedAt: '2026-08-22T08:00:00.000Z',
      timeZone: 'Asia/Manila',
    });
    await completeLocalWorkoutSet({
      id: '40000000-0000-4000-8000-000000000002',
      userId: 'user-a',
      workoutId: workout.id,
      exerciseId: '40000000-0000-4000-8000-000000000003',
      exerciseName: 'Back Squat',
      exerciseOrder: 0,
      setIndex: 0,
      weightKg: 100,
      reps: 5,
      rpe: 8,
      restSeconds: 120,
      completedAt: '2026-08-22T08:05:00.000Z',
    });
    await startLocalRestTimer({
      workoutId: workout.id,
      userId: 'user-a',
      seconds: 120,
      startedAt: '2026-08-22T08:05:00.000Z',
    });

    getOfflineDb().close();
    const reopened = new KayaMoDB();
    const savedWorkout = await reopened.workouts.get(workout.id);
    const savedSet = await reopened.workout_sets.get(
      '40000000-0000-4000-8000-000000000002',
    );
    const timer = await reopened.rest_timers.get(workout.id);
    reopened.close();

    expect(savedWorkout?.status).toBe('active');
    expect(savedSet?.e1rm_brzycki_kg).toBe('112.5');
    expect(timer?.ends_at).toBe('2026-08-22T08:07:00.000Z');
  });

  it('keeps a workout and its sets tombstoned after a stale sync round-trip', async () => {
    const workout = await startLocalWorkout({
      id: '50000000-0000-4000-8000-000000000001',
      userId: 'user-a',
      startedAt: '2026-08-22T08:00:00.000Z',
    });
    const set = await completeLocalWorkoutSet({
      id: '50000000-0000-4000-8000-000000000002',
      userId: 'user-a',
      workoutId: workout.id,
      exerciseId: '50000000-0000-4000-8000-000000000003',
      exerciseName: 'Bench Press',
      exerciseOrder: 0,
      setIndex: 0,
      weightKg: 60,
      reps: 8,
    });
    await tombstoneLocalWorkout({ id: workout.id, userId: 'user-a' });

    await mergeRemoteWorkouts([{ ...workout, updated_at: '2000-01-01T00:00:00.000Z' }]);
    await mergeRemoteWorkoutSets([{ ...set, updated_at: '2000-01-01T00:00:00.000Z' }]);

    expect(await listLocalWorkoutHistory('user-a')).toEqual([]);
    expect(await listLocalWorkoutSets(workout.id)).toEqual([]);
    expect((await getOfflineDb().workouts.get(workout.id))?.deleted_at).toBeTruthy();
    expect((await getOfflineDb().workout_sets.get(set.id))?.deleted_at).toBeTruthy();
    expect(await pendingCount()).toBe(2);
  });

  it('finishes a workout offline and clears its persisted rest timer', async () => {
    const workout = await startLocalWorkout({ userId: 'user-a' });
    await startLocalRestTimer({
      workoutId: workout.id,
      userId: 'user-a',
      seconds: 90,
    });
    const finished = await finishLocalWorkout({ id: workout.id, userId: 'user-a' });

    expect(finished?.status).toBe('completed');
    expect(finished?.ended_at).toBeTruthy();
    expect(await getLocalRestTimer(workout.id)).toBeUndefined();
  });
});
