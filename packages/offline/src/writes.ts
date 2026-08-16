import type { FoodEntryWrite } from '@kayamo/db';
import { getOfflineDb, type LocalFoodEntry, type LocalWeightLog, type LocalWorkout } from './db';
import { logicalDateFromInstant } from './logical-date';
import { enqueueUpsert } from './queue';
import { drainQueue } from './sync';

function newId(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

export type LogFoodEntryInput = {
  userId: string;
  mealSlot: FoodEntryWrite['meal_slot'];
  foodId: string;
  foodName: string;
  quantity: string;
  grams: string;
  kcal: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  fiber_g: string;
  sugar_g: string;
  sodium_mg: string;
  source: FoodEntryWrite['source'];
  resolvedVia: FoodEntryWrite['resolved_via'];
  inputMethod: FoodEntryWrite['input_method'];
  servingId?: string | null;
  servingLabel?: string | null;
  timeZone?: string;
  dayStartsAt?: string;
};

export async function logFoodEntry(input: LogFoodEntryInput): Promise<LocalFoodEntry> {
  const loggedAt = nowIso();
  const updatedAt = loggedAt;
  const entry: LocalFoodEntry = {
    id: newId(),
    user_id: input.userId,
    logged_at: loggedAt,
    logical_date: logicalDateFromInstant(loggedAt, input.timeZone, input.dayStartsAt),
    meal_slot: input.mealSlot,
    food_id: input.foodId,
    recipe_id: null,
    quantity: input.quantity,
    serving_id: input.servingId ?? null,
    grams: input.grams,
    kcal: input.kcal,
    protein_g: input.protein_g,
    carbs_g: input.carbs_g,
    fat_g: input.fat_g,
    fiber_g: input.fiber_g,
    sugar_g: input.sugar_g,
    sodium_mg: input.sodium_mg,
    source: input.source,
    confidence: '0.80',
    input_method: input.inputMethod,
    photo_url: null,
    raw_input: null,
    food_name_snapshot: input.foodName,
    serving_label_snapshot: input.servingLabel ?? null,
    resolved_via: input.resolvedVia,
    created_at: loggedAt,
    updated_at: updatedAt,
    server_updated_at: loggedAt,
    deleted_at: null,
  };

  await getOfflineDb().food_entries.put(entry);
  await enqueueUpsert('food_entries', entry.id, toFoodEntryPayload(entry));
  void drainQueue();
  return entry;
}

export async function tombstoneLocalFoodEntry(params: {
  id: string;
  userId: string;
}): Promise<void> {
  const db = getOfflineDb();
  const existing = await db.food_entries.get(params.id);
  if (!existing || existing.user_id !== params.userId) return;
  const updatedAt = nowIso();
  const next: LocalFoodEntry = { ...existing, deleted_at: updatedAt, updated_at: updatedAt };
  await db.food_entries.put(next);
  await enqueueUpsert('food_entries', next.id, toFoodEntryPayload(next));
  void drainQueue();
}

export async function listLocalFoodEntries(
  userId: string,
  logicalDate: string,
): Promise<LocalFoodEntry[]> {
  const rows = await getOfflineDb().food_entries.where('user_id').equals(userId).toArray();
  return rows
    .filter((row) => row.logical_date === logicalDate && !row.deleted_at)
    .sort((a, b) => a.logged_at.localeCompare(b.logged_at));
}

export async function logWeight(input: {
  userId: string;
  weightKg: string;
  source: LocalWeightLog['source'];
  timeZone?: string;
  dayStartsAt?: string;
}): Promise<LocalWeightLog> {
  const loggedAt = nowIso();
  const logicalDate = logicalDateFromInstant(loggedAt, input.timeZone, input.dayStartsAt);
  const row: LocalWeightLog = {
    id: newId(),
    user_id: input.userId,
    logged_at: loggedAt,
    measured_on: logicalDate,
    logical_date: logicalDate,
    weight_kg: input.weightKg,
    source: input.source,
    created_at: loggedAt,
    updated_at: loggedAt,
    server_updated_at: loggedAt,
    deleted_at: null,
  };
  await getOfflineDb().weight_logs.put(row);
  await enqueueUpsert('weight_logs', row.id, { ...row });
  void drainQueue();
  return row;
}

export async function logWorkout(input: {
  userId: string;
  notes?: string | null;
  timeZone?: string;
  dayStartsAt?: string;
}): Promise<LocalWorkout> {
  const startedAt = nowIso();
  const row: LocalWorkout = {
    id: newId(),
    user_id: input.userId,
    started_at: startedAt,
    ended_at: null,
    logical_date: logicalDateFromInstant(startedAt, input.timeZone, input.dayStartsAt),
    notes: input.notes ?? null,
    routine_id: null,
    created_at: startedAt,
    updated_at: startedAt,
    server_updated_at: startedAt,
    deleted_at: null,
  };
  await getOfflineDb().workouts.put(row);
  await enqueueUpsert('workouts', row.id, { ...row });
  void drainQueue();
  return row;
}

function toFoodEntryPayload(entry: LocalFoodEntry): FoodEntryWrite {
  return {
    id: entry.id,
    user_id: entry.user_id,
    logged_at: entry.logged_at,
    meal_slot: entry.meal_slot,
    food_id: entry.food_id,
    recipe_id: entry.recipe_id,
    quantity: entry.quantity,
    serving_id: entry.serving_id,
    grams: entry.grams,
    kcal: entry.kcal,
    protein_g: entry.protein_g,
    carbs_g: entry.carbs_g,
    fat_g: entry.fat_g,
    fiber_g: entry.fiber_g,
    sugar_g: entry.sugar_g,
    sodium_mg: entry.sodium_mg,
    source: entry.source,
    confidence: entry.confidence,
    input_method: entry.input_method,
    photo_url: entry.photo_url,
    raw_input: entry.raw_input,
    food_name_snapshot: entry.food_name_snapshot,
    serving_label_snapshot: entry.serving_label_snapshot,
    resolved_via: entry.resolved_via,
    updated_at: entry.updated_at,
    deleted_at: entry.deleted_at,
  };
}
