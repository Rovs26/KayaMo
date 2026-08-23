'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  Barcode,
  BookOpenText,
  CalendarCheck,
  Check,
  CheckCircle,
  ChatCircleDots,
  Clock,
  CaretRight,
  Circle,
  ForkKnife,
  GearSix,
  Heartbeat,
  House,
  MagnifyingGlass,
  Moon,
  PaperPlaneTilt,
  Pause,
  Plus,
  PushPin,
  Sparkle,
  Sun,
  Target,
  Tree,
  UserCircle,
  X,
} from '@phosphor-icons/react';
import type {
  CocoResponse,
} from '@kayamo/ai';
import {
  COMPANION_EVENT_POINTS,
  COMPANION_EVENT_TYPES,
  computeWeightTrend,
  dayTypeForToday,
  macroProgress,
  nutritionProgress,
  targetForDayType,
  trendChange,
  type CompanionEventType,
  type GuidanceSnapshot,
  type MacroProgress,
  type NutritionProgress,
  type NutritionTargetView,
} from '@kayamo/core';
import {
  asLocale,
  asMealSlot,
  mealSlotLabel,
  orderedMealSlots,
  type Locale,
} from '@kayamo/food/quick-log';
import {
  appendLocalCocoMessage,
  cacheGuidanceSnapshot,
  getCachedGuidanceSnapshot,
  logWeight,
  createLocalAgentMemory,
  completeLocalRoutine,
  createLocalCocoConversation,
  createLocalFocusSession,
  createLocalGoal,
  createLocalRoutine,
  createLocalTask,
  finishLocalFocusSession,
  finishLocalWorkout,
  getLocalCompanionProgression,
  getLocalDailyLoopPreferences,
  getLocalDailyPlan,
  listLocalCocoMessages,
  listLocalFocusSessions,
  listLocalGoals,
  listLocalRoutineCompletions,
  listLocalRoutines,
  listLocalScripture,
  listLocalTasksForDate,
  listLocalWeightLogs,
  listLocalWorkoutHistory,
  logicalDateFromInstant,
  saveLocalDailyLoopPreferences,
  saveLocalDailyPlan,
  saveLocalJournalEntry,
  setLocalGoalStatus,
  setLocalTaskCompleted,
  startLocalFocusSession,
  startLocalWorkout,
  type LocalCocoMessage,
  type LocalDailyLoopPreference,
  type LocalDailyPlan,
  type LocalFocusSession,
  type LocalGoal,
  type LocalRoutine,
  type LocalRoutineCompletion,
  type LocalScripturePassage,
  type LocalTask,
  type LocalWeightLog,
  type LocalWorkout,
  useLiveFoodEntries,
} from '@kayamo/offline';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { SignOutButton } from './sign-out-button';
import { SyncStatusBar } from './sync-status-bar';
import styles from './kayamo-app.module.css';

type Tab = 'home' | 'today' | 'health' | 'journey';
type Theme = 'system' | 'day' | 'night';

