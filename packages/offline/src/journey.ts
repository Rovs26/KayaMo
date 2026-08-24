import {
  COMPANION_EVENT_POINTS,
  companionEventKey,
  reduceCompanionEvents,
  type CompanionEventType,
} from '@kayamo/core';
import type {
  CompanionEventWrite,
  GoalMilestoneWrite,
  GoalWrite,
  HabitCompletionWrite,
  HabitWrite,
} from '@kayamo/db';
import { incomingWins, omitServerCursor } from '@kayamo/db';
import {
  getOfflineDb,
  type LocalCompanionEvent,
  type LocalGoal,
  type LocalGoalMilestone,
  type LocalHabit,
  type LocalHabitCompletion,
} from './db';
import { logicalDateFromInstant } from './logical-date';
import { enqueueUpsert } from './queue';
import { drainQueue } from './sync';

const newId = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

const goalPayload = (row: LocalGoal): GoalWrite => omitServerCursor(row);
const milestonePayload = (row: LocalGoalMilestone): GoalMilestoneWrite =>
  omitServerCursor(row);
const habitPayload = (row: LocalHabit): HabitWrite => omitServerCursor(row);
const completionPayload = (row: LocalHabitCompletion): HabitCompletionWrite =>
  omitServerCursor(row);

export async function createLocalCompanionEvent(input: {
  userId: string;
  eventType: CompanionEventType;
  sourceTable: string;
  sourceId: string;
  logicalDate: string;
}): Promise<LocalCompanionEvent> {
  const db = getOfflineDb();
  const eventKey = companionEventKey(input);
  const existing = await db.companion_events
    .where('[user_id+event_key]')
    .equals([input.userId, eventKey])
    .first();
  if (existing) return existing;
  const at = nowIso();
  const row: LocalCompanionEvent = {
    id: newId(),
    user_id: input.userId,
    event_key: eventKey,
    event_type: input.eventType,
    source_table: input.sourceTable,
    source_id: input.sourceId,
    logical_date: input.logicalDate,
    points: COMPANION_EVENT_POINTS[input.eventType],
    created_at: at,
    server_updated_at: at,
  };
  await db.companion_events.put(row);
  const payload: CompanionEventWrite = {
    id: row.id,
    user_id: row.user_id,
    event_key: row.event_key,
    event_type: row.event_type,
    source_table: row.source_table,
    source_id: row.source_id,
    logical_date: row.logical_date,
    created_at: row.created_at,
  };
  await enqueueUpsert('companion_events', row.id, payload);
  void drainQueue();
  return row;
}

export async function createLocalGoal(input: {
  userId: string;
  title: string;
  description?: string | null;
  kind?: LocalGoal['kind'];
  startsOn?: string | null;
  targetDate?: string | null;
  origin?: LocalGoal['origin'];
  id?: string;
}): Promise<LocalGoal> {
  const at = nowIso();
  const row: LocalGoal = {
    id: input.id ?? newId(),
    user_id: input.userId,
    title: input.title.trim(),
    description: input.description ?? null,
    kind: input.kind ?? 'goal',
    status: 'active',
    starts_on: input.startsOn ?? null,
    target_date: input.targetDate ?? null,
    completed_at: null,
    origin: input.origin ?? 'user',
    created_at: at,
    updated_at: at,
    server_updated_at: at,
    deleted_at: null,
  };
  await getOfflineDb().goals.put(row);
  await enqueueUpsert('goals', row.id, goalPayload(row));
  void drainQueue();
  return row;
}

