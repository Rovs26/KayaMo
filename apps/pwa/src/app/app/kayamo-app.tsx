'use client';

import Image from 'next/image';
import {
  ArrowLeft,
  Barcode,
  BookOpenText,
  ChatCircle,
  Check,
  CheckCircle,
  Clock,
  CaretRight,
  Circle,
  Compass,
  ForkKnife,
  GearSix,
  Heartbeat,
  House,
  MagnifyingGlass,
  PaperPlaneTilt,
  Pause,
  Plus,
  PushPin,
  Target,
  Tree,
  X,
} from '@phosphor-icons/react';
import type {
  CocoResponse,
} from '@kayamo/ai';
import {
  COMPANION_EVENT_POINTS,
  COMPANION_EVENT_TYPES,
  COMPANION_STAGES,
  computeWeightTrend,
  dayTypeForToday,
  LIFE_AREA_LABELS,
  LIFE_AREAS,
  daysBetweenLogical,
  macroProgress,
  nutritionProgress,
  targetForDayType,
  trendChange,
  weeklyResetDue,
  type CompanionEventType,
  type DayCapacity,
  type DayIntent,
  type DayPlanCandidate,
  type GuidanceSnapshot,
  type MacroProgress,
  type NutritionProgress,
  type NutritionTargetView,
  type PlanMode,
} from '@kayamo/core';
import {
  asLocale,
  asMealSlot,
  mealSlotLabel,
  orderedMealSlots,
  shiftLogicalDate,
  type Locale,
} from '@kayamo/food/quick-log';
import {
  appendLocalCocoMessage,
  cacheGuidanceSnapshot,
  getCachedGuidanceSnapshot,
  logWeight,
  createLocalAgentMemory,
  completeLocalEveningReflection,
  completeLocalGoalMilestone,
  completeLocalRoutine,
  createLocalCocoConversation,
  createLocalFocusSession,
  createLocalInboxItem,
  createLocalRoutine,
  createLocalTask,
  finishLocalFocusSession,
  getLocalCompass,
  getLocalCompanionProgression,
  getLocalDailyLoopPreferences,
  getLocalDailyPlan,
  getLocalFutureSelf,
  instantOnLogicalDate,
  listLocalCocoMessages,
  listLocalCompanionPresenceDates,
  listLocalFocusSessions,
  listLocalGoals,
  listLocalGoalMilestones,
  listLocalInboxItems,
  listLocalOpenTasks,
  listLocalRoutineCompletions,
  listLocalRoutines,
  listLocalScripture,
  listLocalTasksForDate,
  listLocalWeightLogs,
  listLocalWorkoutHistory,
  logicalDateFromInstant,
  processLocalInboxItem,
  saveLocalCompass,
  saveLocalDailyLoopPreferences,
  saveLocalDailyPlan,
  saveLocalFutureSelf,
  setLocalGoalStatus,
  setLocalTaskCompleted,
  setLocalTaskScheduledFor,
  startLocalFocusSession,
  type LocalCocoMessage,
  type LocalCompass,
  type LocalDailyLoopPreference,
  type LocalDailyPlan,
  type LocalFocusSession,
  type LocalFoodEntry,
  type LocalFutureSelf,
  type LocalGoal,
  type LocalGoalMilestone,
  type LocalInboxItem,
  type LocalRoutine,
  type LocalRoutineCompletion,
  type LocalScripturePassage,
  type LocalTask,
  type LocalWeightLog,
  type LocalWorkout,
  useLiveFoodEntries,
  useLiveFoodHistory,
} from '@kayamo/offline';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { SyncStatusBar } from './sync-status-bar';
import { AddSheet } from './add-sheet';
import { DayStrip, PastDayBanner, WeekBars } from './day-strip';
import { FirstRun } from './first-run';
import { FoodRecordSheet } from './food-record-sheet';
import { AddProductForm } from './foods/add/add-product-form';
import { BarcodeLookup } from './foods/barcode/barcode-lookup';
import { FoodSearch } from './foods/search/food-search';
import { GoalFlow } from './goal-flow';
import { PlanDaySheet } from './plan-day-sheet';
import { SettingsScreen } from './settings-screen';
import { WeeklyResetSheet } from './weekly-reset-sheet';
import { WorkoutFlow } from './workout-flow';
import styles from './kayamo-app.module.css';

type Tab = 'home' | 'goals' | 'life' | 'grove' | 'mus';
type Theme = 'system' | 'day' | 'night';

/**
 * Screens pushed on top of a tab rather than routed to. Keeping them in the
 * shell preserves the tab bar, the theme, and the loaded day state, none of
 * which survive a route change.
 */
type DetailScreen =
  | { kind: 'food-search' }
  | { kind: 'food-add'; barcode: string }
  | { kind: 'food-barcode' };

const DETAIL_META: Record<
  DetailScreen['kind'],
  { eyebrow: string; title: string; subtitle: string }
> = {
  'food-search': {
    eyebrow: 'Search',
    title: 'Find a food',
    subtitle: 'Local matches show first. Packaged and USDA results stream in below.',
  },
  'food-add': {
    eyebrow: 'My Foods',
    title: 'Add this product',
    subtitle:
      'Photograph the nutrition facts panel. Confirm the numbers before they save to My Foods.',
  },
  'food-barcode': {
    eyebrow: 'Barcode',
    title: 'Scan a pack',
    subtitle: 'Point the camera at the bars. If it is not in Open Food Facts yet, add it from the label.',
  },
};

const TABS: Array<{ id: Tab; label: string; Icon: typeof House }> = [
  { id: 'home', label: 'Home', Icon: House },
  { id: 'goals', label: 'Goals', Icon: Target },
  { id: 'life', label: 'Life', Icon: Heartbeat },
  { id: 'grove', label: 'Grove', Icon: Tree },
  { id: 'mus', label: 'Mus', Icon: ChatCircle },
];

