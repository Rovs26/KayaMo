import Dexie, { type Table } from 'dexie';
import type { Food, FoodEntry, Serving, WeightLog, Workout, WorkoutSet } from '@kayamo/db';

export type LocalFoodEntry = FoodEntry;
export type LocalWeightLog = WeightLog;
export type LocalWorkout = Workout;
export type LocalWorkoutSet = WorkoutSet;
export type LocalFood = Food;
export type LocalServing = Serving;

export type SyncableTable = 'food_entries' | 'weight_logs' | 'workouts' | 'workout_sets';

export type SyncQueueItem = {
  id: string;
  table: SyncableTable;
  entityId: string;
  payload: Record<string, unknown>;
  attempt: number;
  nextAttemptAt: number;
  lastError: string | null;
};

export class KayaMoDB extends Dexie {
  food_entries!: Table<LocalFoodEntry, string>;
  weight_logs!: Table<LocalWeightLog, string>;
  workouts!: Table<LocalWorkout, string>;
  workout_sets!: Table<LocalWorkoutSet, string>;
  foods!: Table<LocalFood, string>;
  servings!: Table<LocalServing, string>;
  sync_queue!: Table<SyncQueueItem, string>;

  constructor() {
    super('kayamo');
    this.version(1).stores({
      food_entries: 'id, user_id, logical_date, logged_at, updated_at, deleted_at',
      weight_logs: 'id, user_id, logical_date, measured_on, updated_at, deleted_at',
      workouts: 'id, user_id, logical_date, started_at, updated_at, deleted_at',
      workout_sets: 'id, workout_id, updated_at, deleted_at',
      foods: 'id, source, source_id, barcode, updated_at, deleted_at',
      servings: 'id, food_id',
      sync_queue: 'id, nextAttemptAt, table, entityId',
    });
  }
}

let instance: KayaMoDB | undefined;

export function getOfflineDb(): KayaMoDB {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB is not available');
  }
  if (!instance) {
    instance = new KayaMoDB();
  }
  return instance;
}

export async function resetOfflineDb(): Promise<void> {
  if (instance) {
    instance.close();
    await Dexie.delete('kayamo');
    instance = undefined;
  } else if (typeof indexedDB !== 'undefined') {
    await Dexie.delete('kayamo');
  }
}

export function queueItemId(table: SyncableTable, entityId: string): string {
  return `${table}:${entityId}`;
}