export async function setLocalGoalStatus(input: {
  id: string;
  userId: string;
  status: 'active' | 'paused' | 'completed' | 'released';
  timeZone?: string;
  dayStartsAt?: string;
}): Promise<LocalGoal | null> {
  const db = getOfflineDb();
  const existing = await db.goals.get(input.id);
  if (!existing || existing.user_id !== input.userId || existing.deleted_at) return null;
  const at = nowIso();
  const row: LocalGoal = {
    ...existing,
    status: input.status,
    completed_at: input.status === 'completed' ? at : null,
    updated_at: at,
  };
  await db.goals.put(row);
  await enqueueUpsert('goals', row.id, goalPayload(row));
  if (input.status === 'completed') {
    await createLocalCompanionEvent({
      userId: input.userId,
      eventType: 'goal_completed',
      sourceTable: 'goals',
      sourceId: row.id,
      logicalDate: logicalDateFromInstant(at, input.timeZone, input.dayStartsAt),
    });
  }
  void drainQueue();
  return row;
}

export async function createLocalGoalMilestone(input: {
  userId: string;
  goalId: string;
  title: string;
  sortOrder?: number;
  targetDate?: string | null;
  id?: string;
}): Promise<LocalGoalMilestone> {
  const db = getOfflineDb();
  const goal = await db.goals.get(input.goalId);
  if (!goal || goal.user_id !== input.userId || goal.deleted_at) {
    throw new Error('Milestone requires an owned, live goal');
  }
  const at = nowIso();
  const row: LocalGoalMilestone = {
    id: input.id ?? newId(),
    user_id: input.userId,
    goal_id: input.goalId,
    title: input.title.trim(),
    sort_order: input.sortOrder ?? 0,
    target_date: input.targetDate ?? null,
    completed_at: null,
    created_at: at,
    updated_at: at,
    server_updated_at: at,
    deleted_at: null,
  };
  await db.goal_milestones.put(row);
  await enqueueUpsert('goal_milestones', row.id, milestonePayload(row));
  void drainQueue();
  return row;
}

export async function updateLocalGoalMilestone(input: {
  id: string;
  userId: string;
  title: string;
}): Promise<LocalGoalMilestone | null> {
  const db = getOfflineDb();
  const existing = await db.goal_milestones.get(input.id);
  if (!existing || existing.user_id !== input.userId || existing.deleted_at) return null;
  const title = input.title.trim();
  if (!title) return existing;
  const at = nowIso();
  const row = { ...existing, title, updated_at: at };
  await db.goal_milestones.put(row);
  await enqueueUpsert('goal_milestones', row.id, milestonePayload(row));
  void drainQueue();
  return row;
}

export async function completeLocalGoalMilestone(input: {
  id: string;
  userId: string;
  timeZone?: string;
  dayStartsAt?: string;
}): Promise<LocalGoalMilestone | null> {
  const db = getOfflineDb();
  const existing = await db.goal_milestones.get(input.id);
  if (!existing || existing.user_id !== input.userId || existing.deleted_at) return null;
  if (existing.completed_at) return existing;
  const at = nowIso();
  const row = { ...existing, completed_at: at, updated_at: at };
  await db.goal_milestones.put(row);
  await enqueueUpsert('goal_milestones', row.id, milestonePayload(row));
  await createLocalCompanionEvent({
    userId: input.userId,
    eventType: 'milestone_completed',
    sourceTable: 'goal_milestones',
    sourceId: row.id,
    logicalDate: logicalDateFromInstant(at, input.timeZone, input.dayStartsAt),
  });
  void drainQueue();
  return row;
}

export async function createLocalHabit(input: {
  userId: string;
  title: string;
  notes?: string | null;
  goalId?: string | null;
  frequency?: LocalHabit['frequency'];
  targetPerPeriod?: number;
  origin?: LocalHabit['origin'];
  id?: string;
}): Promise<LocalHabit> {
  const db = getOfflineDb();
  if (input.goalId) {
    const goal = await db.goals.get(input.goalId);
    if (!goal || goal.user_id !== input.userId || goal.deleted_at) {
      throw new Error('Habit goal must be owned and live');
    }
  }
  const at = nowIso();
  const row: LocalHabit = {
    id: input.id ?? newId(),
    user_id: input.userId,
    goal_id: input.goalId ?? null,
    title: input.title.trim(),
    notes: input.notes ?? null,
    frequency: input.frequency ?? 'daily',
    target_per_period: input.targetPerPeriod ?? 1,
    active: true,
    origin: input.origin ?? 'user',
    created_at: at,
    updated_at: at,
    server_updated_at: at,
    deleted_at: null,
  };
  await db.habits.put(row);
  await enqueueUpsert('habits', row.id, habitPayload(row));
  void drainQueue();
  return row;
}