const TABS: Array<{ id: Tab; label: string; Icon: typeof House }> = [
  { id: 'home', label: 'Home', Icon: House },
  { id: 'today', label: 'Today', Icon: CalendarCheck },
  { id: 'health', label: 'Health', Icon: Heartbeat },
  { id: 'journey', label: 'Journey', Icon: Tree },
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
  const tabScrollPositions = useRef<Record<Tab, number>>({ home: 0, today: 0, health: 0, journey: 0 });
  const [chatOpen, setChatOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
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
  const [goalTitle, setGoalTitle] = useState('');
  const [reflection, setReflection] = useState('');

  // The profile owns these, so the first render uses defaults and settles once
  // guidance arrives. A night-shift day boundary must not be assumed away.
  const timeZone = guidance?.profile.timezone ?? 'Asia/Manila';
  const dayStartsAt = guidance?.profile.dayStartsAt ?? '00:00:00';
  const locale: Locale = asLocale(guidance?.profile.locale);

  const date = useMemo(() => new Date(now), [now]);
  const logicalDate = logicalDateFromInstant(date.toISOString(), timeZone, dayStartsAt);
  const foodEntries = useLiveFoodEntries(userId, logicalDate);
  const activeFocus = focusSessions.find((session) => session.status === 'active') ?? null;
  const activeWorkout = workouts.find((workout) => workout.status === 'active') ?? null;
  const completedRoutineIds = useMemo(
    () => new Set(routineCompletions.map((row) => row.routine_id)),
    [routineCompletions],
  );

  const refresh = useCallback(async () => {
    const weekday = new Date(`${logicalDate}T12:00:00`).getDay();
    const [nextTasks, nextRoutines, nextAllRoutines, completions, nextPlan, sessions, nextGoals, nextWorkouts, nextWeights, prefs, nextProgress] = await Promise.all([
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
    ]);
    setTasks(nextTasks);
    setRoutines(nextRoutines);
    setAllRoutines(nextAllRoutines);
    setRoutineCompletions(completions);
    setPlan(nextPlan);
    setFocusSessions(sessions);
    setGoals(nextGoals);
    setWorkouts(nextWorkouts);
    setWeights(nextWeights);
    setPreferences(prefs);
    setProgress(nextProgress);
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
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

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
    setAddOpen(false);
    setNotice(`${taskKind === 'task' ? 'Task' : 'Routine'} saved on this device.`);
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
    setNotice('Confirmed. Coco will hold this as your next action.');
  }

  async function toggleTask(task: LocalTask) {
    await setLocalTaskCompleted({ id: task.id, userId, completed: !task.completed_at, timeZone, dayStartsAt });
    setNotice(task.completed_at ? 'Task reopened.' : 'Done. Coco noticed the honest follow-through.');
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
      setPlanOpen(true);
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

  async function addGoal(event: React.FormEvent) {
    event.preventDefault();
    const title = goalTitle.trim();
    if (!title) return;
    await createLocalGoal({ userId, title });
    setGoalTitle('');
    setGoalOpen(false);
    setNotice('Goal saved after your confirmation.');
    await refresh();
  }

  async function finishGoal(goal: LocalGoal) {
    await setLocalGoalStatus({ id: goal.id, userId, status: goal.status === 'completed' ? 'active' : 'completed', timeZone, dayStartsAt });
    await refresh();
  }

  async function toggleFaith(enabled: boolean) {
    const next = await saveLocalDailyLoopPreferences({ userId, faithEnabled: enabled });
    setPreferences(next);
    setScripture(await listLocalScripture({ faithEnabled: enabled }));
  }

  async function saveReflection() {
    if (!reflection.trim()) return;
    await saveLocalJournalEntry({ userId, kind: 'reflection', content: reflection });
    setReflection('');
    setNotice('Reflection saved only on this device.');
  }

  async function toggleWorkout() {
    if (activeWorkout) {
      await finishLocalWorkout({ id: activeWorkout.id, userId });
      setNotice('Workout completed from confirmed activity.');
    } else {
      await startLocalWorkout({ userId, timeZone, dayStartsAt });
      setNotice('Workout started and saved offline.');
    }
    await refresh();
  }

  async function saveWeight(event: React.FormEvent) {
    event.preventDefault();
    const weightKg = weightInput.trim();
    if (!Number.isFinite(Number(weightKg)) || Number(weightKg) <= 0) {
      setNotice('Enter a weight in kilograms.');
      return;
    }
    await logWeight({ userId, weightKg, source: 'manual', timeZone, dayStartsAt });
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

  function selectTab(nextTab: Tab) {
    if (nextTab === tab) return;
    if (mainRef.current) tabScrollPositions.current[tab] = mainRef.current.scrollTop;
    setTab(nextTab);
    window.requestAnimationFrame(() => {
      if (mainRef.current) mainRef.current.scrollTop = tabScrollPositions.current[nextTab];
    });
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
            <Image src="/coco-seed.png" alt="Coco, waiting quietly while you work" width={120} height={120} />
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
        <div className={styles.syncOnly}><SyncStatusBar /></div>

        <main ref={mainRef} className={styles.main} id="main-content">
          <h1 className={styles.srOnly}>Today with Coco</h1>
          {tab === 'home' ? (
            <HomeScreen
              date={date}
              recommended={recommended}
              completedCount={completedCount}
              foodCount={foodEntries.length}
              progress={progress}
              onPlan={() => setPlanOpen(true)}
              onStart={() => void beginFocus()}
              onToday={() => selectTab('today')}
              onJourney={() => selectTab('journey')}
              onChat={() => setChatOpen(true)}
              onNotNow={() => {
                setNotice('Coco will keep it quiet. Reopen it from Today whenever you are ready.');
                selectTab('today');
              }}
            />
          ) : null}
          {tab === 'today' ? (
            <TodayScreen
              date={date}
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
              onPlan={() => setPlanOpen(true)}
              onChat={() => setChatOpen(true)}
            />
          ) : null}
          {tab === 'health' ? (
            <HealthScreen
              entries={foodEntries}
              kcalProgress={kcalProgress}
              macros={macros}
              locale={locale}
              weights={weights}
              weightTrend={weightTrend}
              weightChange={weightChange}
              workouts={workouts}
              activeWorkout={activeWorkout}
              guidance={guidance}
              guidanceStale={guidanceStale}
              dayType={dayType}
              onToggleWorkout={() => void toggleWorkout()}
              onLogWeight={() => setWeightOpen(true)}
              onOpenTargets={() => setTargetsOpen(true)}
              onOpenTrend={() => setTrendOpen(true)}
              onOpenExpenditure={() => setExpenditureOpen(true)}
              onChat={() => setChatOpen(true)}
            />
          ) : null}
          {tab === 'journey' ? (
            <JourneyScreen
              goals={goals}
              tasks={tasks}
              routines={allRoutines}
              routineCompletions={routineCompletions}
              workouts={workouts}
              foodEntries={foodEntries}
              progress={progress}
              faithEnabled={preferences?.faith_enabled ?? false}
              scripture={scripture}
              onAddGoal={() => setGoalOpen(true)}
              onFinishGoal={(goal) => void finishGoal(goal)}
              onOpenSettings={() => setSettingsOpen(true)}
              onChat={() => setChatOpen(true)}
            />
          ) : null}
        </main>

        <nav className={styles.tabbar} aria-label="Primary navigation">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} type="button" aria-current={tab === id ? 'page' : undefined} onClick={() => selectTab(id)}>
              <Icon size={23} weight={tab === id ? 'fill' : 'regular'} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

      </div>

      {notice ? <div className={styles.toast} role="status">{notice}</div> : null}

      <ActionDialog open={planOpen} onClose={() => setPlanOpen(false)} title="Choose one next action" description="Coco can suggest, but only you can confirm what enters your day.">
        <form className={styles.formStack} onSubmit={choosePlan}>
          <label htmlFor="plan-action">What would make today feel meaningfully lighter?</label>
          <textarea id="plan-action" value={planLabel} onChange={(event) => setPlanLabel(event.target.value)} rows={3} autoFocus />
          <button className={styles.primaryButton} type="submit">Confirm this action</button>
        </form>
      </ActionDialog>

      <ActionDialog open={addOpen} onClose={() => setAddOpen(false)} title="Add to Today">
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

      <ActionDialog open={goalOpen} onClose={() => setGoalOpen(false)} title="Create a goal" description="Coco may help shape it later. Nothing is committed until you save it.">
        <form className={styles.formStack} onSubmit={addGoal}>
          <label htmlFor="goal-title">What are you working toward?</label>
          <input id="goal-title" value={goalTitle} onChange={(event) => setGoalTitle(event.target.value)} autoFocus />
          <button className={styles.primaryButton} type="submit">Confirm goal</button>
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

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onTheme={setTheme}
        faithEnabled={preferences?.faith_enabled ?? false}
        onFaith={(enabled) => void toggleFaith(enabled)}
        email={email}
      />

      <CocoChat open={chatOpen} onClose={() => setChatOpen(false)} userId={userId} logicalDate={logicalDate} recommended={recommended} />
    </div>
  );
}

function CompanionButton({ onClick }: { onClick: () => void }) {
  return (
    <button className={styles.companionButton} type="button" onClick={onClick} aria-label="Talk to Coco">
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
      </div>
      <CompanionButton onClick={onChat} />
    </header>
  );
}

function CocoHabitat({ progress, onJourney }: { progress: { totalPoints: number; stageKey: string }; onJourney: () => void }) {
  const threshold = progress.totalPoints < 100 ? 100 : progress.totalPoints < 300 ? 300 : progress.totalPoints < 700 ? 700 : 1500;
  const percent = Math.min(100, Math.max(4, progress.totalPoints / threshold * 100));
  return (
    <section className={styles.habitat} aria-label={`Coco is at the ${stageLabel(progress.stageKey)} stage with ${progress.totalPoints} growth points`}>
      <div className={styles.atmosphere} aria-hidden="true" />
      <Image className={styles.cocoImage} src="/coco-seed.png" alt="Coco, a hopeful seed companion with a gentle expression" width={196} height={196} priority />
      <button className={styles.stageProgress} type="button" onClick={onJourney}>
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
  onPlan,
  onStart,
  onToday,
  onJourney,
  onChat,
  onNotNow,
}: {
  date: Date;
  recommended: string | null;
  completedCount: number;
  foodCount: number;
  progress: { totalPoints: number; stageKey: string };
  onPlan: () => void;
  onStart: () => void;
  onToday: () => void;
  onJourney: () => void;
  onChat: () => void;
  onNotNow: () => void;
}) {
  return (
    <div className={`${styles.screen} ${styles.homeScreen}`}>
      <header className={styles.homeHeader}>
        <p className={styles.eyebrow}>{titleDate(date)}</p>
        <h2>{greeting(date)}</h2>
        <p>{recommended ? 'One thing matters now. Coco is holding the rest.' : 'Nothing is planned yet. That is allowed.'}</p>
      </header>
      <CocoHabitat progress={progress} onJourney={onJourney} />
      <section className={styles.actionCard}>
        <div className={styles.missionEyebrow}>
          <p>{recommended ? 'Next on your list' : 'Nothing planned'}</p>
          {recommended ? <span>confirmed</span> : null}
        </div>
        <h3>{recommended ?? 'Want to put one thing on today?'}</h3>
        <p className={styles.muted}>{recommended ? 'Coco is reminding you, not changing your plan.' : 'Coco will not fill your day without you.'}</p>
        <div className={styles.buttonRow}>
          <button className={styles.primaryButton} type="button" onClick={recommended ? onStart : onPlan}>
            {recommended ? 'Start' : 'Plan today'}
          </button>
          <button className={styles.secondaryButton} type="button" onClick={recommended ? onToday : onChat}>
            {recommended ? 'Change' : 'Ask Coco'}
          </button>
          {recommended ? <button className={styles.tertiaryButton} type="button" onClick={onNotNow}>Not now</button> : null}
        </div>
      </section>
      <section className={styles.confirmedLedger} aria-label="Confirmed activity today">
        <p className={styles.eyebrow}>Confirmed today</p>
        {completedCount > 0 ? <div><CheckCircle size={19} weight="fill" /><span>{completedCount} {completedCount === 1 ? 'action' : 'actions'} completed</span><small>today</small></div> : null}
        {foodCount > 0 ? <div><ForkKnife size={19} /><span>{foodCount} {foodCount === 1 ? 'item' : 'items'} logged</span><small>today</small></div> : null}
        {completedCount === 0 && foodCount === 0 ? <p className={styles.ledgerEmpty}>Nothing confirmed yet today. Coco only counts what you confirm.</p> : null}
      </section>
      <button className={styles.talkButton} type="button" onClick={onChat}><ChatCircleDots size={19} /> Talk to Coco</button>
    </div>
  );
}

function TodayScreen({
  date,
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
  date: Date;
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
    <div className={`${styles.screen} ${styles.listScreen}`}>
      <AppScreenHeader title="Today" subtitle={`${titleDate(date)} · ${confirmed} of ${Math.max(total, confirmed)} confirmed`} onChat={onChat} />
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
        <h3>{plan ? `A 25-minute session on “${plan.selected_label_snapshot}” is the one Coco keeps suggesting.` : 'Choose one action and Coco can hold a quiet timer for it.'}</h3>
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
  weights,
  weightTrend,
  weightChange,
  workouts,
  activeWorkout,
  guidance,
  guidanceStale,
  dayType,
  onToggleWorkout,
  onLogWeight,
  onOpenTargets,
  onOpenTrend,
  onOpenExpenditure,
  onChat,
}: {
  entries: ReturnType<typeof useLiveFoodEntries>;
  kcalProgress: NutritionProgress;
  macros: MacroProgress[];
  locale: Locale;
  weights: LocalWeightLog[];
  weightTrend: ReturnType<typeof computeWeightTrend>;
  weightChange: ReturnType<typeof trendChange>;
  workouts: LocalWorkout[];
  activeWorkout: LocalWorkout | null;
  guidance: GuidanceSnapshot | null;
  guidanceStale: boolean;
  dayType: string;
  onToggleWorkout: () => void;
  onLogWeight: () => void;
  onOpenTargets: () => void;
  onOpenTrend: () => void;
  onOpenExpenditure: () => void;
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
      <AppScreenHeader title="Health" subtitle="Numbers come from your records, not from Coco." onChat={onChat} />

      <section className={styles.healthSection}>
        <p className={styles.eyebrow}>Food · today</p>
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
                  <div className={styles.dataRow} key={entry.id}>
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
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
        <div className={styles.healthPrimaryActions}>
          <Link href="/app/foods/search"><MagnifyingGlass size={18} weight="bold" /> Log food</Link>
          <Link href="/app/foods/barcode" aria-label="Scan barcode"><Barcode size={21} /></Link>
        </div>
      </section>

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
          <div><button type="button" onClick={onToggleWorkout}>{activeWorkout ? 'Finish workout' : 'Start workout'}</button><span className={styles.secondaryActionLabel}>{workouts.length} logged</span></div>
        </div>
      </section>

      <p className={styles.safetyNote}>Health progress never earns rewards for eating less, losing weight, or training through pain.</p>
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
      description="Generated in code from your confirmed records. Coco never sets these numbers."
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
                  asking Coco.
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

function JourneyScreen({ goals, tasks, routines, routineCompletions, workouts, foodEntries, progress, faithEnabled, scripture, onAddGoal, onFinishGoal, onOpenSettings, onChat }: {
  goals: LocalGoal[];
  tasks: LocalTask[];
  routines: LocalRoutine[];
  routineCompletions: LocalRoutineCompletion[];
  workouts: LocalWorkout[];
  foodEntries: ReturnType<typeof useLiveFoodEntries>;
  progress: { totalPoints: number; stageKey: string; acceptedEventKeys: string[] };
  faithEnabled: boolean;
  scripture: LocalScripturePassage[];
  onAddGoal: () => void;
  onFinishGoal: (goal: LocalGoal) => void;
  onOpenSettings: () => void;
  onChat: () => void;
}) {
  const nextThreshold = progress.totalPoints < 100 ? 100 : progress.totalPoints < 300 ? 300 : progress.totalPoints < 700 ? 700 : 1500;
  const stagePercent = Math.min(100, progress.totalPoints / nextThreshold * 100);
  const trace = progress.acceptedEventKeys.slice(-5).reverse();
  const eventLabels = new Map<string, string>([
    ...tasks.map((task) => [task.id, task.title] as const),
    ...routines.map((routine) => [routine.id, routine.title] as const),
    ...routineCompletions.map((completion) => [completion.id, routines.find((routine) => routine.id === completion.routine_id)?.title ?? 'Routine completed'] as const),
    ...goals.map((goal) => [goal.id, goal.title] as const),
    ...workouts.map((workout) => [workout.id, 'Completed workout'] as const),
    ...foodEntries.map((entry) => [entry.id, entry.food_name_snapshot] as const),
  ]);
  return (
    <div className={`${styles.screen} ${styles.listScreen}`}>
      <AppScreenHeader title="Journey" subtitle={`${progress.totalPoints} points from confirmed actions`} onChat={onChat} />
      <section className={styles.stageCard}>
        <div className={styles.stageTitle}><Tree size={17} weight="fill" /><strong>{stageLabel(progress.stageKey)}</strong></div>
        <p>{progress.totalPoints} of {nextThreshold} points toward the next stage · {Math.round(stagePercent)}%</p>
        <div className={styles.progressTrack} aria-label={`${progress.totalPoints} of ${nextThreshold} points`}><span style={{ width: `${stagePercent}%` }} /></div>
        <div className={styles.currentStageArt}><Image src="/coco-seed.png" alt={`Coco at the ${stageLabel(progress.stageKey)} stage`} width={104} height={104} /><span>{stageLabel(progress.stageKey)}</span></div>
        <details className={styles.stageDetails}>
          <summary>What each stage means</summary>
          <p>Seed begins at 0 points, Sprouting seed at 100, Sapling at 300, Young tree at 700, and Flourishing tree at 1,500.</p>
        </details>
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
      <section className={styles.journeySection}>
        <div className={styles.compactSectionTitle}><p className={styles.eyebrow}>Goals you confirmed</p><button type="button" onClick={onAddGoal}><Plus size={17} /> Add</button></div>
        <div className={styles.goalList}>
          {goals.length === 0 ? <EmptyLine text="No goals yet. Start with something that matters to you." /> : goals.map((goal) => (
            <button key={goal.id} className={styles.checkRow} type="button" onClick={() => onFinishGoal(goal)} aria-pressed={goal.status === 'completed'}>
              {goal.status === 'completed' ? <CheckCircle size={23} weight="fill" /> : <Target size={23} />}
              <span className={goal.status === 'completed' ? styles.done : ''}>{goal.title}</span>
              <span className={styles.rowMeta}>{goal.kind}</span>
            </button>
          ))}
        </div>
      </section>
      <section className={styles.presenceSection}>
        <p className={styles.eyebrow}>Presence</p>
        <p>{progress.acceptedEventKeys.length} confirmed {progress.acceptedEventKeys.length === 1 ? 'action' : 'actions'} recorded. Missed days never take progress away.</p>
      </section>
      {faithEnabled ? (
        <section className={styles.faithCard}>
          <p className={styles.eyebrow}>Faith mode · reviewed Scripture</p>
          {scripture[0] ? <><blockquote>“{scripture[0].text}”</blockquote><cite>{scripture[0].reference} · World English Bible</cite></> : <p>Reviewed passages will appear here when available.</p>}
          <p className={styles.muted}>Coco can support reflection, but is not a theological authority.</p>
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

function SettingsDialog({ open, onClose, theme, onTheme, faithEnabled, onFaith, email }: {
  open: boolean;
  onClose: () => void;
  theme: Theme;
  onTheme: (theme: Theme) => void;
  faithEnabled: boolean;
  onFaith: (enabled: boolean) => void;
  email: string;
}) {
  return (
    <ActionDialog open={open} onClose={onClose} title="Settings">
      <div className={styles.settingsStack}>
        <section>
          <p className={styles.eyebrow}>Appearance</p>
          <div className={styles.themeChoices}>
            <button type="button" aria-pressed={theme === 'system'} suppressHydrationWarning onClick={() => onTheme('system')}><Sparkle size={19} /> System</button>
            <button type="button" aria-pressed={theme === 'day'} suppressHydrationWarning onClick={() => onTheme('day')}><Sun size={19} /> Day</button>
            <button type="button" aria-pressed={theme === 'night'} suppressHydrationWarning onClick={() => onTheme('night')}><Moon size={19} /> Night</button>
          </div>
        </section>
        <label className={styles.toggleRow}>
          <span><strong>Faith mode</strong><small>Show reviewed Scripture and faith reflections in Journey.</small></span>
          <input type="checkbox" checked={faithEnabled} onChange={(event) => onFaith(event.target.checked)} />
        </label>
        <section className={styles.privacyCard}>
          <UserCircle size={25} />
          <div><strong>{email}</strong><p>Diary, venting, and prayer entries stay on this device unless you explicitly choose “Remember this.”</p></div>
        </section>
        <Link className={styles.settingsLink} href="/about">Food data and privacy notes <CaretRight size={17} /></Link>
        <SignOutButton />
      </div>
    </ActionDialog>
  );
}

function CocoChat({ open, onClose, userId, logicalDate, recommended }: {
  open: boolean;
  onClose: () => void;
  userId: string;
  logicalDate: string;
  recommended: string | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LocalCocoMessage[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [rememberedMessageId, setRememberedMessageId] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open || conversationId) return;
    void createLocalCocoConversation({ userId, title: `Coco · ${logicalDate}` }).then((conversation) => {
      setConversationId(conversation.id);
      setMessages([]);
    });
  }, [conversationId, logicalDate, open, userId]);

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
      // The deterministic reply keeps Coco useful offline.
    }
    const coco = await appendLocalCocoMessage({ userId, conversationId, role: 'assistant', content: reply, responseSource: source });
    setMessages((current) => [...current, coco]);
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
    <dialog ref={ref} className={styles.chatDialog} onClose={onClose} aria-labelledby="coco-chat-title">
      <header className={styles.chatHeader}>
        <Image src="/coco-seed.png" alt="" width={48} height={48} />
        <div><h2 id="coco-chat-title">Coco</h2><p>tone · balanced · adapts to the moment</p></div>
        <button className={styles.chatHistoryButton} type="button" aria-label="Conversation history"><Clock size={19} /></button>
        <button className={styles.chatCloseButton} type="button" onClick={onClose} aria-label="Close Coco chat"><X size={20} /></button>
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
        <label className={styles.srOnly} htmlFor="coco-message">Message Coco</label>
        <textarea id="coco-message" rows={1} value={text} onChange={(event) => setText(event.target.value)} placeholder="Say what’s actually going on…" />
        <button type="submit" disabled={!text.trim() || busy} aria-label="Send message"><PaperPlaneTilt size={21} weight="fill" /></button>
      </form>
      <p className={styles.chatPrivacy}>Coco can propose actions. You confirm every write.</p>
    </dialog>
  );
}
