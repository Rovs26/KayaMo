import type {
  DailyLoopPreferenceWrite,
  DailyPlanWrite,
  FocusSessionWrite,
} from '@kayamo/db';
import { incomingWins, omitServerCursor, REVIEWED_SCRIPTURE_PASSAGES } from '@kayamo/db';
import {
  getOfflineDb,
  type LocalDailyLoopPreference,
  type LocalDailyPlan,
  type LocalFocusSession,
  type LocalScripturePassage,
} from './db';
import { enqueueUpsert } from './queue';
import { drainQueue } from './sync';

const newId = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

function planPayload(row: LocalDailyPlan): DailyPlanWrite {
  return omitServerCursor(row);
}

function focusPayload(row: LocalFocusSession): FocusSessionWrite {
  return omitServerCursor(row);
}

export async function saveLocalDailyPlan(input: {
  userId: string;
  logicalDate: string;
  actionKind?: LocalDailyPlan['selected_action_kind'];
  recordId?: string | null;
  label?: string | null;
  completeMorning?: boolean;
  capacity?: LocalDailyPlan['capacity'];
  dayIntent?: LocalDailyPlan['day_intent'];
  planMode?: LocalDailyPlan['plan_mode'];
  tomorrowNote?: string | null;
  id?: string;
}): Promise<LocalDailyPlan> {
  const db = getOfflineDb();
  const existing = await db.daily_plans
    .where('[user_id+logical_date]')
    .equals([input.userId, input.logicalDate])
    .filter((row) => !row.deleted_at)
    .first();
  const at = nowIso();
  const tomorrow =
    input.tomorrowNote === undefined
      ? (existing?.tomorrow_note ?? null)
      : input.tomorrowNote?.trim() || null;
  const row: LocalDailyPlan = {
    id: existing?.id ?? input.id ?? newId(),
    user_id: input.userId,
    logical_date: input.logicalDate,
    selected_action_kind: input.actionKind ?? existing?.selected_action_kind ?? null,
    selected_record_id: input.recordId ?? existing?.selected_record_id ?? null,
    selected_label_snapshot:
      input.label?.trim() || existing?.selected_label_snapshot || null,
    morning_completed_at:
      input.completeMorning === true ? at : (existing?.morning_completed_at ?? null),
    evening_completed_at: existing?.evening_completed_at ?? null,
    capacity: input.capacity ?? existing?.capacity ?? null,
    day_intent: input.dayIntent ?? existing?.day_intent ?? null,
    plan_mode: input.planMode ?? existing?.plan_mode ?? null,
    tomorrow_note: tomorrow,
    created_at: existing?.created_at ?? at,
    updated_at: at,
    server_updated_at: existing?.server_updated_at ?? at,
    deleted_at: null,
  };
  await db.daily_plans.put(row);
  await enqueueUpsert('daily_plans', row.id, planPayload(row));
  void drainQueue();
  return row;
}

export async function completeLocalEveningReflection(input: {
  userId: string;
  logicalDate: string;
  reflection?: string;
  gratitude?: string;
}): Promise<LocalDailyPlan> {
  const db = getOfflineDb();
  const plan = await saveLocalDailyPlan({
    userId: input.userId,
    logicalDate: input.logicalDate,
  });
  const at = nowIso();
  const completed = {
    ...plan,
    evening_completed_at: at,
    updated_at: at,
    tomorrow_note: input.reflection?.trim() || plan.tomorrow_note,
  };
  await db.daily_plans.put(completed);
  await enqueueUpsert('daily_plans', completed.id, planPayload(completed));
  if (input.reflection?.trim()) {
    await db.local_journal_entries.put({
      id: newId(), user_id: input.userId, kind: 'reflection',
      content: input.reflection, created_at: at, updated_at: at,
    });
  }
  if (input.gratitude?.trim()) {
    await db.local_journal_entries.put({
      id: newId(), user_id: input.userId, kind: 'gratitude',
      content: input.gratitude, created_at: at, updated_at: at,
    });
  }
  void drainQueue();
  return completed;
}