export async function completeLocalHabit(input: {
  userId: string;
  habitId: string;
  completedAt?: string;
  timeZone?: string;
  dayStartsAt?: string;
  id?: string;
}): Promise<LocalHabitCompletion> {
  const db = getOfflineDb();
  const habit = await db.habits.get(input.habitId);
  if (!habit || habit.user_id !== input.userId || habit.deleted_at || !habit.active) {
    throw new Error('Completion requires an owned, active habit');
  }
  const completedAt = input.completedAt ?? nowIso();
  const logicalDate = logicalDateFromInstant(
    completedAt,
    input.timeZone,
    input.dayStartsAt,
  );
  const duplicate = await db.habit_completions
    .where('[habit_id+logical_date]')
    .equals([input.habitId, logicalDate])
    .filter((row) => !row.deleted_at)
    .first();
  if (duplicate) return duplicate;
  const prior = (
    await db.habit_completions.where('habit_id').equals(input.habitId).toArray()
  )
    .filter((row) => !row.deleted_at && row.logical_date < logicalDate)
    .sort((a, b) => b.logical_date.localeCompare(a.logical_date))[0];
  const row: LocalHabitCompletion = {
    id: input.id ?? newId(),
    user_id: input.userId,
    habit_id: input.habitId,
    logical_date: logicalDate,
    completed_at: completedAt,
    created_at: completedAt,
    updated_at: completedAt,
    server_updated_at: completedAt,
    deleted_at: null,
  };
  await db.habit_completions.put(row);
  await enqueueUpsert('habit_completions', row.id, completionPayload(row));
  await createLocalCompanionEvent({
    userId: input.userId,
    eventType: 'habit_completed',
    sourceTable: 'habit_completions',
    sourceId: row.id,
    logicalDate,
  });
  if (prior && daysBetween(prior.logical_date, logicalDate) >= 2) {
    await createLocalCompanionEvent({
      userId: input.userId,
      eventType: 'recovery_return',
      sourceTable: 'habit_completions',
      sourceId: row.id,
      logicalDate,
    });
  }
  void drainQueue();
  return row;
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
  );
}

export async function tombstoneLocalGoal(params: {
  id: string;
  userId: string;
}): Promise<void> {
  const db = getOfflineDb();
  const goal = await db.goals.get(params.id);
  if (!goal || goal.user_id !== params.userId || goal.deleted_at) return;
  const at = nowIso();
  const milestones = await db.goal_milestones.where('goal_id').equals(goal.id).toArray();
  const habits = await db.habits.where('goal_id').equals(goal.id).toArray();
  const habitIds = new Set(habits.map((habit) => habit.id));
  const completions = (await db.habit_completions.toArray()).filter((completion) =>
    habitIds.has(completion.habit_id),
  );
  const tombstoneRow = <T extends { deleted_at: string | null; updated_at: string }>(
    row: T,
  ): T => ({ ...row, deleted_at: row.deleted_at ?? at, updated_at: at });
  await db.transaction(
    'rw',
    db.goals,
    db.goal_milestones,
    db.habits,
    db.habit_completions,
    async () => {
      await db.goal_milestones.bulkPut(milestones.map(tombstoneRow));
      await db.habit_completions.bulkPut(completions.map(tombstoneRow));
      await db.habits.bulkPut(habits.map(tombstoneRow));
      await db.goals.put(tombstoneRow(goal));
    },
  );
  for (const row of completions.map(tombstoneRow)) {
    await enqueueUpsert('habit_completions', row.id, completionPayload(row));
  }
  for (const row of milestones.map(tombstoneRow)) {
    await enqueueUpsert('goal_milestones', row.id, milestonePayload(row));
  }
  for (const row of habits.map(tombstoneRow)) {
    await enqueueUpsert('habits', row.id, habitPayload(row));
  }
  const deletedGoal = tombstoneRow(goal);
  await enqueueUpsert('goals', deletedGoal.id, goalPayload(deletedGoal));
  void drainQueue();
}