function titleDate(date: Date): string {
  return new Intl.DateTimeFormat('en', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(date);
}

function greeting(date: Date): string {
  const hour = date.getHours();
  return hour < 12 ? 'Good morning.' : hour < 18 ? 'Good afternoon.' : 'Good evening.';
}

function remainingClock(endsAt: string | null, now: number, maximumSeconds = 25 * 60): string {
  if (!endsAt) return '25:00';
  const seconds = Math.min(maximumSeconds, Math.max(0, Math.ceil((Date.parse(endsAt) - now) / 1000)));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function stageLabel(stage: string): string {
  return stage.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function progressionEvent(eventKey: string, sourceLabel?: string): { label: string; points: number; detail: string } {
  const [rawType = '', sourceTable = 'confirmed activity'] = eventKey.split(':');
  const eventType = COMPANION_EVENT_TYPES.includes(rawType as CompanionEventType)
    ? rawType as CompanionEventType
    : null;
  return {
    label: sourceLabel ?? (eventType ? stageLabel(eventType) : 'Confirmed action'),
    points: eventType ? COMPANION_EVENT_POINTS[eventType] : 0,
    detail: sourceTable.replaceAll('_', ' '),
  };
}

/**
 * Reads server guidance and refreshes the device cache. On failure the last
 * cached snapshot is returned and flagged stale, so Health can still show a
 * target offline instead of falling back to a bare calorie count.
 */
async function fetchGuidanceSnapshot(
  userId: string,
  logicalDate: string,
): Promise<{ snapshot: GuidanceSnapshot | null; stale: boolean }> {
  try {
    const response = await fetch(`/api/guidance?date=${logicalDate}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`guidance ${response.status}`);
    const snapshot = (await response.json()) as GuidanceSnapshot;
    await cacheGuidanceSnapshot(userId, snapshot);
    return { snapshot, stale: false };
  } catch {
    const cached = await getCachedGuidanceSnapshot(userId);
    return { snapshot: cached?.snapshot ?? null, stale: Boolean(cached) };
  }
}

function ActionDialog({
  open,
  title,
  description,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className={styles.dialog} onClose={onClose} aria-labelledby={titleId}>
      <div className={styles.dialogHandle} aria-hidden="true" />
      <div className={styles.dialogTop}>
        <div>
          <p className={styles.eyebrow}>Your choice</p>
          <h2 id={titleId}>{title}</h2>
        </div>
        <button className={styles.iconButton} type="button" onClick={onClose} aria-label="Close dialog">
          <X size={20} />
        </button>
      </div>
      {description ? <p className={styles.dialogDescription}>{description}</p> : null}
      {children}
    </dialog>
  );
}

export function KayaMoApp({ userId, email }: { userId: string; email: string }) {
  const [tab, setTab] = useState<Tab>('home');
  const mainRef = useRef<HTMLElement>(null);
  const tabScrollPositions = useRef<Record<Tab, number>>({
    home: 0,
    goals: 0,
    life: 0,
    grove: 0,
    mus: 0,
  });
  const [detailStack, setDetailStack] = useState<DetailScreen[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [workoutOpen, setWorkoutOpen] = useState(false);
  const [firstRun, setFirstRun] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('kayamo:first-run-done') !== '1';
  });
  const [viewDate, setViewDate] = useState<string | null>(null);
  const [editingFood, setEditingFood] = useState<LocalFoodEntry | null>(null);
  const [settingsField, setSettingsField] = useState<string | null>(null);
  const [presenceDates, setPresenceDates] = useState<string[]>([]);
  const [goalFlow, setGoalFlow] = useState<{ goalId: string | null } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [theme, setTheme] = useState<Theme>('day');
  const [themeReady, setThemeReady] = useState(false);
  const [guidance, setGuidance] = useState<GuidanceSnapshot | null>(null);
  const [guidanceStale, setGuidanceStale] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [trendOpen, setTrendOpen] = useState(false);
  const [expenditureOpen, setExpenditureOpen] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [routines, setRoutines] = useState<LocalRoutine[]>([]);
  const [allRoutines, setAllRoutines] = useState<LocalRoutine[]>([]);
  const [routineCompletions, setRoutineCompletions] = useState<LocalRoutineCompletion[]>([]);
  const [plan, setPlan] = useState<LocalDailyPlan | null>(null);
  const [focusSessions, setFocusSessions] = useState<LocalFocusSession[]>([]);
  const [goals, setGoals] = useState<LocalGoal[]>([]);
  const [goalMilestones, setGoalMilestones] = useState<LocalGoalMilestone[]>([]);
  const [inboxItems, setInboxItems] = useState<LocalInboxItem[]>([]);
  const [inboxDraft, setInboxDraft] = useState('');
  const [futureSelf, setFutureSelf] = useState<LocalFutureSelf | null>(null);
  const [compass, setCompass] = useState<LocalCompass | null>(null);
  const [openTasks, setOpenTasks] = useState<LocalTask[]>([]);
  const [yesterdayNote, setYesterdayNote] = useState<string | null>(null);
  const [planSheet, setPlanSheet] = useState<PlanMode | null>(null);
  const [weeklyResetOpen, setWeeklyResetOpen] = useState(false);
  const [workouts, setWorkouts] = useState<LocalWorkout[]>([]);
  const [weights, setWeights] = useState<LocalWeightLog[]>([]);
  const [preferences, setPreferences] = useState<LocalDailyLoopPreference | null>(null);
  const [scripture, setScripture] = useState<LocalScripturePassage[]>([]);
  const [progress, setProgress] = useState({ totalPoints: 0, stageKey: 'seed', acceptedEventKeys: [] as string[] });
  const [notice, setNotice] = useState<string | null>(null);
  const [focusView, setFocusView] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskKind, setTaskKind] = useState<'task' | 'routine'>('task');
  const [planLabel, setPlanLabel] = useState('');
  const [reflection, setReflection] = useState('');

  // The profile owns these, so the first render uses defaults and settles once
  // guidance arrives. A night-shift day boundary must not be assumed away.
  const timeZone = guidance?.profile.timezone ?? 'Asia/Manila';
  const dayStartsAt = guidance?.profile.dayStartsAt ?? '00:00:00';
  const locale: Locale = asLocale(guidance?.profile.locale);

  const date = useMemo(() => new Date(now), [now]);
  const todayLogical = logicalDateFromInstant(date.toISOString(), timeZone, dayStartsAt);
  const viewLogicalDate = viewDate ?? todayLogical;
  const foodEntries = useLiveFoodEntries(userId, viewLogicalDate);
  const foodHistory = useLiveFoodHistory(userId);
  const writeAt =
    viewLogicalDate === todayLogical
      ? undefined
      : instantOnLogicalDate(viewLogicalDate, timeZone, dayStartsAt);
  const logicalDate = viewLogicalDate;
  const activeFocus = focusSessions.find((session) => session.status === 'active') ?? null;
  const activeWorkout = workouts.find((workout) => workout.status === 'active') ?? null;
  const homeGoal = goals.find((goal) => goal.status === 'active') ?? null;
  const homeGoalMilestones = homeGoal
    ? goalMilestones.filter((row) => row.goal_id === homeGoal.id)
    : [];
  const lastPresence = presenceDates.at(-1) ?? null;
  const returningAfterDays = lastPresence ? daysBetweenLogical(lastPresence, todayLogical) : 0;
  const resetDue = weeklyResetDue(preferences?.last_weekly_reset_on ?? null, todayLogical);
  const planCandidates = useMemo((): DayPlanCandidate[] => {
    const openToday = tasks.filter((task) => !task.completed_at);
    const nextMilestone = homeGoalMilestones.find((row) => !row.completed_at);
    const items: DayPlanCandidate[] = openToday.map((task) => ({
      id: task.id,
      title: task.title,
      source: 'task',
      sourceId: task.id,
    }));
    if (
      nextMilestone &&
      !items.some((item) => item.title.trim().toLowerCase() === nextMilestone.title.trim().toLowerCase())
    ) {
      items.push({
        id: nextMilestone.id,
        title: nextMilestone.title,
        source: 'goal',
        sourceId: nextMilestone.id,
      });
    }
    for (const item of inboxItems) {
      items.push({
        id: item.id,
        title: item.content,
        source: 'inbox',
        sourceId: item.id,
      });
    }
    return items;
  }, [homeGoalMilestones, inboxItems, tasks]);
  const completedRoutineIds = useMemo(
    () => new Set(routineCompletions.map((row) => row.routine_id)),
    [routineCompletions],
  );

  const refresh = useCallback(async () => {
    const weekday = new Date(`${logicalDate}T12:00:00`).getDay();
    const yesterday = shiftLogicalDate(logicalDate, -1);
    const [nextTasks, nextRoutines, nextAllRoutines, completions, nextPlan, sessions, nextGoals, nextWorkouts, nextWeights, prefs, nextProgress, nextPresence, nextInbox, nextSelf, nextCompass, nextOpen, priorPlan] = await Promise.all([
      listLocalTasksForDate(userId, logicalDate),
      listLocalRoutines(userId, weekday),
      listLocalRoutines(userId),
      listLocalRoutineCompletions(userId, logicalDate),
      getLocalDailyPlan(userId, logicalDate),
      listLocalFocusSessions(userId, logicalDate),
      listLocalGoals(userId),
      listLocalWorkoutHistory(userId),
      listLocalWeightLogs(userId),
      getLocalDailyLoopPreferences(userId),
      getLocalCompanionProgression(userId),
      listLocalCompanionPresenceDates(userId),
      listLocalInboxItems(userId),
      getLocalFutureSelf(userId),
      getLocalCompass(userId),
      listLocalOpenTasks(userId),
      getLocalDailyPlan(userId, yesterday),
    ]);
    const nextMilestones = (
      await Promise.all(nextGoals.map((goal) => listLocalGoalMilestones(userId, goal.id)))
    ).flat();
    setTasks(nextTasks);
    setRoutines(nextRoutines);
    setAllRoutines(nextAllRoutines);
    setRoutineCompletions(completions);
    setPlan(nextPlan);
    setFocusSessions(sessions);
    setGoals(nextGoals);
    setGoalMilestones(nextMilestones);
    setWorkouts(nextWorkouts);
    setWeights(nextWeights);
    setPreferences(prefs);
    setProgress(nextProgress);
    setPresenceDates(nextPresence);
    setInboxItems(nextInbox);
    setFutureSelf(nextSelf);
    setCompass(nextCompass);
    setOpenTasks(nextOpen);
    setYesterdayNote(priorPlan?.tomorrow_note ?? null);
    setScripture(await listLocalScripture({ faithEnabled: prefs?.faith_enabled ?? false }));
  }, [logicalDate, userId]);

  useEffect(() => {
    localStorage.setItem('kayamo:last-user-id', userId);
    const initial = window.setTimeout(() => {
      const saved = localStorage.getItem('kayamo:theme');
      if (saved === 'day' || saved === 'night' || saved === 'system') setTheme(saved);
      setThemeReady(true);
      void refresh();
    }, 0);
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refresh, userId]);

  const loadGuidance = useCallback(async () => {
    const result = await fetchGuidanceSnapshot(userId, logicalDate);
    setGuidance(result.snapshot);
    setGuidanceStale(result.stale);
    return result.snapshot;
  }, [logicalDate, userId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await fetchGuidanceSnapshot(userId, logicalDate);
      if (cancelled) return;
      setGuidance(result.snapshot);
      setGuidanceStale(result.stale);
    })();
    return () => {
      cancelled = true;
    };
  }, [logicalDate, userId]);

  useEffect(() => {
    const root = document.documentElement;
    const applied = theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day'
      : theme;
    root.dataset.kayamoTheme = applied;
    root.style.colorScheme = applied === 'night' ? 'dark' : 'light';
    if (themeReady) localStorage.setItem('kayamo:theme', theme);
  }, [theme, themeReady]);

  useEffect(() => {
    if (viewDate && viewDate === todayLogical) setViewDate(null);
  }, [todayLogical, viewDate]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    function onPopState(event: PopStateEvent) {
      const state = event.state as { kayamoDepth?: number } | null;
      const depth = typeof state?.kayamoDepth === 'number' ? state.kayamoDepth : 0;
      setDetailStack((stack) => (stack.length > depth ? stack.slice(0, depth) : stack));
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const unfinishedTask = tasks.find((task) => !task.completed_at);
  const unfinishedRoutine = routines.find((routine) => !completedRoutineIds.has(routine.id));
  const recommended = plan?.selected_label_snapshot ?? unfinishedTask?.title ?? unfinishedRoutine?.title ?? null;
  const completedCount = tasks.filter((task) => task.completed_at).length + routineCompletions.length;
  const calories = foodEntries.reduce((sum, entry) => sum + Number(entry.kcal), 0);
  const protein = foodEntries.reduce((sum, entry) => sum + Number(entry.protein_g), 0);
  const carbs = foodEntries.reduce((sum, entry) => sum + Number(entry.carbs_g), 0);
  const fat = foodEntries.reduce((sum, entry) => sum + Number(entry.fat_g), 0);

  const trainedToday = workouts.some(
    (workout) => workout.logical_date === logicalDate && workout.status !== 'abandoned',
  );
  const dayType = dayTypeForToday(trainedToday);
  const target = guidance ? targetForDayType(guidance.targets, dayType) : null;
  const kcalProgress = nutritionProgress(calories, target);
  const macros = macroProgress({ proteinG: protein, carbsG: carbs, fatG: fat }, target);
  const weightTrend = useMemo(
    () =>
      computeWeightTrend(
        weights.map((row) => ({ date: row.measured_on, weightKg: Number(row.weight_kg) })),
      ),
    [weights],
  );
  const weightChange = trendChange(weightTrend);
  const kcalByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of foodHistory) {
      map.set(row.logical_date, (map.get(row.logical_date) ?? 0) + Number(row.kcal));
    }
    for (const row of foodEntries) {
      if (foodHistory.some((item) => item.id === row.id)) continue;
      map.set(row.logical_date, (map.get(row.logical_date) ?? 0) + Number(row.kcal));
    }
    return map;
  }, [foodEntries, foodHistory]);
  const markedDays = useMemo(() => {
    const next = new Set<string>(kcalByDate.keys());
    for (const row of workouts) {
      if (row.status === 'completed') next.add(row.logical_date);
    }
    for (const iso of presenceDates) next.add(iso);
    return next;
  }, [kcalByDate, presenceDates, workouts]);

  async function patchProfile(patch: Record<string, unknown>) {
    const response = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!response.ok) {
      setNotice('Could not update the profile yet. Try again when you are online.');
      return;
    }
    setSettingsField(null);
    await loadGuidance();
    await refresh();
  }

  async function addPlanningItem(event: React.FormEvent) {
    event.preventDefault();
    const title = taskTitle.trim();
    if (!title) return;
    if (taskKind === 'task') {
      await createLocalTask({ userId, title, scheduledFor: logicalDate });
    } else {
      await createLocalRoutine({ userId, title });
    }
    setTaskTitle('');
    setTaskOpen(false);
    setNotice(`${taskKind === 'task' ? 'Task' : 'Routine'} saved on this device.`);
    await refresh();
  }

  async function captureInbox(event: React.FormEvent) {
    event.preventDefault();
    const content = inboxDraft.trim();
    if (!content) return;
    await createLocalInboxItem({ userId, content });
    setInboxDraft('');
    setNotice('Saved privately. Mus cannot read this until you allow it.');
    await refresh();
  }

  async function choosePlan(event: React.FormEvent) {
    event.preventDefault();
    const label = planLabel.trim();
    if (!label) return;
    const row = await saveLocalDailyPlan({
      userId,
      logicalDate,
      actionKind: 'custom',
      label,
      completeMorning: true,
    });
    setPlan(row);
    setPlanLabel('');
    setPlanOpen(false);
    setNotice('Confirmed. Mus will hold this as your next action.');
  }

  async function confirmDayPlan(input: {
    capacity: DayCapacity;
    intent: DayIntent | null;
    mode: PlanMode;
    kept: DayPlanCandidate[];
    customLabel: string | null;
  }) {
    const keptTaskIds = new Set<string>();
    let firstTask: LocalTask | null = null;
    for (const item of input.kept) {
      if (item.source === 'inbox') {
        const task = await createLocalTask({ userId, title: item.title, scheduledFor: logicalDate });
        keptTaskIds.add(task.id);
        firstTask ??= task;
        await processLocalInboxItem({ id: item.sourceId, userId });
      } else if (item.source === 'goal') {
        const already = tasks.find(
          (task) =>
            !task.completed_at && task.title.trim().toLowerCase() === item.title.trim().toLowerCase(),
        );
        if (already) {
          keptTaskIds.add(already.id);
          firstTask ??= already;
        } else {
          const task = await createLocalTask({ userId, title: item.title, scheduledFor: logicalDate });
          keptTaskIds.add(task.id);
          firstTask ??= task;
        }
      } else if (item.source === 'task') {
        const existing = tasks.find((task) => task.id === item.sourceId);
        if (existing) {
          keptTaskIds.add(existing.id);
          firstTask ??= existing;
        } else {
          keptTaskIds.add(item.sourceId);
        }
      }
    }
    if (input.customLabel) {
      const task = await createLocalTask({ userId, title: input.customLabel, scheduledFor: logicalDate });
      keptTaskIds.add(task.id);
      firstTask ??= task;
    }
    for (const task of tasks) {
      if (task.completed_at || keptTaskIds.has(task.id) || task.scheduled_for !== logicalDate) {
        continue;
      }
      await setLocalTaskScheduledFor({ id: task.id, userId, scheduledFor: null });
    }
    const label = firstTask?.title ?? input.customLabel ?? input.kept[0]?.title ?? null;
    await saveLocalDailyPlan({
      userId,
      logicalDate,
      actionKind: firstTask ? 'task' : label ? 'custom' : undefined,
      recordId: firstTask?.id ?? null,
      label,
      completeMorning: true,
      capacity: input.capacity,
      dayIntent: input.intent,
      planMode: input.mode,
    });
    setPlanSheet(null);
    setNotice(
      input.mode === 'rescue'
        ? 'Rescued. Only what you kept is on today.'
        : returningAfterDays >= 2
          ? 'Welcome back. One step is enough.'
          : 'Plan confirmed. Mus will not change it without you.',
    );
    await refresh();
  }

  async function toggleTask(task: LocalTask) {
    const completing = !task.completed_at;
    await setLocalTaskCompleted({ id: task.id, userId, completed: completing, timeZone, dayStartsAt });
    if (completing) {
      const match = goalMilestones.find(
        (row) =>
          !row.completed_at &&
          row.title.trim().toLowerCase() === task.title.trim().toLowerCase(),
      );
      if (match) {
        await completeLocalGoalMilestone({ id: match.id, userId, timeZone, dayStartsAt });
      }
    }
    setNotice(task.completed_at ? 'Task reopened.' : 'Done. Mus noticed the honest follow-through.');
    await refresh();
  }

  async function completeRoutine(routine: LocalRoutine) {
    if (completedRoutineIds.has(routine.id)) return;
    await completeLocalRoutine({ userId, routineId: routine.id, logicalDate });
    setNotice('Routine complete. Consistency counts without a perfect streak.');
    await refresh();
  }

  async function beginFocus(label = recommended) {
    if (activeFocus) {
      setFocusView(true);
      return;
    }
    if (!label) {
      setPlanSheet('standard');
      return;
    }
    let currentPlan = plan;
    if (!currentPlan) {
      currentPlan = await saveLocalDailyPlan({ userId, logicalDate, actionKind: 'custom', label, completeMorning: true });
      setPlan(currentPlan);
    }
    const scheduled = await createLocalFocusSession({
      userId,
      logicalDate,
      dailyPlanId: currentPlan.id,
      targetKind: currentPlan.selected_action_kind ?? 'custom',
      targetRecordId: currentPlan.selected_record_id,
      targetLabel: label,
      plannedMinutes: 25,
    });
    const started = await startLocalFocusSession({ id: scheduled.id, userId });
    if (started) {
      setFocusSessions((current) => [...current, started]);
      setFocusView(true);
    }
  }

  async function endFocus(outcome: 'completed' | 'cancelled') {
    if (!activeFocus) return;
    await finishLocalFocusSession({ id: activeFocus.id, userId, outcome });
    setFocusView(false);
    setNotice(outcome === 'completed' ? 'Focus complete. Honest effort counts.' : 'Focus stopped. Returning later is always allowed.');
    await refresh();
  }

  async function toggleFaith(enabled: boolean) {
    const next = await saveLocalDailyLoopPreferences({ userId, faithEnabled: enabled });
    setPreferences(next);
    setScripture(await listLocalScripture({ faithEnabled: enabled }));
  }

  async function saveReflection() {
    if (!reflection.trim()) return;
    await completeLocalEveningReflection({
      userId,
      logicalDate,
      reflection,
    });
    setReflection('');
    setNotice('Saved. Tomorrow’s plan can use this if you still want it.');
    await refresh();
  }

  function openWorkout() {
    setWorkoutOpen(true);
  }

  async function saveWeight(event: React.FormEvent) {
    event.preventDefault();
    const weightKg = weightInput.trim();
    if (!Number.isFinite(Number(weightKg)) || Number(weightKg) <= 0) {
      setNotice('Enter a weight in kilograms.');
      return;
    }
    await logWeight({ userId, weightKg, source: 'manual', timeZone, dayStartsAt, loggedAt: writeAt });
    setWeightInput('');
    setWeightOpen(false);
    setNotice('Weight saved on this device.');
    await refresh();
    // A new measurement changes expenditure, so guidance is refetched rather
    // than left showing a target derived from the old weight.
    await loadGuidance();
  }

  async function recomputeGuidance() {
    setRecomputing(true);
    try {
      const response = await fetch('/api/guidance', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ date: logicalDate }),
      });
      const body = (await response.json()) as GuidanceSnapshot | { error: string };
      if (!response.ok) {
        setNotice('error' in body ? body.error : 'Guidance could not be recomputed.');
        return;
      }
      const snapshot = body as GuidanceSnapshot;
      setGuidance(snapshot);
      setGuidanceStale(false);
      await cacheGuidanceSnapshot(userId, snapshot);
      setNotice('Targets recomputed from your confirmed records.');
    } catch {
      setNotice('Guidance needs a connection. Your logs are still saved.');
    } finally {
      setRecomputing(false);
    }
  }

  const detail = detailStack.length ? detailStack[detailStack.length - 1] : null;

  function selectTab(nextTab: Tab) {
    // Leaving a pushed screen via the tab bar unwinds the history entries it
    // added, so a later back gesture does not walk back into it.
    if (detailStack.length) window.history.go(-detailStack.length);
    if (nextTab === tab) return;
    if (mainRef.current) tabScrollPositions.current[tab] = mainRef.current.scrollTop;
    setTab(nextTab);
    window.requestAnimationFrame(() => {
      if (mainRef.current) mainRef.current.scrollTop = tabScrollPositions.current[nextTab];
    });
  }

  function pushDetail(next: DetailScreen) {
    // One history entry per pushed screen is what makes the Android system
    // back button and the browser back gesture pop a screen rather than leave
    // the app. Depth is carried in the entry so popstate can resync exactly,
    // including a multi-step go(-n).
    window.history.pushState({ kayamoDepth: detailStack.length + 1 }, '');
    setDetailStack((stack) => [...stack, next]);
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }

  function closeDetail() {
    window.history.back();
  }

  if (focusView && activeFocus) {
    return (
      <main className={`${styles.viewport} ${styles.focusScreen}`}>
        <div className={styles.atmosphere} aria-hidden="true" />
        <div className={styles.focusContent}>
          <div className={styles.focusTop}>
            <button className={styles.focusReturn} type="button" onClick={() => setFocusView(false)}>
              <ArrowLeft size={18} /> Return later
            </button>
            <span>Focus · timer only</span>
          </div>
          <div className={styles.focusCenter}>
            <Image src="/coco-seed.png" alt="Mus, waiting quietly while you work" width={120} height={120} />
            <h1>{activeFocus.target_label_snapshot}</h1>
            <p className={styles.focusClock} role="timer" aria-label={`${remainingClock(activeFocus.ends_at, now, activeFocus.planned_minutes * 60)} remaining`}>
              {remainingClock(activeFocus.ends_at, now, activeFocus.planned_minutes * 60)}
            </p>
            <p className={styles.muted}>KayaMo can keep time and nudge you. The web app cannot block other apps.</p>
          </div>
          <div className={styles.focusActions}>
            <button className={styles.primaryButton} type="button" onClick={() => void endFocus('completed')}>
              <Check size={20} weight="bold" /> Mark complete
            </button>
            <button className={styles.secondaryButton} type="button" onClick={() => void endFocus('cancelled')}>
              <Pause size={19} /> Stop for now
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className={styles.viewport}>
      <div className={styles.shell}>
        {firstRun ? (
          <FirstRun
            userId={userId}
            logicalDate={todayLogical}
            onDone={async () => {
              setFirstRun(false);
              await refresh();
              await loadGuidance();
            }}
          />
        ) : null}
        {workoutOpen ? (
          <WorkoutFlow
            userId={userId}
            timeZone={timeZone}
            dayStartsAt={dayStartsAt}
            now={now}
            activeWorkout={activeWorkout}
            onClose={() => setWorkoutOpen(false)}
            onFinished={async () => {
              await refresh();
            }}
          />
        ) : null}
        {goalFlow ? (
          <GoalFlow
            userId={userId}
            logicalDate={todayLogical}
            timeZone={timeZone}
            dayStartsAt={dayStartsAt}
            goals={goals}
            todayTasks={tasks}
            initialGoalId={goalFlow.goalId}
            onClose={() => setGoalFlow(null)}
            onChat={() => {
              setGoalFlow(null);
              selectTab('mus');
            }}
            onGoToday={() => {
              setGoalFlow(null);
              selectTab('home');
            }}
            onChanged={refresh}
          />
        ) : null}
        {planSheet ? (
          <PlanDaySheet
            candidates={planCandidates}
            yesterdayNote={yesterdayNote}
            returningAfterDays={returningAfterDays}
            initialMode={planSheet}
            onClose={() => setPlanSheet(null)}
            onConfirm={(input) => void confirmDayPlan(input)}
          />
        ) : null}
        {weeklyResetOpen ? (
          <WeeklyResetSheet
            todayLogical={todayLogical}
            inboxCount={inboxItems.length}
            unfinishedTitles={openTasks
              .filter((task) => task.scheduled_for !== todayLogical)
              .map((task) => task.title)}
            goals={goals}
            onGoalStatus={async (id, status) => {
              await setLocalGoalStatus({ id, userId, status, timeZone, dayStartsAt });
              await refresh();
            }}
            onClose={() => setWeeklyResetOpen(false)}
            onFinish={async () => {
              await saveLocalDailyLoopPreferences({ userId, lastWeeklyResetOn: todayLogical });
              setWeeklyResetOpen(false);
              setNotice('Week closed. The grove kept every confirmed point.');
              await refresh();
            }}
          />
        ) : null}
        {settingsOpen ? (
          <SettingsScreen
            email={email}
            theme={theme}
            onTheme={setTheme}
            faithEnabled={preferences?.faith_enabled ?? false}
            onFaith={(enabled) => void toggleFaith(enabled)}
            reminderEnabled={preferences?.notifications_enabled ?? false}
            onReminder={(enabled) => {
              void saveLocalDailyLoopPreferences({ userId, notificationsEnabled: enabled }).then(setPreferences);
            }}
            musMayReadIdentity={futureSelf?.mus_may_read ?? compass?.mus_may_read ?? true}
            onMusMayReadIdentity={(enabled) => {
              void (async () => {
                if (futureSelf) {
                  await saveLocalFutureSelf({
                    userId,
                    statement: futureSelf.statement,
                    musMayRead: enabled,
                  });
                }
                await saveLocalCompass({ userId, musMayRead: enabled });
                await refresh();
              })();
            }}
            bodyRows={[
              { id: 'sex', label: 'Sex', value: guidance?.profile.sex ?? 'not set' },
              { id: 'goal', label: 'Goal', value: guidance?.profile.goal ?? 'not set' },
              { id: 'weight', label: 'Weight', value: weights.at(-1) ? `${Number(weights.at(-1)!.weight_kg).toFixed(1)} kg` : 'not set' },
              { id: 'targets', label: 'Targets', value: target ? `${target.kcal} kcal` : 'needs setup' },
            ]}
            dayRows={[
              { id: 'timezone', label: 'Timezone', value: timeZone },
              { id: 'day-start', label: 'Day starts', value: dayStartsAt.slice(0, 5) },
              { id: 'locale', label: 'Language', value: locale },
            ]}
            onEditBody={(id) => {
              if (id === 'weight') {
                setWeightOpen(true);
                return;
              }
              if (id === 'targets') {
                setTargetsOpen(true);
                return;
              }
              setSettingsField(id);
            }}
            onBack={() => setSettingsOpen(false)}
          />
        ) : null}

        <main ref={mainRef} className={styles.main} id="main-content">
          <h1 className={styles.srOnly}>Today with Mus</h1>
          {detail ? (
            <DetailView
              detail={detail}
              userId={userId}
              loggedAt={writeAt}
              onBack={closeDetail}
              onAddProduct={(barcode) => pushDetail({ kind: 'food-add', barcode })}
              onDescribeInChat={() => selectTab('mus')}
              onSaved={() => {
                setNotice('Saved to My Foods.');
                closeDetail();
              }}
            />
          ) : null}
          {!detail && tab === 'home' ? (
            <>
              <HomeScreen
                date={date}
                recommended={recommended}
                completedCount={completedCount}
                foodCount={foodEntries.length}
                progress={progress}
                homeGoal={homeGoal}
                homeGoalSteps={homeGoalMilestones.filter((row) => row.completed_at).length}
                inboxDraft={inboxDraft}
                inboxItems={inboxItems}
                onInboxDraft={setInboxDraft}
                onCaptureInbox={(event) => void captureInbox(event)}
                onPlan={() => setPlanSheet('standard')}
                onStart={() => void beginFocus()}
                onGrove={() => selectTab('grove')}
                onOpenGoal={() => setGoalFlow({ goalId: homeGoal?.id ?? null })}
                onChat={() => selectTab('mus')}
                onBecome={() => setFirstRun(true)}
                onWeeklyReset={() => setWeeklyResetOpen(true)}
                futureSelf={futureSelf?.statement ?? null}
                welcomeBack={returningAfterDays >= 2}
                resetDue={resetDue}
              />
              <TodayScreen
                embedded
                date={date}
                todayLogical={todayLogical}
                viewLogicalDate={viewLogicalDate}
                markedDays={markedDays}
                onSelectDay={setViewDate}
                tasks={tasks}
                routines={routines}
                completedRoutineIds={completedRoutineIds}
                plan={plan}
                sessions={focusSessions}
                reflection={reflection}
                onReflection={setReflection}
                onSaveReflection={() => void saveReflection()}
                onAdd={() => setAddOpen(true)}
                onToggleTask={(task) => void toggleTask(task)}
                onCompleteRoutine={(routine) => void completeRoutine(routine)}
                onFocus={() => void beginFocus()}
                onPlan={() => setPlanSheet('restructure')}
                onChat={() => selectTab('mus')}
              />
            </>
          ) : null}
          {!detail && tab === 'goals' ? (
            <JourneyScreen
              mode="goals"
              goals={goals}
              tasks={tasks}
              routines={allRoutines}
              routineCompletions={routineCompletions}
              workouts={workouts}
              foodEntries={foodEntries}
              progress={progress}
              presenceDates={presenceDates}
              todayLogical={todayLogical}
              faithEnabled={preferences?.faith_enabled ?? false}
              scripture={scripture}
              onAddGoal={() => setGoalFlow({ goalId: null })}
              onOpenGoal={(goal) => setGoalFlow({ goalId: goal.id })}
              onOpenSettings={() => setSettingsOpen(true)}
              onChat={() => selectTab('mus')}
            />
          ) : null}
          {!detail && tab === 'life' ? (
            <HealthScreen
              entries={foodEntries}
              kcalProgress={kcalProgress}
              macros={macros}
              locale={locale}
              todayLogical={todayLogical}
              viewLogicalDate={viewLogicalDate}
              markedDays={markedDays}
              kcalByDate={kcalByDate}
              onSelectDay={setViewDate}
              weights={weights}
              weightTrend={weightTrend}
              weightChange={weightChange}
              workouts={workouts}
              activeWorkout={activeWorkout}
              guidance={guidance}
              guidanceStale={guidanceStale}
              dayType={dayType}
              onOpenWorkout={openWorkout}
              onLogWeight={() => setWeightOpen(true)}
              onOpenTargets={() => setTargetsOpen(true)}
              onOpenTrend={() => setTrendOpen(true)}
              onOpenExpenditure={() => setExpenditureOpen(true)}
              onLogFood={() => pushDetail({ kind: 'food-search' })}
              onScanBarcode={() => pushDetail({ kind: 'food-barcode' })}
              onEditEntry={setEditingFood}
              onChat={() => selectTab('mus')}
            />
          ) : null}
          {!detail && tab === 'grove' ? (
            <JourneyScreen
              mode="grove"
              goals={goals}
              tasks={tasks}
              routines={allRoutines}
              routineCompletions={routineCompletions}
              workouts={workouts}
              foodEntries={foodEntries}
              progress={progress}
              presenceDates={presenceDates}
              todayLogical={todayLogical}
              faithEnabled={preferences?.faith_enabled ?? false}
              scripture={scripture}
              onAddGoal={() => setGoalFlow({ goalId: null })}
              onOpenGoal={(goal) => setGoalFlow({ goalId: goal.id })}
              onOpenSettings={() => setSettingsOpen(true)}
              onWeeklyReset={() => setWeeklyResetOpen(true)}
              onChat={() => selectTab('mus')}
            />
          ) : null}
          {!detail && tab === 'mus' ? (
            <MusScreen userId={userId} logicalDate={logicalDate} recommended={recommended} />
          ) : null}
        </main>

        {!firstRun && !workoutOpen && !settingsOpen && !goalFlow && !planSheet && !weeklyResetOpen ? (
          <nav className={styles.tabbar} aria-label="Primary navigation" data-disabled={detail ? '1' : undefined}>
            {TABS.map(({ id, label, Icon }) => (
              <button key={id} type="button" aria-current={tab === id ? 'page' : undefined} onClick={() => selectTab(id)}>
                <Icon size={23} weight={tab === id ? 'fill' : 'regular'} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        ) : null}

      </div>

      {notice ? <div className={styles.toast} role="status">{notice}</div> : null}

      {addOpen ? (
        <AddSheet
          userId={userId}
          timeZone={timeZone}
          dayStartsAt={dayStartsAt}
          viewLogicalDate={viewLogicalDate}
          todayLogical={todayLogical}
          workoutReady={Boolean(activeWorkout)}
          onClose={() => setAddOpen(false)}
          onFood={() => {
            setAddOpen(false);
            pushDetail({ kind: 'food-search' });
          }}
          onScan={() => {
            setAddOpen(false);
            pushDetail({ kind: 'food-barcode' });
          }}
          onWeight={() => {
            setAddOpen(false);
            setWeightOpen(true);
          }}
          onWorkout={() => {
            setAddOpen(false);
            openWorkout();
          }}
          onTask={() => {
            setAddOpen(false);
            setTaskOpen(true);
          }}
          onLogged={(message) => setNotice(message)}
        />
      ) : null}

      {editingFood ? (
        <FoodRecordSheet
          entry={editingFood}
          userId={userId}
          onClose={() => setEditingFood(null)}
          onChanged={(message) => setNotice(message)}
        />
      ) : null}

      <ActionDialog open={planOpen} onClose={() => setPlanOpen(false)} title="Choose one next action" description="Mus can suggest, but only you can confirm what enters your day.">
        <form className={styles.formStack} onSubmit={choosePlan}>
          <label htmlFor="plan-action">What would make today feel meaningfully lighter?</label>
          <textarea id="plan-action" value={planLabel} onChange={(event) => setPlanLabel(event.target.value)} rows={3} autoFocus />
          <button className={styles.primaryButton} type="submit">Confirm this action</button>
        </form>
      </ActionDialog>

      <ActionDialog open={taskOpen} onClose={() => setTaskOpen(false)} title="Add a task or routine">
        <form className={styles.formStack} onSubmit={addPlanningItem}>
          <fieldset className={styles.segmented}>
            <legend className={styles.srOnly}>Item type</legend>
            <label><input type="radio" name="kind" checked={taskKind === 'task'} onChange={() => setTaskKind('task')} /> Task</label>
            <label><input type="radio" name="kind" checked={taskKind === 'routine'} onChange={() => setTaskKind('routine')} /> Routine</label>
          </fieldset>
          <label htmlFor="item-title">Name</label>
          <input id="item-title" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} autoFocus />
          <button className={styles.primaryButton} type="submit">Save {taskKind}</button>
        </form>
      </ActionDialog>

      <ActionDialog open={weightOpen} onClose={() => setWeightOpen(false)} title="Log your weight" description="One measurement a day is plenty. The trend matters more than any single number.">
        <form className={styles.formStack} onSubmit={saveWeight}>
          <label htmlFor="weight-kg">Weight in kilograms</label>
          <input
            id="weight-kg"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="20"
            max="400"
            value={weightInput}
            onChange={(event) => setWeightInput(event.target.value)}
            autoFocus
          />
          <button className={styles.primaryButton} type="submit">Save measurement</button>
        </form>
      </ActionDialog>

      <TargetsDialog
        open={targetsOpen}
        onClose={() => setTargetsOpen(false)}
        guidance={guidance}
        dayType={dayType}
        recomputing={recomputing}
        onRecompute={() => void recomputeGuidance()}
        onLogWeight={() => {
          setTargetsOpen(false);
          setWeightOpen(true);
        }}
      />

      <ActionDialog open={trendOpen} onClose={() => setTrendOpen(false)} title="How the trend works">
        <div className={styles.readingStack}>
          <p>
            Scale weight moves with water, salt, and sleep. KayaMo smooths your
            measurements with a seven-day half-life and caps any single jump, so one
            heavy day cannot swing the line.
          </p>
          <p>
            {weightChange
              ? `Across the last ${weightChange.days} days your trend moved ${weightChange.changeKg.toFixed(2)} kg.`
              : 'Two measurements on different days are needed before a trend appears.'}
          </p>
          <p className={styles.mutedNote}>
            The trend is a measurement, not a verdict. A flat week is still a week you showed up.
          </p>
        </div>
      </ActionDialog>

      <ActionDialog open={expenditureOpen} onClose={() => setExpenditureOpen(false)} title="Where the expenditure number comes from">
        {guidance?.expenditure ? (
          <div className={styles.readingStack}>
            <dl className={styles.readingList}>
              <div><dt>Estimate</dt><dd>{Math.round(guidance.expenditure.tdeeKcal)} kcal/day</dd></div>
              {guidance.expenditure.ciLow !== null && guidance.expenditure.ciHigh !== null ? (
                <div><dt>Likely range</dt><dd>{Math.round(guidance.expenditure.ciLow)}–{Math.round(guidance.expenditure.ciHigh)} kcal</dd></div>
              ) : null}
              <div><dt>Method</dt><dd>{guidance.expenditure.method}</dd></div>
              <div><dt>Confidence</dt><dd>{Math.round(guidance.expenditure.confidence * 100)}%</dd></div>
              {guidance.expenditure.daysOfData === null ? null : (
                <div><dt>Days of data</dt><dd>{guidance.expenditure.daysOfData}</dd></div>
              )}
            </dl>
            <p className={styles.mutedNote}>
              A formula estimate becomes a blended one once there is enough logged intake and
              enough weight measurements to compare against. More honest days, tighter range.
            </p>
          </div>
        ) : (
          <p>No expenditure estimate yet. Log a weight and a few days of food first.</p>
        )}
      </ActionDialog>

      <ActionDialog
        open={Boolean(settingsField)}
        onClose={() => setSettingsField(null)}
        title="Update this setting"
        description="These numbers recompute targets in code. Mus never sets them."
      >
        {settingsField === 'sex' ? (
          <div className={styles.choiceRow}>
            {(['female', 'male'] as const).map((id) => (
              <button key={id} type="button" className={styles.secondaryButton} onClick={() => void patchProfile({ sex: id })}>
                {id}
              </button>
            ))}
          </div>
        ) : null}
        {settingsField === 'goal' ? (
          <div className={styles.choiceColumn}>
            {(['lose', 'maintain', 'gain'] as const).map((id) => (
              <button key={id} type="button" className={styles.secondaryButton} onClick={() => void patchProfile({ goal: id })}>
                {id}
              </button>
            ))}
          </div>
        ) : null}
        {settingsField === 'timezone' ? (
          <button type="button" className={styles.primaryButton} onClick={() => void patchProfile({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })}>
            Use this device’s timezone
          </button>
        ) : null}
        {settingsField === 'day-start' ? (
          <div className={styles.choiceColumn}>
            {['00:00:00', '04:00:00', '05:00:00', '06:00:00'].map((value) => (
              <button key={value} type="button" className={styles.secondaryButton} onClick={() => void patchProfile({ day_starts_at: value })}>
                {value.slice(0, 5)}
              </button>
            ))}
          </div>
        ) : null}
        {settingsField === 'locale' ? (
          <div className={styles.choiceColumn}>
            {(['taglish', 'en', 'fil'] as const).map((id) => (
              <button key={id} type="button" className={styles.secondaryButton} onClick={() => void patchProfile({ locale: id })}>
                {id}
              </button>
            ))}
          </div>
        ) : null}
      </ActionDialog>
    </div>
  );
}

function DetailView({
  detail,
  userId,
  loggedAt,
  onBack,
  onAddProduct,
  onDescribeInChat,
  onSaved,
}: {
  detail: DetailScreen;
  userId: string;
  loggedAt?: string;
  onBack: () => void;
  onAddProduct: (barcode: string) => void;
  onDescribeInChat: () => void;
  onSaved: () => void;
}) {
  const meta = DETAIL_META[detail.kind];
  return (
    <div className={`${styles.screen} ${styles.listScreen}`}>
      <div className={styles.detailHeader}>
        <button type="button" onClick={onBack} className={styles.detailBack}>
          <ArrowLeft size={18} weight="bold" /> Back
        </button>
        <div>
          <p className={styles.eyebrow}>{meta.eyebrow}</p>
          <h2 className={styles.detailTitle}>{meta.title}</h2>
        </div>
        <p className={styles.detailSubtitle}>{meta.subtitle}</p>
      </div>
      <div className={styles.detailBody}>
        {detail.kind === 'food-search' ? (
          <FoodSearch
            userId={userId}
            loggedAt={loggedAt}
            onAddProduct={() => onAddProduct('')}
            onDescribeInChat={onDescribeInChat}
          />
        ) : null}
        {detail.kind === 'food-barcode' ? (
          <BarcodeLookup userId={userId} onAddProduct={onAddProduct} />
        ) : null}
        {detail.kind === 'food-add' ? (
          <AddProductForm barcode={detail.barcode} onSaved={onSaved} />
        ) : null}
      </div>
    </div>
  );
}

function CompanionButton({ onClick }: { onClick: () => void }) {
  return (
    <button className={styles.companionButton} type="button" onClick={onClick} aria-label="Talk to Mus">
      <Image src="/coco-seed.png" alt="" width={44} height={44} />
    </button>
  );
}

function AppScreenHeader({ title, subtitle, onChat }: { title: string; subtitle: string; onChat: () => void }) {
  return (
    <header className={styles.appScreenHeader}>
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
        <SyncStatusBar className={styles.syncChip} />
      </div>
      <CompanionButton onClick={onChat} />
    </header>
  );
}

function CocoHabitat({ progress, onGrove }: { progress: { totalPoints: number; stageKey: string }; onGrove: () => void }) {
  const threshold = progress.totalPoints < 100 ? 100 : progress.totalPoints < 300 ? 300 : progress.totalPoints < 700 ? 700 : 1500;
  const percent = Math.min(100, Math.max(4, progress.totalPoints / threshold * 100));
  return (
    <section className={styles.habitat} aria-label={`Mus is at the ${stageLabel(progress.stageKey)} stage with ${progress.totalPoints} growth points`}>
      <div className={styles.atmosphere} aria-hidden="true" />
      <Image className={styles.cocoImage} src="/coco-seed.png" alt="Mus, a hopeful seed companion with a gentle expression" width={196} height={196} priority />
      <button className={styles.stageProgress} type="button" onClick={onGrove}>
        <Tree size={16} weight="fill" />
        <span>{stageLabel(progress.stageKey)}</span>
        <i aria-hidden="true"><b style={{ width: `${percent}%` }} /></i>
      </button>
    </section>
  );
}

function HomeScreen({
  date,
  recommended,
  completedCount,
  foodCount,
  progress,
  homeGoal,
  homeGoalSteps,
  inboxDraft,
  inboxItems,
  onInboxDraft,
  onCaptureInbox,
  onPlan,
  onStart,
  onGrove,
  onOpenGoal,
  onChat,
  onBecome,
  onWeeklyReset,
  futureSelf,
  welcomeBack,
  resetDue,
}: {
  date: Date;
  recommended: string | null;
  completedCount: number;
  foodCount: number;
  progress: { totalPoints: number; stageKey: string };
  homeGoal: LocalGoal | null;
  homeGoalSteps: number;
  inboxDraft: string;
  inboxItems: LocalInboxItem[];
  onInboxDraft: (value: string) => void;
  onCaptureInbox: (event: React.FormEvent) => void;
  onPlan: () => void;
  onStart: () => void;
  onGrove: () => void;
  onOpenGoal: () => void;
  onChat: () => void;
  onBecome: () => void;
  onWeeklyReset: () => void;
  futureSelf: string | null;
  welcomeBack: boolean;
  resetDue: boolean;
}) {
  const weeks = homeGoal
    ? Math.max(1, Math.floor(Math.max(0, Date.now() - Date.parse(homeGoal.created_at)) / 604_800_000) + 1)
    : 1;
  return (
    <div className={`${styles.screen} ${styles.homeScreen}`}>
      <header className={styles.homeHeader}>
        <div className={styles.homeTop}>
          <p className={styles.eyebrow} suppressHydrationWarning>
            {titleDate(date)}
          </p>
          <SyncStatusBar className={styles.syncChip} />
        </div>
        <h2 suppressHydrationWarning>{greeting(date)}</h2>
        <p className={styles.homeLead}>
          {welcomeBack
            ? 'Welcome back. Nothing was taken away.'
            : recommended
              ? 'One thing matters now. Mus is holding the rest.'
              : 'Nothing is planned yet. That is allowed.'}
        </p>
      </header>
      <CocoHabitat progress={progress} onGrove={onGrove} />
      {welcomeBack ? (
        <p className={`${styles.mutedNote} ${styles.homeNote}`}>
          We will not dump overdue work on today. Plan one realistic step.
        </p>
      ) : null}
      {!futureSelf ? (
        <button type="button" className={styles.workingToward} onClick={onBecome}>
          <Compass size={22} />
          <span>
            <b>Becoming</b>
            <strong>Who are you trying to become?</strong>
            <small>A sentence is enough. Skip anytime.</small>
          </span>
          <CaretRight size={16} />
        </button>
      ) : (
        <p className={`${styles.mutedNote} ${styles.homeNote}`}>{futureSelf}</p>
      )}
      {resetDue ? (
        <button type="button" className={styles.workingToward} onClick={onWeeklyReset}>
          <Tree size={22} />
          <span>
            <b>Weekly Reset</b>
            <strong>A look at the week, not a score</strong>
            <small>Unfinished stays off today until you choose.</small>
          </span>
          <CaretRight size={16} />
        </button>
      ) : null}
      {homeGoal ? (
        <button type="button" className={styles.workingToward} onClick={onOpenGoal}>
          <Compass size={22} />
          <span>
            <b>Working toward</b>
            <strong>{homeGoal.title}</strong>
            <small>
              {homeGoalSteps} {homeGoalSteps === 1 ? 'step' : 'steps'} · week {weeks}
            </small>
          </span>
          <CaretRight size={16} />
        </button>
      ) : null}
      <section className={styles.actionCard}>
        <div className={styles.missionEyebrow}>
          <p>{recommended ? 'Next on your list' : 'Nothing planned'}</p>
          {recommended ? <span>confirmed</span> : null}
        </div>
        <h3>{recommended ?? 'Want to put one thing on today?'}</h3>
        <p className={styles.muted}>{recommended ? 'Mus is reminding you, not changing your plan.' : 'Mus will not fill your day without you.'}</p>
        <div className={styles.buttonRow}>
          <button className={styles.primaryButton} type="button" onClick={recommended ? onStart : onPlan}>
            {recommended ? 'Start' : 'Plan today'}
          </button>
          <button className={styles.secondaryButton} type="button" onClick={recommended ? onPlan : onChat}>
            {recommended ? 'Change' : 'Ask Mus'}
          </button>
        </div>
      </section>
      <section className={styles.inboxCapture}>
        <p className={styles.eyebrow}>Life Inbox</p>
        <h3>Park it here</h3>
        <p className={styles.muted}>Private by default. Mus cannot read this until you allow it.</p>
        <form onSubmit={onCaptureInbox}>
          <label className={styles.srOnly} htmlFor="life-inbox">Life Inbox</label>
          <textarea
            id="life-inbox"
            rows={2}
            value={inboxDraft}
            onChange={(event) => onInboxDraft(event.target.value)}
            placeholder="A thought, a task, something you do not want to lose…"
          />
          <button className={styles.secondaryButton} type="submit" disabled={!inboxDraft.trim()}>
            Save privately
          </button>
        </form>
        {inboxItems.length > 0 ? (
          <p className={styles.inboxCount}>
            {inboxItems.length} unprocessed {inboxItems.length === 1 ? 'item' : 'items'}
          </p>
        ) : null}
      </section>
      {completedCount > 0 || foodCount > 0 ? (
        <section className={styles.confirmedLedger} aria-label="Confirmed activity today">
          <p className={styles.eyebrow}>Confirmed today</p>
          {completedCount > 0 ? <div><CheckCircle size={19} weight="fill" /><span>{completedCount} {completedCount === 1 ? 'action' : 'actions'} completed</span><small>today</small></div> : null}
          {foodCount > 0 ? <div><ForkKnife size={19} /><span>{foodCount} {foodCount === 1 ? 'item' : 'items'} logged</span><small>today</small></div> : null}
        </section>
      ) : null}
    </div>
  );
}

function TodayScreen({
  embedded,
  date,
  todayLogical,
  viewLogicalDate,
  markedDays,
  onSelectDay,
  tasks,
  routines,
  completedRoutineIds,
  plan,
  sessions,
  reflection,
  onReflection,
  onSaveReflection,
  onAdd,
  onToggleTask,
  onCompleteRoutine,
  onFocus,
  onPlan,
  onChat,
}: {
  embedded?: boolean;
  date: Date;
  todayLogical: string;
  viewLogicalDate: string;
  markedDays: ReadonlySet<string>;
  onSelectDay: (iso: string) => void;
  tasks: LocalTask[];
  routines: LocalRoutine[];
  completedRoutineIds: Set<string>;
  plan: LocalDailyPlan | null;
  sessions: LocalFocusSession[];
  reflection: string;
  onReflection: (value: string) => void;
  onSaveReflection: () => void;
  onAdd: () => void;
  onToggleTask: (task: LocalTask) => void;
  onCompleteRoutine: (routine: LocalRoutine) => void;
  onFocus: () => void;
  onPlan: () => void;
  onChat: () => void;
}) {
  const openTasks = tasks.filter((task) => !task.completed_at);
  const doneTasks = tasks.filter((task) => task.completed_at);
  const openRoutines = routines.filter((routine) => !completedRoutineIds.has(routine.id));
  const doneRoutines = routines.filter((routine) => completedRoutineIds.has(routine.id));
  const confirmed = doneTasks.length + doneRoutines.length;
  const total = tasks.length + routines.length;
  return (
    <div className={embedded ? styles.homeToday : `${styles.screen} ${styles.listScreen}`}>
      {embedded ? null : (
        <AppScreenHeader title="Today" subtitle={`${titleDate(date)} · ${confirmed} of ${Math.max(total, confirmed)} confirmed`} onChat={onChat} />
      )}
      <DayStrip todayLogical={todayLogical} selected={viewLogicalDate} marked={markedDays} onSelect={onSelectDay} />
      <PastDayBanner visible={viewLogicalDate !== todayLogical} />
      <section className={styles.nextActionBar}>
        <div><p className={styles.eyebrow}>Next · on your list</p><h3>{plan?.selected_label_snapshot ?? 'Choose one honest next action'}</h3><span>{plan ? '25 min focus · saved on device' : 'Nothing is added until you confirm'}</span></div>
        <button type="button" onClick={plan ? onFocus : onPlan}>{plan ? 'Start' : 'Choose'}</button>
      </section>

      <section className={styles.todaySection}>
        <div className={styles.compactSectionTitle}><p className={styles.eyebrow}>Plan · {openTasks.length + openRoutines.length} open</p><button type="button" onClick={onAdd}><Plus size={17} /> Add</button></div>
        <div className={styles.plainList}>
          {openTasks.length === 0 && openRoutines.length === 0 ? <EmptyLine text="Nothing open. Keep the day light." /> : openTasks.map((task) => (
            <button key={task.id} className={styles.checkRow} type="button" onClick={() => onToggleTask(task)} aria-pressed={Boolean(task.completed_at)}>
              <Circle size={21} />
              <span><strong>{task.title}</strong><small>Scheduled for today</small></span>
              <span className={styles.rowMeta}>task</span>
            </button>
          ))}
          {openRoutines.map((routine) => (
            <button key={routine.id} className={styles.checkRow} type="button" onClick={() => onCompleteRoutine(routine)} aria-pressed={false}>
              <Circle size={21} />
              <span><strong>{routine.title}</strong><small>Repeats gently</small></span>
              <span className={styles.rowMeta}>habit</span>
            </button>
          ))}
        </div>
      </section>

      {doneTasks.length + doneRoutines.length > 0 ? <section className={styles.todaySection}>
        <p className={styles.eyebrow}>Done · stays visible</p>
        <div className={styles.plainList}>
          {doneTasks.map((task) => <button key={task.id} className={styles.checkRow} type="button" onClick={() => onToggleTask(task)} aria-pressed={true}><CheckCircle size={21} weight="fill" /><span className={styles.done}><strong>{task.title}</strong></span><small className={styles.rowMeta}>done</small></button>)}
          {doneRoutines.map((routine) => <button key={routine.id} className={styles.checkRow} type="button" disabled aria-pressed={true}><CheckCircle size={21} weight="fill" /><span className={styles.done}><strong>{routine.title}</strong></span><small className={styles.rowMeta}>done</small></button>)}
        </div>
      </section> : null}

      <section className={styles.focusSuggestion}>
        <p className={styles.eyebrow}>Focus</p>
        <h3>{plan ? `A 25-minute session on “${plan.selected_label_snapshot}” is the one Mus keeps suggesting.` : 'Choose one action and Mus can hold a quiet timer for it.'}</h3>
        <p>Timer and nudges only. KayaMo in the browser cannot block other apps.</p>
        {plan ? <button type="button" onClick={onFocus}><Clock size={17} /> Set up focus</button> : null}
        {sessions.filter((session) => session.status === 'completed').length > 0 ? <span className={styles.successLine}><CheckCircle weight="fill" /> {sessions.filter((session) => session.status === 'completed').length} completed</span> : null}
      </section>

      <section className={styles.reflectionCard}>
        <p className={styles.eyebrow}>Evening reflection · local only</p>
        <h3>What helped today?</h3>
        <textarea className={styles.inlineTextarea} value={reflection} onChange={(event) => onReflection(event.target.value)} rows={3} placeholder="A few honest words are enough." />
        <button className={styles.secondaryButton} type="button" onClick={onSaveReflection}>Save on this device</button>
      </section>
    </div>
  );
}

function HealthScreen({
  entries,
  kcalProgress,
  macros,
  locale,
  todayLogical,
  viewLogicalDate,
  markedDays,
  kcalByDate,
  onSelectDay,
  weights,
  weightTrend,
  weightChange,
  workouts,
  activeWorkout,
  guidance,
  guidanceStale,
  dayType,
  onOpenWorkout,
  onLogWeight,
  onOpenTargets,
  onOpenTrend,
  onOpenExpenditure,
  onLogFood,
  onScanBarcode,
  onEditEntry,
  onChat,
}: {
  entries: ReturnType<typeof useLiveFoodEntries>;
  kcalProgress: NutritionProgress;
  macros: MacroProgress[];
  locale: Locale;
  todayLogical: string;
  viewLogicalDate: string;
  markedDays: ReadonlySet<string>;
  kcalByDate: ReadonlyMap<string, number>;
  onSelectDay: (iso: string) => void;
  weights: LocalWeightLog[];
  weightTrend: ReturnType<typeof computeWeightTrend>;
  weightChange: ReturnType<typeof trendChange>;
  workouts: LocalWorkout[];
  activeWorkout: LocalWorkout | null;
  guidance: GuidanceSnapshot | null;
  guidanceStale: boolean;
  dayType: string;
  onOpenWorkout: () => void;
  onLogWeight: () => void;
  onOpenTargets: () => void;
  onOpenTrend: () => void;
  onOpenExpenditure: () => void;
  onLogFood: () => void;
  onScanBarcode: () => void;
  onEditEntry: (entry: LocalFoodEntry) => void;
  onChat: () => void;
}) {
  const orderedWeights = [...weights]
    .sort((a, b) => a.measured_on.localeCompare(b.measured_on))
    .slice(-7);
  const latestWeight = orderedWeights.at(-1);
  const weightValues = orderedWeights.map((row) => Number(row.weight_kg));
  const weightMin = Math.min(...weightValues);
  const weightMax = Math.max(...weightValues);
  const latestTrend = weightTrend.at(-1);
  const weeklyRateKg =
    weightChange && weightChange.days > 0
      ? (weightChange.changeKg / weightChange.days) * 7
      : null;
  const grouped = orderedMealSlots()
    .map((slot) => ({
      slot,
      rows: entries.filter((entry) => asMealSlot(entry.meal_slot) === slot),
    }))
    .filter((group) => group.rows.length > 0);

  return (
    <div className={`${styles.screen} ${styles.listScreen}`}>
      <AppScreenHeader
        title="Life"
        subtitle={viewLogicalDate === todayLogical ? 'Physical Self first. Numbers come from your records, not from Mus.' : 'You are looking at a past day.'}
        onChat={onChat}
      />
      <DayStrip todayLogical={todayLogical} selected={viewLogicalDate} marked={markedDays} onSelect={onSelectDay} />
      <PastDayBanner visible={viewLogicalDate !== todayLogical} />

      <section className={styles.healthSection}>
        <p className={styles.eyebrow}>Food · {viewLogicalDate === todayLogical ? 'today' : viewLogicalDate}</p>
        <div className={styles.nutritionCard}>
          <div className={styles.calorieLine}>
            <strong>{kcalProgress.eatenKcal}</strong>
            {kcalProgress.targetKcal === null ? (
              <span>kcal logged today · {entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
            ) : (
              <span>
                of {kcalProgress.targetKcal} kcal ·{' '}
                {kcalProgress.over
                  ? `${Math.abs(kcalProgress.remainingKcal ?? 0)} over`
                  : `${kcalProgress.remainingKcal} left`}
              </span>
            )}
          </div>
          {kcalProgress.percent === null ? null : (
            <div
              className={styles.kcalTrack}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={kcalProgress.targetKcal ?? 0}
              aria-valuenow={kcalProgress.eatenKcal}
              aria-label="Calories logged against today's target"
            >
              <b
                className={kcalProgress.over ? styles.kcalOver : undefined}
                style={{ width: `${kcalProgress.percent}%` }}
              />
            </div>
          )}
          <div className={styles.macroRow}>
            {macros.map((macro) => (
              <div key={macro.key}>
                <span>{macro.label}</span>
                <strong>{macro.eatenG}g</strong>
                {macro.targetG === null ? null : <small>of {macro.targetG}g</small>}
              </div>
            ))}
            {kcalProgress.targetKcal === null ? null : (
              <button className={styles.macroLink} type="button" onClick={onOpenTargets}>
                Targets
              </button>
            )}
          </div>
        </div>
        {kcalProgress.targetKcal === null ? (
          <GuidanceSetupNote guidance={guidance} onOpenTargets={onOpenTargets} />
        ) : null}
        {guidanceStale ? (
          <p className={styles.mutedNote}>
            Showing the last targets saved on this device. They refresh when you reconnect.
          </p>
        ) : null}
      </section>

      <section className={styles.healthSection}>
        {entries.length === 0 ? (
          <div className={styles.plainList}>
            <EmptyLine text="Nothing logged yet. Honest logging is the goal." />
          </div>
        ) : (
          grouped.map((group) => (
            <div className={styles.mealGroup} key={group.slot}>
              <p className={styles.mealGroupLabel}>{mealSlotLabel(group.slot, locale)}</p>
              <div className={styles.plainList}>
                {group.rows.map((entry) => (
                  <button className={`${styles.dataRow} ${styles.dataRowButton}`} type="button" key={entry.id} onClick={() => onEditEntry(entry)}>
                    <div>
                      <strong>{entry.food_name_snapshot}</strong>
                      <span>{entry.serving_label_snapshot ?? `${entry.grams} g`}</span>
                    </div>
                    <span>
                      <strong>{Math.round(Number(entry.kcal))}</strong>
                      <small>
                        {entry.source} · {Math.round(Number(entry.confidence) * 100)}%
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
        <div className={styles.healthPrimaryActions}>
          <button type="button" onClick={onLogFood}>
            <MagnifyingGlass size={18} weight="bold" /> Log food
          </button>
          <button type="button" onClick={onScanBarcode} aria-label="Scan barcode">
            <Barcode size={21} />
          </button>
        </div>
      </section>

      <WeekBars todayLogical={todayLogical} kcalByDate={kcalByDate} selected={viewLogicalDate} />

      <section className={styles.healthSection}>
        <p className={styles.eyebrow}>Weight &amp; guidance</p>
        <div className={styles.weightCard}>
          <div className={styles.weightHeadline}>
            <div>
              <strong>{latestWeight ? Number(latestWeight.weight_kg).toFixed(1) : '—'}</strong>
              <span> kg</span>
              <p>
                {latestTrend && weeklyRateKg !== null && weightChange
                  ? `Trend ${latestTrend.trendWeightKg.toFixed(1)} kg · ${
                      weeklyRateKg < 0 ? 'down' : 'up'
                    } ${Math.abs(weeklyRateKg).toFixed(2)} kg/week over ${weightChange.days} days`
                  : latestWeight
                    ? `Last logged ${latestWeight.measured_on}`
                    : 'No weight logged yet'}
              </p>
            </div>
            <button className={styles.secondaryButton} type="button" onClick={onLogWeight}>
              Log weight
            </button>
          </div>
          {orderedWeights.length >= 2 ? (
            <div
              className={styles.weightBars}
              aria-label={`Weight trend across ${orderedWeights.length} confirmed measurements`}
            >
              {orderedWeights.map((row) => (
                <i
                  key={row.id}
                  style={{
                    height: `${35 + ((Number(row.weight_kg) - weightMin) / Math.max(0.1, weightMax - weightMin)) * 55}%`,
                  }}
                />
              ))}
            </div>
          ) : null}
          <div className={styles.guidanceActions}>
            {latestTrend ? (
              <button type="button" onClick={onOpenTrend}>How the trend works</button>
            ) : null}
            {guidance?.expenditure ? (
              <button type="button" onClick={onOpenExpenditure}>Expenditure</button>
            ) : null}
          </div>
          <p>
            {guidance?.expenditure
              ? `Estimated expenditure ${Math.round(guidance.expenditure.tdeeKcal)} kcal · reading today as a ${dayType} day.`
              : 'Guidance appears only from confirmed records and code-derived safety rules.'}
          </p>
        </div>
      </section>

      <section className={styles.healthSection}>
        <p className={styles.eyebrow}>Fitness</p>
        <div className={styles.trainingCard}>
          <h3>{activeWorkout ? 'Workout in progress' : 'Ready when you are'}</h3>
          <p>{activeWorkout ? 'This session is saved locally and survives a reconnect.' : `${workouts.filter((row) => row.status === 'completed').length} completed workouts in history.`}</p>
          <div>
            <button type="button" onClick={onOpenWorkout}>
              {activeWorkout ? 'Continue workout' : 'Start workout'}
            </button>
            <span className={styles.secondaryActionLabel}>{workouts.length} logged</span>
          </div>
        </div>
      </section>

      <p className={styles.safetyNote}>Health progress never earns rewards for eating less, losing weight, or training through pain.</p>
      <section className={styles.lifeShelves}>
        <p className={styles.eyebrow}>Other areas</p>
        {LIFE_AREAS.filter((area) => area !== 'physical').map((area) => (
          <div key={area} className={styles.lifeShelf}>
            <span>
              <strong>{LIFE_AREA_LABELS[area]}</strong>
              <small>Set up later. Hidden areas stay gone without rebuilding the app.</small>
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}

const DAY_TYPE_NOTES: Record<string, string> = {
  training: 'Training days carry more carbohydrate to fuel the session.',
  rest: 'Rest days sit closest to the plain estimate.',
  refeed: 'A refeed day deliberately returns to maintenance.',
  deload: 'Deload weeks lower the training load, not the food.',
};

/** Clamp reasons come from the target engine, never from prompt text. */
const CLAMP_REASON_COPY: Record<string, string> = {
  calorie_floor: 'Raised to the calorie floor set in code.',
  max_deficit: 'Held at the maximum safe deficit for your expenditure.',
  max_weekly_rate: 'Slowed to the maximum safe weekly rate.',
};

function TargetsDialog({
  open,
  onClose,
  guidance,
  dayType,
  recomputing,
  onRecompute,
  onLogWeight,
}: {
  open: boolean;
  onClose: () => void;
  guidance: GuidanceSnapshot | null;
  dayType: string;
  recomputing: boolean;
  onRecompute: () => void;
  onLogWeight: () => void;
}) {
  const targets = guidance?.targets ?? [];
  const active = targets.find((row) => row.dayType === dayType) ?? null;
  const clampReasons = [...new Set(targets.flatMap((row) => row.clampReasons))];

  return (
    <ActionDialog
      open={open}
      onClose={onClose}
      title="Your daily targets"
      description="Generated in code from your confirmed records. Mus never sets these numbers."
    >
      <div className={styles.readingStack}>
        {targets.length === 0 ? (
          <>
            <p>
              No targets yet. They need your sex, birth year, height, activity baseline, and
              goal on your profile, plus at least one weight log.
            </p>
            {guidance && !guidance.profile.complete ? (
              <p className={styles.mutedNote}>
                Still needed: {guidance.profile.missing.map((field) => field.replaceAll('_', ' ')).join(', ')}.
              </p>
            ) : null}
            <button className={styles.secondaryButton} type="button" onClick={onLogWeight}>
              Log a weight
            </button>
          </>
        ) : (
          <>
            <TargetTable targets={targets} dayType={dayType} />
            {active ? (
              <p className={styles.mutedNote}>
                {DAY_TYPE_NOTES[active.dayType] ?? ''} Weekly rate {active.weeklyRatePercent}% of
                body weight · confidence {Math.round(active.confidence * 100)}%.
              </p>
            ) : null}
            {clampReasons.length > 0 ? (
              <div className={styles.safetyBlock}>
                <p className={styles.eyebrow}>Safety limits applied</p>
                <ul>
                  {clampReasons.map((reason) => (
                    <li key={reason}>{CLAMP_REASON_COPY[reason] ?? reason.replaceAll('_', ' ')}</li>
                  ))}
                </ul>
                <p className={styles.mutedNote}>
                  Floors and the deficit ceiling are enforced in code. They cannot be lowered by
                  asking Mus.
                </p>
              </div>
            ) : null}
          </>
        )}
        <button
          className={styles.primaryButton}
          type="button"
          onClick={onRecompute}
          disabled={recomputing}
        >
          {recomputing ? 'Recomputing…' : 'Recompute from my records'}
        </button>
      </div>
    </ActionDialog>
  );
}

function TargetTable({
  targets,
  dayType,
}: {
  targets: readonly NutritionTargetView[];
  dayType: string;
}) {
  return (
    <table className={styles.targetTable}>
      <thead>
        <tr>
          <th scope="col">Day</th>
          <th scope="col">kcal</th>
          <th scope="col">P</th>
          <th scope="col">C</th>
          <th scope="col">F</th>
        </tr>
      </thead>
      <tbody>
        {targets.map((row) => (
          <tr key={row.dayType} aria-current={row.dayType === dayType ? 'true' : undefined}>
            <th scope="row">{row.dayType}</th>
            <td>{Math.round(row.kcal)}</td>
            <td>{Math.round(row.proteinG)}</td>
            <td>{Math.round(row.carbsG)}</td>
            <td>{Math.round(row.fatG)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Targets need a goal, a weight, and an expenditure estimate. Naming the
 * missing piece is more useful than hiding the target line with no reason.
 */
function GuidanceSetupNote({
  guidance,
  onOpenTargets,
}: {
  guidance: GuidanceSnapshot | null;
  onOpenTargets: () => void;
}) {
  if (!guidance) {
    return <p className={styles.mutedNote}>Targets load when you are back online.</p>;
  }
  const needsProfile = !guidance.profile.complete;
  return (
    <div className={styles.setupNote}>
      <p>
        {needsProfile
          ? 'A daily target needs your sex, birth year, height, activity baseline, and goal.'
          : 'A daily target needs at least one weight log so expenditure can be estimated.'}
      </p>
      <button className={styles.secondaryButton} type="button" onClick={onOpenTargets}>
        Set up targets
      </button>
    </div>
  );
}

function JourneyScreen({ mode, goals, tasks, routines, routineCompletions, workouts, foodEntries, progress, presenceDates, todayLogical, faithEnabled, scripture, onAddGoal, onOpenGoal, onOpenSettings, onWeeklyReset, onChat }: {
  mode: 'goals' | 'grove';
  goals: LocalGoal[];
  tasks: LocalTask[];
  routines: LocalRoutine[];
  routineCompletions: LocalRoutineCompletion[];
  workouts: LocalWorkout[];
  foodEntries: ReturnType<typeof useLiveFoodEntries>;
  progress: { totalPoints: number; stageKey: string; acceptedEventKeys: string[] };
  presenceDates: string[];
  todayLogical: string;
  faithEnabled: boolean;
  scripture: LocalScripturePassage[];
  onAddGoal: () => void;
  onOpenGoal: (goal: LocalGoal) => void;
  onOpenSettings: () => void;
  onWeeklyReset?: () => void;
  onChat: () => void;
}) {
  const trace = progress.acceptedEventKeys.slice(-5).reverse();
  const eventLabels = new Map<string, string>([
    ...tasks.map((task) => [task.id, task.title] as const),
    ...routines.map((routine) => [routine.id, routine.title] as const),
    ...routineCompletions.map((completion) => [completion.id, routines.find((routine) => routine.id === completion.routine_id)?.title ?? 'Routine completed'] as const),
    ...goals.map((goal) => [goal.id, goal.title] as const),
    ...workouts.map((workout) => [workout.id, 'Completed workout'] as const),
    ...foodEntries.map((entry) => [entry.id, entry.food_name_snapshot] as const),
  ]);
  const presenceSet = new Set(presenceDates);
  const last28 = Array.from({ length: 28 }, (_, index) => shiftLogicalDate(todayLogical, index - 27));
  const presentCount = last28.filter((iso) => presenceSet.has(iso)).length;
  const goalList = (
    <section className={styles.journeySection}>
      <div className={styles.compactSectionTitle}><p className={styles.eyebrow}>Goals you confirmed</p><button type="button" onClick={onAddGoal}><Plus size={17} /> Add</button></div>
      <div className={styles.goalList}>
        {goals.length === 0 ? <EmptyLine text="No goals yet. Start with something that matters to you." /> : goals.map((goal) => (
          <button key={goal.id} className={styles.checkRow} type="button" onClick={() => onOpenGoal(goal)}>
            {goal.status === 'completed' ? <CheckCircle size={23} weight="fill" /> : <Target size={23} />}
            <span className={goal.status === 'completed' ? styles.done : ''}>{goal.title}</span>
            <span className={styles.rowMeta}>{goal.status}</span>
          </button>
        ))}
      </div>
    </section>
  );
  if (mode === 'goals') {
    return (
      <div className={`${styles.screen} ${styles.listScreen}`}>
        <AppScreenHeader title="Goals" subtitle="One thing at a time, big enough to matter" onChat={onChat} />
        {goalList}
      </div>
    );
  }
  return (
    <div className={`${styles.screen} ${styles.listScreen}`}>
      <AppScreenHeader title="Grove" subtitle={`${progress.totalPoints} points from confirmed actions`} onChat={onChat} />
      {onWeeklyReset ? (
        <button type="button" className={styles.workingToward} onClick={onWeeklyReset}>
          <Tree size={22} />
          <span>
            <b>Weekly Reset</b>
            <strong>Review goals and unfinished work</strong>
            <small>Nothing is dumped onto today from here.</small>
          </span>
          <CaretRight size={16} />
        </button>
      ) : null}
      <section className={styles.journeySection}>
        <p className={styles.eyebrow}>Stages</p>
        <div className={styles.surfaceCard}>
          {COMPANION_STAGES.map((stage, index) => {
            const current = stage.key === progress.stageKey;
            const reached = progress.totalPoints >= stage.minimumPoints;
            return (
              <div className={styles.ladderRow} key={stage.key}>
                {index === 0 ? (
                  <span className={styles.ladderArt}>
                    <Image src="/coco-seed.png" alt="" width={38} height={38} />
                  </span>
                ) : (
                  <span className={styles.ladderGhost}>art</span>
                )}
                <span>
                  <strong>{stageLabel(stage.key)}</strong>
                  <small>from {stage.minimumPoints} points</small>
                </span>
                <span className={styles.ladderTag} data-on={current ? '1' : undefined}>
                  {current ? 'now' : reached ? 'reached' : 'later'}
                </span>
              </div>
            );
          })}
          <p className={styles.mutedNote}>Four stage illustrations are still missing. The rows hold their place rather than repeating the seed.</p>
        </div>
      </section>
      <section className={styles.journeySection}>
        <p className={styles.eyebrow}>What produced this progress</p>
        <p className={styles.sectionNote}>Every point came from something you confirmed. Nothing rewards restriction, weight lost, or a perfect streak.</p>
        <div className={styles.traceList}>
          {trace.length === 0 ? <EmptyLine text="No progress events yet. Your first confirmed action will appear here." /> : trace.map((eventKey) => {
            const sourceId = eventKey.split(':')[2];
            const event = progressionEvent(eventKey, sourceId ? eventLabels.get(sourceId) : undefined);
            return <div key={eventKey}><CheckCircle size={18} weight="fill" /><span><strong>{event.label}</strong><small>{event.detail}</small></span><b>+{event.points}</b></div>;
          })}
        </div>
      </section>
      <section className={styles.presenceSection}>
        <p className={styles.eyebrow}>Presence · last 28 days</p>
        <div className={styles.surfaceCard}>
          <div className={styles.presenceGrid} role="img" aria-label={`${presentCount} of the last 28 days have a confirmed action`}>
            {last28.map((iso) => (
              <i key={iso} data-active={presenceSet.has(iso) ? '' : undefined} />
            ))}
          </div>
          <div className={styles.presenceLegend}>
            <span><i data-on />confirmed</span>
            <span><i />quiet</span>
          </div>
          <p>
            {presentCount} {presentCount === 1 ? 'day' : 'days'} with something confirmed. Quiet days take nothing away, and there is no streak to break.
          </p>
        </div>
      </section>
      {faithEnabled ? (
        <section className={styles.faithCard}>
          <p className={styles.eyebrow}>Faith mode · reviewed Scripture</p>
          {scripture[0] ? <><blockquote>“{scripture[0].text}”</blockquote><cite>{scripture[0].reference} · World English Bible</cite></> : <p>Reviewed passages will appear here when available.</p>}
          <p className={styles.muted}>Mus can support reflection, but is not a theological authority.</p>
        </section>
      ) : (
        <button className={styles.faithInvite} type="button" onClick={onOpenSettings}>
          <BookOpenText size={24} /><span><strong>Optional faith mode</strong><small>Enable Scripture and private prayer reflections when you want them.</small></span><CaretRight size={20} />
        </button>
      )}
      <button className={styles.settingsEntry} type="button" onClick={onOpenSettings}>
        <GearSix size={20} /><span>Settings and privacy</span><CaretRight size={18} />
      </button>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className={styles.emptyLine}>{text}</p>;
}

function MusScreen({ userId, logicalDate, recommended }: {
  userId: string;
  logicalDate: string;
  recommended: string | null;
}) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LocalCocoMessage[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [rememberedMessageId, setRememberedMessageId] = useState<string | null>(null);

  useEffect(() => {
    if (conversationId) return;
    void createLocalCocoConversation({ userId, title: `Mus · ${logicalDate}` }).then((conversation) => {
      setConversationId(conversation.id);
      setMessages([]);
    });
  }, [conversationId, logicalDate, userId]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const message = text.trim();
    if (!message || !conversationId || busy) return;
    setText('');
    setBusy(true);
    const local = await appendLocalCocoMessage({ userId, conversationId, role: 'user', content: message });
    setMessages((current) => [...current, local]);
    let reply = recommended
      ? `I’m here. Your confirmed next action is “${recommended}.” We can make it smaller, but I won’t change it without you.`
      : 'I’m here. We can name one small next action together, and nothing will be saved until you confirm it.';
    let source: LocalCocoMessage['response_source'] = 'fallback';
    try {
      const response = await fetch('/api/coco/respond', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ requestId: crypto.randomUUID(), mode: 'chat', message, logicalDate }),
      });
      if (response.ok) {
        const result = await response.json() as CocoResponse;
        reply = result.message;
        source = 'model';
      }
    } catch {
      // The deterministic reply keeps Mus useful offline.
    }
    const mus = await appendLocalCocoMessage({ userId, conversationId, role: 'assistant', content: reply, responseSource: source });
    setMessages((current) => [...current, mus]);
    setBusy(false);
  }

  async function rememberMessage(message: LocalCocoMessage) {
    await createLocalAgentMemory({
      userId,
      kind: 'conversation_note',
      content: message.content,
      confirmed: true,
    });
    setRememberedMessageId(message.id);
  }

  useEffect(() => {
    if (!conversationId) return;
    void listLocalCocoMessages(userId, conversationId).then(setMessages);
  }, [conversationId, userId]);

  return (
    <div className={`${styles.screen} ${styles.musScreen}`} aria-labelledby="mus-chat-title">
      <header className={styles.chatHeader}>
        <Image src="/coco-seed.png" alt="" width={48} height={48} />
        <div><h2 id="mus-chat-title">Mus</h2><p>tone · balanced · adapts to the moment</p></div>
        <button className={styles.chatHistoryButton} type="button" aria-label="Conversation history"><Clock size={19} /></button>
      </header>
      <div className={styles.chatMessages} aria-live="polite">
        {messages.length === 0 ? <div className={styles.cocoBubble}>I’m with you. We can talk, reflect, or choose one realistic next step.</div> : null}
        {messages.map((message) => message.role === 'user' ? (
          <div key={message.id} className={styles.userBubble}>{message.content}</div>
        ) : (
          <div key={message.id} className={styles.cocoMessageGroup}>
            <div className={styles.cocoBubble}>{message.content}</div>
            {recommended ? <p className={styles.chatSource}><Clock size={13} /> From your confirmed plan for today.</p> : null}
            <button className={styles.rememberButton} type="button" onClick={() => void rememberMessage(message)} disabled={rememberedMessageId === message.id}>
              {rememberedMessageId === message.id ? <Check size={15} /> : <PushPin size={15} />} {rememberedMessageId === message.id ? 'Remembered' : 'Remember this'}
            </button>
          </div>
        ))}
        {busy ? <div className={styles.cocoBubble}>Thinking carefully…</div> : null}
      </div>
      <form className={styles.chatComposer} onSubmit={send}>
        <label className={styles.srOnly} htmlFor="mus-message">Message Mus</label>
        <textarea id="mus-message" rows={1} value={text} onChange={(event) => setText(event.target.value)} placeholder="Say what’s actually going on…" />
        <button type="submit" disabled={!text.trim() || busy} aria-label="Send message"><PaperPlaneTilt size={21} weight="fill" /></button>
      </form>
      <p className={styles.chatPrivacy}>Mus proposes. You confirm every write.</p>
    </div>
  );
}