export async function getLocalDailyPlan(
  userId: string,
  logicalDate: string,
): Promise<LocalDailyPlan | null> {
  return (
    (await getOfflineDb().daily_plans
      .where('[user_id+logical_date]')
      .equals([userId, logicalDate])
      .filter((row) => !row.deleted_at)
      .first()) ?? null
  );
}

export async function tombstoneLocalDailyPlan(params: {
  id: string;
  userId: string;
}): Promise<void> {
  const db = getOfflineDb();
  const existing = await db.daily_plans.get(params.id);
  if (!existing || existing.user_id !== params.userId || existing.deleted_at) return;
  const at = nowIso();
  const row = { ...existing, deleted_at: at, updated_at: at };
  await db.daily_plans.put(row);
  await enqueueUpsert('daily_plans', row.id, planPayload(row));
  void drainQueue();
}

export async function createLocalFocusSession(input: {
  userId: string;
  logicalDate: string;
  dailyPlanId?: string | null;
  targetKind: LocalFocusSession['target_kind'];
  targetRecordId?: string | null;
  targetLabel: string;
  plannedMinutes?: number;
  id?: string;
}): Promise<LocalFocusSession> {
  const at = nowIso();
  const row: LocalFocusSession = {
    id: input.id ?? newId(), user_id: input.userId,
    daily_plan_id: input.dailyPlanId ?? null, logical_date: input.logicalDate,
    target_kind: input.targetKind, target_record_id: input.targetRecordId ?? null,
    target_label_snapshot: input.targetLabel.trim(),
    planned_minutes: input.plannedMinutes ?? 25, status: 'scheduled',
    started_at: null, ends_at: null, completed_at: null, cancelled_at: null,
    created_at: at, updated_at: at, server_updated_at: at, deleted_at: null,
  };
  await getOfflineDb().focus_sessions.put(row);
  await enqueueUpsert('focus_sessions', row.id, focusPayload(row));
  void drainQueue();
  return row;
}

export async function startLocalFocusSession(params: {
  id: string; userId: string; startedAt?: string;
}): Promise<LocalFocusSession | null> {
  const db = getOfflineDb();
  const existing = await db.focus_sessions.get(params.id);
  if (!existing || existing.user_id !== params.userId || existing.deleted_at || existing.status !== 'scheduled') return null;
  const at = params.startedAt ?? nowIso();
  const row: LocalFocusSession = {
    ...existing, status: 'active', started_at: at,
    ends_at: new Date(Date.parse(at) + existing.planned_minutes * 60_000).toISOString(),
    updated_at: at,
  };
  await db.focus_sessions.put(row);
  await enqueueUpsert('focus_sessions', row.id, focusPayload(row));
  void drainQueue();
  return row;
}

export async function finishLocalFocusSession(params: {
  id: string; userId: string; outcome: 'completed' | 'cancelled'; at?: string;
}): Promise<LocalFocusSession | null> {
  const db = getOfflineDb();
  const existing = await db.focus_sessions.get(params.id);
  if (!existing || existing.user_id !== params.userId || existing.deleted_at || existing.status !== 'active') return null;
  const at = params.at ?? nowIso();
  const row: LocalFocusSession = {
    ...existing, status: params.outcome,
    completed_at: params.outcome === 'completed' ? at : null,
    cancelled_at: params.outcome === 'cancelled' ? at : null,
    updated_at: at,
  };
  await db.focus_sessions.put(row);
  await enqueueUpsert('focus_sessions', row.id, focusPayload(row));
  void drainQueue();
  return row;
}