export async function listLocalGoals(userId: string): Promise<LocalGoal[]> {
  const kindOrder: Record<LocalGoal['kind'], number> = {
    goal: 0,
    campaign: 1,
    chapter: 2,
  };
  return (await getOfflineDb().goals.where('user_id').equals(userId).toArray())
    .filter((row) => !row.deleted_at)
    .sort(
      (a, b) =>
        (kindOrder[a.kind] ?? 0) - (kindOrder[b.kind] ?? 0) ||
        a.created_at.localeCompare(b.created_at) ||
        a.id.localeCompare(b.id),
    );
}

export async function listLocalGoalMilestones(
  userId: string,
  goalId: string,
): Promise<LocalGoalMilestone[]> {
  return (await getOfflineDb().goal_milestones.where('goal_id').equals(goalId).toArray())
    .filter((row) => row.user_id === userId && !row.deleted_at)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export async function listLocalHabits(userId: string): Promise<LocalHabit[]> {
  return (await getOfflineDb().habits.where('user_id').equals(userId).toArray()).filter(
    (row) => !row.deleted_at && row.active,
  );
}

export async function listLocalHabitCompletions(
  userId: string,
  logicalDate?: string,
): Promise<LocalHabitCompletion[]> {
  return (
    await getOfflineDb().habit_completions.where('user_id').equals(userId).toArray()
  ).filter(
    (row) => !row.deleted_at && (!logicalDate || row.logical_date === logicalDate),
  );
}

export async function listLocalCompanionPresenceDates(userId: string): Promise<string[]> {
  const rows = await getOfflineDb().companion_events.where('user_id').equals(userId).toArray();
  return [...new Set(rows.map((row) => row.logical_date))].sort();
}

export async function getLocalCompanionProgression(userId: string) {
  const rows = await getOfflineDb()
    .companion_events.where('user_id')
    .equals(userId)
    .toArray();
  return reduceCompanionEvents(
    rows.map((row) => ({
      eventKey: row.event_key,
      eventType: row.event_type as CompanionEventType,
      sourceTable: row.source_table,
      sourceId: row.source_id,
      logicalDate: row.logical_date,
    })),
  );
}

async function mergeRows<T extends { id: string; updated_at?: string }>(
  table: { get(id: string): Promise<T | undefined>; put(row: T): Promise<unknown> },
  rows: T[],
): Promise<void> {
  for (const row of rows) {
    const existing = await table.get(row.id);
    if (
      !existing ||
      !existing.updated_at ||
      !row.updated_at ||
      incomingWins(existing.updated_at, row.updated_at)
    ) {
      await table.put(row);
    }
  }
}

export const mergeRemoteGoals = (rows: LocalGoal[]) =>
  mergeRows(getOfflineDb().goals, rows);
export const mergeRemoteGoalMilestones = (rows: LocalGoalMilestone[]) =>
  mergeRows(getOfflineDb().goal_milestones, rows);
export const mergeRemoteHabits = (rows: LocalHabit[]) =>
  mergeRows(getOfflineDb().habits, rows);
export const mergeRemoteHabitCompletions = (rows: LocalHabitCompletion[]) =>
  mergeRows(getOfflineDb().habit_completions, rows);

export async function mergeRemoteCompanionEvents(
  rows: LocalCompanionEvent[],
): Promise<void> {
  const db = getOfflineDb();
  for (const row of rows) {
    const duplicate = await db.companion_events
      .where('[user_id+event_key]')
      .equals([row.user_id, row.event_key])
      .first();
    if (duplicate && duplicate.id !== row.id)
      await db.companion_events.delete(duplicate.id);
    await db.companion_events.put(row);
  }
}