export async function listLocalFocusSessions(
  userId: string,
  logicalDate: string,
): Promise<LocalFocusSession[]> {
  return (await getOfflineDb().focus_sessions.where('user_id').equals(userId).toArray())
    .filter((row) => !row.deleted_at && row.logical_date === logicalDate)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function tombstoneLocalFocusSession(params: { id: string; userId: string }): Promise<void> {
  const db = getOfflineDb();
  const existing = await db.focus_sessions.get(params.id);
  if (!existing || existing.user_id !== params.userId || existing.deleted_at) return;
  const at = nowIso();
  const row = { ...existing, deleted_at: at, updated_at: at };
  await db.focus_sessions.put(row);
  await enqueueUpsert('focus_sessions', row.id, focusPayload(row));
  void drainQueue();
}

export async function saveLocalDailyLoopPreferences(input: {
  userId: string;
  notificationsEnabled?: boolean;
  morningReminderAt?: string;
  eveningReminderAt?: string;
  quietStartsAt?: string;
  quietEndsAt?: string;
  faithEnabled?: boolean;
  lastWeeklyResetOn?: string | null;
}): Promise<LocalDailyLoopPreference> {
  const db = getOfflineDb();
  const existing = await db.daily_loop_preferences.get(input.userId);
  const at = nowIso();
  const row: LocalDailyLoopPreference = {
    user_id: input.userId,
    notifications_enabled: input.notificationsEnabled ?? existing?.notifications_enabled ?? false,
    morning_reminder_at: input.morningReminderAt ?? existing?.morning_reminder_at ?? '08:00:00',
    evening_reminder_at: input.eveningReminderAt ?? existing?.evening_reminder_at ?? '20:00:00',
    quiet_starts_at: input.quietStartsAt ?? existing?.quiet_starts_at ?? '22:00:00',
    quiet_ends_at: input.quietEndsAt ?? existing?.quiet_ends_at ?? '07:00:00',
    faith_enabled: input.faithEnabled ?? existing?.faith_enabled ?? false,
    last_weekly_reset_on:
      input.lastWeeklyResetOn ?? existing?.last_weekly_reset_on ?? null,
    created_at: existing?.created_at ?? at,
    updated_at: at, server_updated_at: existing?.server_updated_at ?? at, deleted_at: null,
  };
  await db.daily_loop_preferences.put(row);
  await enqueueUpsert(
    'daily_loop_preferences', row.user_id,
    omitServerCursor(row) satisfies DailyLoopPreferenceWrite,
  );
  void drainQueue();
  return row;
}

export async function getLocalDailyLoopPreferences(userId: string): Promise<LocalDailyLoopPreference | null> {
  const row = await getOfflineDb().daily_loop_preferences.get(userId);
  return row && !row.deleted_at ? row : null;
}

export async function ensureReviewedScriptureCache(): Promise<void> {
  const at = nowIso();
  const rows: LocalScripturePassage[] = REVIEWED_SCRIPTURE_PASSAGES.map((row) => ({
    ...row, tags: [...row.tags], active: true, created_at: at,
    updated_at: at, server_updated_at: at,
  }));
  await getOfflineDb().scripture_passages.bulkPut(rows);
}

export async function listLocalScripture(input: {
  faithEnabled: boolean; tag?: string;
}): Promise<LocalScripturePassage[]> {
  if (!input.faithEnabled) return [];
  await ensureReviewedScriptureCache();
  const rows = await getOfflineDb().scripture_passages.toArray();
  return rows.filter((row) => row.active && (!input.tag || row.tags.includes(input.tag)));
}

export async function mergeRemoteDailyPlans(rows: LocalDailyPlan[]): Promise<void> {
  const db = getOfflineDb();
  for (const row of rows) {
    const existing = await db.daily_plans.get(row.id);
    if (!existing || incomingWins(existing.updated_at, row.updated_at)) await db.daily_plans.put(row);
  }
}

export async function mergeRemoteFocusSessions(rows: LocalFocusSession[]): Promise<void> {
  const db = getOfflineDb();
  for (const row of rows) {
    const existing = await db.focus_sessions.get(row.id);
    if (!existing || incomingWins(existing.updated_at, row.updated_at)) await db.focus_sessions.put(row);
  }
}
