'use client';

import Image from 'next/image';
import {
  ActionDialog,
  HealthScreen,
  HomeScreen,
  JourneyScreen,
  LifeScreen,
  MusThread,
  remainingClock,
  stageLabel,
  TargetsDialog,
  TodayScreen,
  apiFetch,
  loadMusContextPermissions,
  updateMusContextPermission,
} from '@kayamo/features';
import {
  defaultMusContextPermissions,
  type MusContextPermissionDomain,
} from '@kayamo/ai';
import {
  ArrowLeft,
  ChatCircle,
  Check,
  Heartbeat,
  House,
  Pause,
  Target,
  Tree,
} from '@phosphor-icons/react';
import {
  DAY_CAPACITY_LABELS,
  actualMinutesBetween,
  busiestWeekday,
  buildPersonalArchive,
  countWeekWorkouts,
  evidenceBankEntries,
  proposeStoryFromGoal,
  renderArchiveMarkdown,
  renderEvidenceMarkdown,
  type ArchiveStoryEntry,
  busyHoursFromBlocks,
  computeWeightTrend,
  dayTypeForToday,
  deadlineRisk,
  estimateCapacityFromHistory,
  forgottenItems,
  isMusLite,
  integrationStatuses,
  daysBetweenLogical,
  goalFitsLifeArea,
  learnedFocusMinutes,
  listedLifeAreas,
  macroProgress,
  nutritionProgress,
  proposeAdaptivePatterns,
  suggestedPlanLimit,
  targetForDayType,
  trendChange,
  voiceCaptureAvailability,
  weeklyResetDue,
  workoutVersionForCapacity,
  type AdaptivePattern,
  type ActionLevel,
  type ComplexityLevel,
  type DayCapacity,
  type DayIntent,
  type DayPlanCandidate,
  type GuidanceSnapshot,
  type IntegrationId,
  type LifeArea,
  type PlanMode,
} from '@kayamo/core';
import {
  asLocale,
  shiftLogicalDate,
  type Locale,
} from '@kayamo/food/quick-log';
import {
  cacheGuidanceSnapshot,
  getCachedGuidanceSnapshot,
  logWeight,
  completeLocalEveningReflection,
  completeLocalGoalMilestone,
  completeLocalRoutine,
  createLocalBusyBlock,
  closeLocalGroveChapter,
  createLocalCircle,
  createLocalFocusSession,
  createLocalInboxItem,
  createLocalLifeStoryEntry,
  createLocalPersonalRule,
  createLocalRoutine,
  createLocalTask,
  finishLocalFocusSession,
  getLocalCompass,
  getLocalCompanionProgression,
  getLocalActionGrants,
  getLocalDailyLoopPreferences,
  getLocalDailyPlan,
  getLocalFutureSelf,
  getLocalSocialPrefs,
  instantOnLogicalDate,
  listLocalCompanionEvents,
  listLocalCompanionPresenceDates,
  listLocalDailyPlans,
  listLocalFocusHistory,
  listLocalFocusSessions,
  listLocalGoals,
  listLocalGoalMilestones,
  listLocalInboxItems,
  listLocalLifeStory,
  listLocalBusyBlocks,
  listLocalCircles,
  listLocalOpenTasks,
  listLocalPersonalRules,
  listLocalRoutineCompletions,
  listLocalRoutines,
  listLocalScripture,
  listLocalTasksForDate,
  listLocalWeightLogs,
  listLocalWorkoutHistory,
  logicalDateFromInstant,
  processLocalInboxItem,
  saveLocalActionGrant,
  saveLocalDailyLoopPreferences,
  saveLocalDailyPlan,
  saveLocalSocialPrefs,
  setLocalGoalStatus,
  setLocalTaskCompleted,
  setLocalTaskScheduledFor,
  startLocalFocusSession,
  tombstoneLocalBusyBlock,
  tombstoneLocalCircle,
  updateLocalCircle,
  type LocalBusyBlock,
  type LocalCircle,
  type LocalLifeStoryEntry,
  type LocalCompanionEvent,
  type LocalCompass,
  type LocalDailyLoopPreference,
  type LocalDailyPlan,
  type LocalFocusSession,
  type LocalPersonalRule,
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AddSheet } from './add-sheet';
import { ChapterCloseSheet } from './chapter-close-sheet';
import { CirclesScreen } from './circles-screen';
import { CommitmentSheet } from './commitment-sheet';
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
import styles from '@kayamo/features/app-shell.module.css';

type Tab = 'home' | 'goals' | 'life' | 'grove' | 'mus';
type Theme = 'system' | 'day' | 'night';

const DISMISSED_PATTERNS_KEY = 'kayamo:dismissed-patterns';

function readDismissedPatternKeys(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(DISMISSED_PATTERNS_KEY) ?? '[]') as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((key): key is string => typeof key === 'string')
      : [];
  } catch {
    return [];
  }
}

function persistDismissedPatternKeys(keys: string[]) {
  localStorage.setItem(DISMISSED_PATTERNS_KEY, JSON.stringify(keys));
}

const COMPLEXITY_KEY = 'kayamo:complexity';

function readComplexity(): ComplexityLevel {
  if (typeof window === 'undefined') return 'balanced';
  const saved = localStorage.getItem(COMPLEXITY_KEY);
  return saved === 'simple' || saved === 'advanced' || saved === 'balanced' ? saved : 'balanced';
}

function downloadText(filename: string, contents: string) {
  const mime = filename.endsWith('.json')
    ? 'application/json;charset=utf-8'
    : 'text/markdown;charset=utf-8';
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function asArchiveStory(row: LocalLifeStoryEntry): ArchiveStoryEntry {
  return {
    title: row.title,
    summary: row.summary,
    happenedOn: row.happened_on,
    kind: row.kind,
    professional: row.professional,
  };
}

function speechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const speechWindow = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

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
    const response = await apiFetch(`/api/guidance?date=${logicalDate}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`guidance ${response.status}`);
    const snapshot = (await response.json()) as GuidanceSnapshot;
    await cacheGuidanceSnapshot(userId, snapshot);
    return { snapshot, stale: false };
  } catch {
    const cached = await getCachedGuidanceSnapshot(userId);
    return { snapshot: cached?.snapshot ?? null, stale: Boolean(cached) };
  }
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
  const [musPermissions, setMusPermissions] = useState(defaultMusContextPermissions);
  const [musPermissionsLoaded, setMusPermissionsLoaded] = useState(false);
  const [musPermissionBusy, setMusPermissionBusy] = useState<MusContextPermissionDomain | null>(null);
  const [musPermissionError, setMusPermissionError] = useState<string | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('action') === 'quick-log';
  });
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
  const [goalFlow, setGoalFlow] = useState<{ goalId: string | null; lifeArea?: LifeArea | null } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [theme, setTheme] = useState<Theme>('day');
  const [themeReady, setThemeReady] = useState(false);
  const [guidance, setGuidance] = useState<GuidanceSnapshot | null>(null);
  const [guidanceStale, setGuidanceStale] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [trendOpen, setTrendOpen] = useState(false);
  const [expenditureOpen, setExpenditureOpen] = useState(false);
  const [weightOpen, setWeightOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('action') === 'log-weight';
  });
  const [weightInput, setWeightInput] = useState('');

  const reloadMusPermissions = useCallback(async () => {
    setMusPermissionError(null);
    setMusPermissions(defaultMusContextPermissions());
    setMusPermissionsLoaded(false);
    try {
      const permissions = await loadMusContextPermissions();
      setMusPermissions(permissions);
      setMusPermissionsLoaded(true);
    } catch {
      setMusPermissions(defaultMusContextPermissions());
      setMusPermissionsLoaded(false);
      setMusPermissionError('Mus permissions could not be verified. All categories remain private.');
    }
  }, []);

  const changeMusPermission = useCallback(
    async (domain: MusContextPermissionDomain, allowed: boolean) => {
      setMusPermissionBusy(domain);
      setMusPermissionError(null);
      try {
        const permissions = await updateMusContextPermission(domain, allowed);
        setMusPermissions(permissions);
        setMusPermissionsLoaded(true);
      } catch {
        setMusPermissionError('That permission was not changed. Retry when you are connected.');
      } finally {
        setMusPermissionBusy(null);
      }
    },
    [],
  );

  const openSettings = useCallback(() => {
    setSettingsOpen(true);
    void reloadMusPermissions();
  }, [reloadMusPermissions]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('action')) return;
    params.delete('action');
    const next = `${window.location.pathname}${params.size ? `?${params}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', next);
  }, []);
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
  const [dailyPlans, setDailyPlans] = useState<LocalDailyPlan[]>([]);
  const [focusHistory, setFocusHistory] = useState<LocalFocusSession[]>([]);
  const [companionEvents, setCompanionEvents] = useState<LocalCompanionEvent[]>([]);
  const [personalRules, setPersonalRules] = useState<LocalPersonalRule[]>([]);
  const [dismissedPatternKeys, setDismissedPatternKeys] = useState<string[]>(readDismissedPatternKeys);
  const [yesterdayNote, setYesterdayNote] = useState<string | null>(null);
  const [planSheet, setPlanSheet] = useState<PlanMode | null>(null);
  const [planTargetDate, setPlanTargetDate] = useState<string | null>(null);
  const [commitmentOpen, setCommitmentOpen] = useState(false);
  const [busyBlocks, setBusyBlocks] = useState<LocalBusyBlock[]>([]);
  const [actionGrants, setActionGrants] = useState<Partial<Record<IntegrationId, ActionLevel>>>({});
  const [storyEntries, setStoryEntries] = useState<LocalLifeStoryEntry[]>([]);
  const [chapterOpen, setChapterOpen] = useState(false);
  const [complexity, setComplexity] = useState<ComplexityLevel>(readComplexity);
  const [circles, setCircles] = useState<LocalCircle[]>([]);
  const [socialEnabled, setSocialEnabled] = useState(false);
  const [circlesOpen, setCirclesOpen] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [weeklyResetOpen, setWeeklyResetOpen] = useState(false);
  const [lifeAreaOpen, setLifeAreaOpen] = useState<LifeArea | null>(null);
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
  const weekWorkoutCount = useMemo(
    () =>
      countWeekWorkouts(
        workouts.filter((row) => row.status === 'completed').map((row) => row.logical_date),
        todayLogical,
      ),
    [workouts, todayLogical],
  );
  const homeGoal = goals.find((goal) => goal.status === 'active') ?? null;
  const homeGoalMilestones = homeGoal
    ? goalMilestones.filter((row) => row.goal_id === homeGoal.id)
    : [];
  const lastPresence = presenceDates.at(-1) ?? null;
  const returningAfterDays = lastPresence ? daysBetweenLogical(lastPresence, todayLogical) : 0;
  const resetDue = weeklyResetDue(preferences?.last_weekly_reset_on ?? null, todayLogical);
  const tomorrowLogical = shiftLogicalDate(todayLogical, 1);
  const planDate = planTargetDate ?? logicalDate;
  const planningTomorrow = planDate === tomorrowLogical;
  const planBusyHours = busyHoursFromBlocks(
    busyBlocks
      .filter((row) => row.logical_date === planDate)
      .map((row) => ({ startsAt: row.starts_at, endsAt: row.ends_at })),
  );
  const todayBusyBlocks = busyBlocks.filter((row) => row.logical_date === todayLogical);
  const integrationRows = useMemo(
    () =>
      integrationStatuses(actionGrants, {
        voiceAvailable,
        notificationsEnabled: preferences?.notifications_enabled ?? false,
      }),
    [actionGrants, preferences?.notifications_enabled, voiceAvailable],
  );
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
    const trainedOnView = workouts.some(
      (workout) => workout.logical_date === logicalDate && workout.status !== 'abandoned',
    );
    if (
      !trainedOnView &&
      !items.some((item) => /train|shorter session/i.test(item.title))
    ) {
      const version = workoutVersionForCapacity(plan?.capacity as DayCapacity | null, plan?.day_intent as DayIntent | null);
      items.push({
        id: 'workout:today',
        title: version === 'minimum' ? 'A shorter session' : 'Train today',
        source: 'workout',
        sourceId: 'today',
      });
    }
    return items;
  }, [homeGoalMilestones, inboxItems, logicalDate, plan, tasks, workouts]);
  const tomorrowCandidates = useMemo((): DayPlanCandidate[] => {
    const leftover = openTasks.filter(
      (task) => !task.completed_at && task.scheduled_for !== todayLogical,
    );
    const items: DayPlanCandidate[] = leftover.map((task) => ({
      id: task.id,
      title: task.title,
      source: 'task' as const,
      sourceId: task.id,
    }));
    const nextMilestone = homeGoalMilestones.find((row) => !row.completed_at);
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
  }, [homeGoalMilestones, inboxItems, openTasks, todayLogical]);
  const sheetCandidates = planningTomorrow ? tomorrowCandidates : planCandidates;
  const completedRoutineIds = useMemo(
    () => new Set(routineCompletions.map((row) => row.routine_id)),
    [routineCompletions],
  );

  const insights = useMemo(() => {
    const samples = focusHistory
      .filter((row) => row.status === 'completed' && row.started_at && row.completed_at)
      .map((row) => ({
        plannedMinutes: row.planned_minutes,
        actualMinutes: actualMinutesBetween(row.started_at!, row.completed_at!),
      }));
    const learned = learnedFocusMinutes(samples);
    const completedByDate = new Map<string, number>();
    for (const event of companionEvents) {
      if (event.event_type !== 'task_completed' && event.event_type !== 'routine_completed') continue;
      completedByDate.set(event.logical_date, (completedByDate.get(event.logical_date) ?? 0) + 1);
    }
    const capacityDays = dailyPlans.map((row) => ({
      capacity: (row.capacity as DayCapacity | null) ?? null,
      planned: row.capacity ? suggestedPlanLimit(row.capacity as DayCapacity, 0) : 0,
      completed: completedByDate.get(row.logical_date) ?? 0,
    }));
    const estimatedCapacity = estimateCapacityFromHistory(capacityDays);
    const forgotten = forgottenItems({
      today: todayLogical,
      inbox: inboxItems.map((row) => ({
        id: row.id,
        content: row.content,
        createdAt: row.created_at,
      })),
      openTasks: openTasks.map((row) => ({
        id: row.id,
        title: row.title,
        createdAt: row.created_at,
        scheduledFor: row.scheduled_for,
      })),
    });
    const deadlineNotes = goals
      .filter((goal) => goal.status === 'active' && goal.target_date)
      .map((goal) => {
        const remainingSteps = goalMilestones.filter(
          (row) => row.goal_id === goal.id && !row.completed_at,
        ).length;
        return {
          goalId: goal.id,
          title: goal.title,
          risk: deadlineRisk({
            today: todayLogical,
            targetDate: goal.target_date,
            remainingSteps,
          }),
        };
      })
      .filter((row) => row.risk.level !== 'none');
    const tight =
      deadlineNotes.find((row) => row.risk.level === 'tight' || row.risk.level === 'overdue') ??
      deadlineNotes[0] ??
      null;
    const keptStatements = new Set(personalRules.map((rule) => rule.title));
    const patterns = proposeAdaptivePatterns({
      learned,
      estimatedCapacity,
      forgotten,
      deadline: tight ? { goalTitle: tight.title, risk: tight.risk } : null,
      busiest: busiestWeekday(presenceDates),
      skipKeys: dismissedPatternKeys,
    }).filter((pattern) => !keptStatements.has(pattern.statement));
    const durationNote = learned
      ? `Focus often lands near ${learned.minutes} minutes.`
      : null;
    const capacityNote = estimatedCapacity
      ? `From confirmed days, a ${DAY_CAPACITY_LABELS[estimatedCapacity].toLowerCase()} day is the honest default.`
      : null;
    const week = new Set(
      Array.from({ length: 7 }, (_, index) => shiftLogicalDate(todayLogical, index - 6)),
    );
    const weekPresence = presenceDates.filter((iso) => week.has(iso)).length;
    const recordsParts: string[] = [];
    if (weekPresence > 0) {
      recordsParts.push(`${weekPresence} ${weekPresence === 1 ? 'day' : 'days'} this week`);
    }
    if (learned) recordsParts.push(`focus often near ${learned.minutes} min`);
    if (estimatedCapacity) {
      recordsParts.push(`${DAY_CAPACITY_LABELS[estimatedCapacity].toLowerCase()} as the honest default`);
    }
    return {
      learned,
      estimatedCapacity,
      forgotten,
      deadlineNotes,
      patterns,
      durationNote,
      capacityNote,
      recordsNote: recordsParts.length > 0 ? recordsParts.join(' · ') : null,
    };
  }, [
    companionEvents,
    dailyPlans,
    dismissedPatternKeys,
    focusHistory,
    goalMilestones,
    goals,
    inboxItems,
    openTasks,
    personalRules,
    presenceDates,
    todayLogical,
  ]);

  const refresh = useCallback(async () => {
    const weekday = new Date(`${logicalDate}T12:00:00`).getDay();
    const yesterday = shiftLogicalDate(logicalDate, -1);
    const [nextTasks, nextRoutines, nextAllRoutines, completions, nextPlan, sessions, nextGoals, nextWorkouts, nextWeights, prefs, nextProgress, nextPresence, nextInbox, nextSelf, nextCompass, nextOpen, priorPlan, nextDailyPlans, nextFocusHistory, nextCompanionEvents, nextRules, nextBlocks, nextGrants, nextStory, nextCircles, nextSocial] = await Promise.all([
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
      listLocalDailyPlans(userId),
      listLocalFocusHistory(userId),
      listLocalCompanionEvents(userId),
      listLocalPersonalRules(userId),
      listLocalBusyBlocks(userId),
      getLocalActionGrants(userId),
      listLocalLifeStory(userId),
      listLocalCircles(userId),
      getLocalSocialPrefs(userId),
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
    setDailyPlans(nextDailyPlans);
    setFocusHistory(nextFocusHistory);
    setCompanionEvents(nextCompanionEvents);
    setPersonalRules(nextRules);
    setBusyBlocks(nextBlocks);
    setActionGrants(nextGrants);
    setStoryEntries(nextStory);
    setCircles(nextCircles);
    setSocialEnabled(nextSocial.enabled);
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

  useEffect(() => {
    setVoiceAvailable(voiceCaptureAvailability(Boolean(speechRecognitionCtor())) === 'available');
  }, []);

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
    const response = await apiFetch('/api/profile', {
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

  async function captureVoice() {
    const Ctor = speechRecognitionCtor();
    if (!Ctor || voiceListening) {
      setNotice('Voice capture is not available in this browser. Type it instead.');
      return;
    }
    const recognition = new Ctor();
    recognition.lang = 'en-PH';
    recognition.interimResults = false;
    recognition.continuous = false;
    setVoiceListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? '';
      if (transcript) setInboxDraft((current) => (current ? `${current} ${transcript}` : transcript));
    };
    recognition.onerror = () => {
      setVoiceListening(false);
      setNotice('Voice capture did not catch that. You can type it.');
    };
    recognition.onend = () => setVoiceListening(false);
    try {
      recognition.start();
    } catch {
      setVoiceListening(false);
      setNotice('Voice capture is not available in this browser. Type it instead.');
    }
  }

  async function cycleGrant(id: IntegrationId) {
    const current = integrationRows.find((row) => row.id === id);
    const nextLevel: ActionLevel =
      current?.level === 'act_with_permission' ? 'suggest' : 'act_with_permission';
    await saveLocalActionGrant({ userId, integrationId: id, level: nextLevel });
    setActionGrants(await getLocalActionGrants(userId));
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
    const targetDate = planTargetDate ?? logicalDate;
    const keptTaskIds = new Set<string>();
    let firstTask: LocalTask | null = null;
    for (const item of input.kept) {
      if (item.source === 'inbox') {
        const task = await createLocalTask({ userId, title: item.title, scheduledFor: targetDate });
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
          const task = await createLocalTask({ userId, title: item.title, scheduledFor: targetDate });
          keptTaskIds.add(task.id);
          firstTask ??= task;
        }
      } else if (item.source === 'task') {
        const existing = tasks.find((task) => task.id === item.sourceId) ?? openTasks.find((task) => task.id === item.sourceId);
        if (existing) {
          if (existing.scheduled_for !== targetDate) {
            await setLocalTaskScheduledFor({ id: existing.id, userId, scheduledFor: targetDate });
          }
          keptTaskIds.add(existing.id);
          firstTask ??= existing;
        } else {
          keptTaskIds.add(item.sourceId);
        }
      } else if (item.source === 'workout' || item.source === 'habit') {
        const already = tasks.find(
          (task) =>
            !task.completed_at && task.title.trim().toLowerCase() === item.title.trim().toLowerCase(),
        );
        if (already) {
          keptTaskIds.add(already.id);
          firstTask ??= already;
        } else {
          const task = await createLocalTask({ userId, title: item.title, scheduledFor: targetDate });
          keptTaskIds.add(task.id);
          firstTask ??= task;
        }
      }
    }
    if (input.customLabel) {
      const task = await createLocalTask({ userId, title: input.customLabel, scheduledFor: targetDate });
      keptTaskIds.add(task.id);
      firstTask ??= task;
    }
    if (!planningTomorrow) {
      for (const task of tasks) {
        if (task.completed_at || keptTaskIds.has(task.id) || task.scheduled_for !== targetDate) {
          continue;
        }
        await setLocalTaskScheduledFor({ id: task.id, userId, scheduledFor: null });
      }
    }
    const label = firstTask?.title ?? input.customLabel ?? input.kept[0]?.title ?? null;
    await saveLocalDailyPlan({
      userId,
      logicalDate: targetDate,
      actionKind: firstTask ? 'task' : label ? 'custom' : undefined,
      recordId: firstTask?.id ?? null,
      label,
      completeMorning: targetDate === todayLogical,
      capacity: input.capacity,
      dayIntent: input.intent,
      planMode: input.mode,
    });
    setPlanSheet(null);
    setPlanTargetDate(null);
    setNotice(
      input.mode === 'rescue'
        ? 'Rescued. Only what you kept is on today.'
        : targetDate !== todayLogical
          ? 'Tomorrow is set. Nothing extra was dumped onto today.'
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
      setPlanTargetDate(todayLogical);
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
      plannedMinutes: insights.learned?.minutes ?? 25,
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
    setNotice('Saved. You can confirm tomorrow from this, if you still want it.');
    setPlanTargetDate(tomorrowLogical);
    setPlanSheet('standard');
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
      const response = await apiFetch('/api/guidance', {
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
    if (nextTab !== 'life') setLifeAreaOpen(null);
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
            version={workoutVersionForCapacity(plan?.capacity as DayCapacity | null, plan?.day_intent as DayIntent | null)}
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
            initialLifeArea={goalFlow.lifeArea}
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
            storySourceIds={storyEntries.map((row) => row.source_id).filter((id): id is string => Boolean(id))}
            onAddToStory={async (goal, status) => {
              await createLocalLifeStoryEntry({
                userId,
                draft: proposeStoryFromGoal({
                  id: goal.id,
                  title: goal.title,
                  status,
                  happenedOn: todayLogical,
                  lifeArea: goal.life_area,
                }),
              });
              setNotice(
                status === 'released'
                  ? 'Kept in Life Story as set down. Nothing was taken away.'
                  : 'Kept in Life Story.',
              );
              await refresh();
            }}
          />
        ) : null}
        {planSheet ? (
          <PlanDaySheet
            candidates={sheetCandidates}
            yesterdayNote={planningTomorrow ? (plan?.tomorrow_note ?? yesterdayNote) : yesterdayNote}
            returningAfterDays={planningTomorrow ? 0 : returningAfterDays}
            estimatedCapacity={isMusLite(complexity) ? null : insights.estimatedCapacity}
            learnedNote={isMusLite(complexity) ? null : insights.durationNote}
            busyHours={planBusyHours}
            busyNote={
              planBusyHours > 0
                ? `You already named ${planBusyHours} busy ${planBusyHours === 1 ? 'hour' : 'hours'} on this day. That is a manual commitment, not a calendar sync.`
                : null
            }
            heading={planningTomorrow ? 'Plan Tomorrow' : null}
            initialMode={planSheet}
            onClose={() => {
              setPlanSheet(null);
              setPlanTargetDate(null);
            }}
            onConfirm={(input) => void confirmDayPlan(input)}
          />
        ) : null}
        {commitmentOpen ? (
          <CommitmentSheet
            logicalDate={todayLogical}
            onClose={() => setCommitmentOpen(false)}
            onSave={async (input) => {
              await createLocalBusyBlock({
                userId,
                title: input.title,
                logicalDate: todayLogical,
                startsAt: input.startsAt,
                endsAt: input.endsAt,
              });
              setCommitmentOpen(false);
              setNotice('Saved on this device. Mus did not read a calendar.');
              await refresh();
            }}
          />
        ) : null}
        {chapterOpen ? (
          <ChapterCloseSheet
            onClose={() => setChapterOpen(false)}
            onSave={async (fields) => {
              const chapter = await closeLocalGroveChapter({
                userId,
                closedOn: todayLogical,
                fields,
              });
              await createLocalLifeStoryEntry({
                userId,
                draft: {
                  title: `Chapter closed ${todayLogical}`,
                  summary: chapter.summary,
                  happenedOn: todayLogical,
                  kind: 'chapter',
                  professional: false,
                  sourceId: chapter.id,
                },
              });
              setChapterOpen(false);
              setNotice('Chapter kept in Life Story. The grove did not lose any points.');
              await refresh();
            }}
          />
        ) : null}
        {circlesOpen ? (
          <CirclesScreen
            socialEnabled={socialEnabled}
            circles={circles}
            goals={goals.filter((goal) => goal.status === 'active')}
            weekWorkoutCount={weekWorkoutCount}
            groveStageLabel={stageLabel(progress.stageKey)}
            onSocial={(enabled) => {
              void saveLocalSocialPrefs({ userId, enabled }).then(async () => {
                setSocialEnabled(enabled);
                setNotice(
                  enabled
                    ? 'Social is on for this device. Invites are still not sent.'
                    : 'Social is off. Nothing is published.',
                );
                await refresh();
              });
            }}
            onCreate={async (input) => {
              const row = await createLocalCircle({
                userId,
                name: input.name,
                kind: input.kind,
              });
              await refresh();
              return row.id;
            }}
            onUpdate={async (input) => {
              await updateLocalCircle({
                id: input.id,
                userId,
                facets: input.facets,
                selectedGoalIds: input.selectedGoalIds,
              });
              await refresh();
            }}
            onRemove={async (id) => {
              await tombstoneLocalCircle({ id, userId });
              setNotice('Circle removed on this device. Nothing was published.');
              await refresh();
            }}
            onClose={() => setCirclesOpen(false)}
          />
        ) : null}
        {weeklyResetOpen ? (
          <WeeklyResetSheet
            todayLogical={todayLogical}
            inboxCount={inboxItems.length}
            unfinishedTitles={openTasks
              .filter((task) => task.scheduled_for !== todayLogical)
              .map((task) => task.title)}
            forgottenTitles={insights.forgotten.map((row) => row.title)}
            durationNote={isMusLite(complexity) ? null : insights.durationNote}
            capacityNote={isMusLite(complexity) ? null : insights.capacityNote}
            deadlineNotes={insights.deadlineNotes}
            patterns={insights.patterns}
            goals={goals}
            onGoalStatus={async (id, status) => {
              await setLocalGoalStatus({ id, userId, status, timeZone, dayStartsAt });
              await refresh();
            }}
            onKeepPattern={async (pattern: AdaptivePattern) => {
              await createLocalPersonalRule({
                userId,
                title: pattern.statement,
                musMayRead: false,
              });
              const next = [...new Set([...dismissedPatternKeys, pattern.key])];
              persistDismissedPatternKeys(next);
              setDismissedPatternKeys(next);
              setNotice('Kept as a personal rule. Mus cannot read it unless you allow that later.');
              await refresh();
            }}
            onSkipPattern={(pattern: AdaptivePattern) => {
              const next = [...new Set([...dismissedPatternKeys, pattern.key])];
              persistDismissedPatternKeys(next);
              setDismissedPatternKeys(next);
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
            musPermissions={musPermissions}
            musPermissionsLoaded={musPermissionsLoaded}
            musPermissionBusy={musPermissionBusy}
            musPermissionError={musPermissionError}
            onMusPermission={(domain, allowed) => {
              void changeMusPermission(domain, allowed);
            }}
            onReloadMusPermissions={() => void reloadMusPermissions()}
            integrations={integrationRows}
            onGrant={(id) => void cycleGrant(id)}
            complexity={complexity}
            onComplexity={(level) => {
              localStorage.setItem(COMPLEXITY_KEY, level);
              setComplexity(level);
            }}
            onExportArchive={() => {
              const archive = buildPersonalArchive({
                exportedAt: new Date().toISOString(),
                futureSelf: futureSelf?.statement ?? null,
                compass: compass
                  ? { mattersNow: compass.matters_now, protect: compass.protect }
                  : null,
                grove: { totalPoints: progress.totalPoints, stageKey: progress.stageKey },
                story: storyEntries.map(asArchiveStory),
                goals: goals.map((goal) => ({
                  title: goal.title,
                  status: goal.status,
                  lifeArea: goal.life_area,
                  targetDate: goal.target_date,
                })),
              });
              downloadText(`kayamo-archive-${todayLogical}.md`, renderArchiveMarkdown(archive));
              downloadText(`kayamo-archive-${todayLogical}.json`, JSON.stringify(archive, null, 2));
              setNotice('Archive downloaded on this device. Leaving is allowed.');
            }}
            onExportEvidence={() => {
              const entries = evidenceBankEntries(storyEntries.map(asArchiveStory));
              downloadText(
                `kayamo-evidence-${todayLogical}.md`,
                renderEvidenceMarkdown(entries),
              );
              downloadText(
                `kayamo-evidence-${todayLogical}.json`,
                JSON.stringify(
                  {
                    product: 'KayaMo',
                    companion: 'Mus',
                    note: 'This is not a generated CV.',
                    entries,
                  },
                  null,
                  2,
                ),
              );
              setNotice('Evidence Bank downloaded. This is not a generated CV.');
            }}
            onOpenCircles={() => {
              setSettingsOpen(false);
              setCirclesOpen(true);
            }}
            socialEnabled={socialEnabled}
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
                onPlan={() => {
                  setPlanTargetDate(todayLogical);
                  setPlanSheet('standard');
                }}
                onStart={() => void beginFocus()}
                onGrove={() => selectTab('grove')}
                onOpenGoal={() => setGoalFlow({ goalId: homeGoal?.id ?? null })}
                onChat={() => selectTab('mus')}
                onBecome={() => setFirstRun(true)}
                onWeeklyReset={() => setWeeklyResetOpen(true)}
                futureSelf={futureSelf?.statement ?? null}
                welcomeBack={returningAfterDays >= 2}
                resetDue={resetDue}
                busyBlocks={todayBusyBlocks}
                onAddCommitment={() => setCommitmentOpen(true)}
                onRemoveCommitment={(id) => {
                  void tombstoneLocalBusyBlock({ id, userId }).then(() => refresh());
                }}
                voiceAvailable={voiceAvailable}
                voiceListening={voiceListening}
                onVoice={() => void captureVoice()}
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
                onPlan={() => {
                  setPlanTargetDate(logicalDate);
                  setPlanSheet('restructure');
                }}
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
              onOpenSettings={openSettings}
              onChat={() => selectTab('mus')}
            />
          ) : null}
          {!detail && tab === 'life' ? (
            lifeAreaOpen === 'physical' ? (
            <HealthScreen
              entries={foodEntries}
              kcalProgress={kcalProgress}
              macros={macros}
              fiberG={foodEntries.reduce((sum, entry) => sum + Number(entry.fiber_g), 0)}
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
              physicalGoals={goals.filter(
                (goal) =>
                  goal.status === 'active' &&
                  goalFitsLifeArea(goal.title, goal.life_area, 'physical'),
              )}
              trainingOnPlan={Boolean(
                plan?.selected_label_snapshot &&
                  /train|session|workout/i.test(plan.selected_label_snapshot),
              ) || tasks.some((task) => !task.completed_at && /train|shorter session/i.test(task.title))}
              onBack={() => setLifeAreaOpen(null)}
              onOpenWorkout={openWorkout}
              onLogWeight={() => setWeightOpen(true)}
              onOpenTargets={() => setTargetsOpen(true)}
              onOpenTrend={() => setTrendOpen(true)}
              onOpenExpenditure={() => setExpenditureOpen(true)}
              onLogFood={() => pushDetail({ kind: 'food-search' })}
              onScanBarcode={() => pushDetail({ kind: 'food-barcode' })}
              onEditEntry={setEditingFood}
              onOpenGoal={(goal) => setGoalFlow({ goalId: goal.id })}
              onAddGoal={() => setGoalFlow({ goalId: null, lifeArea: 'physical' })}
              onPlanTraining={() => {
                setPlanTargetDate(todayLogical);
                setPlanSheet('standard');
              }}
              onChat={() => selectTab('mus')}
            />
            ) : (
            <LifeScreen
              areas={listedLifeAreas(compass?.active_areas)}
              physicalSummary={
                kcalProgress.targetKcal === null
                  ? `${foodEntries.length} ${foodEntries.length === 1 ? 'food log' : 'food logs'} today`
                  : `${kcalProgress.eatenKcal} of ${kcalProgress.targetKcal} kcal`
              }
              circleSummary={
                circles.length === 0
                  ? 'Name a group. They see only what you allow.'
                  : `${circles.length} ${circles.length === 1 ? 'Circle' : 'Circles'} on this device`
              }
              onOpenPhysical={() => setLifeAreaOpen('physical')}
              onOpenCircles={() => setCirclesOpen(true)}
              onChat={() => selectTab('mus')}
            />
            )
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
              recordsNote={insights.recordsNote}
              storyEntries={storyEntries}
              musLite={isMusLite(complexity)}
              faithEnabled={preferences?.faith_enabled ?? false}
              scripture={scripture}
              onAddGoal={() => setGoalFlow({ goalId: null })}
              onOpenGoal={(goal) => setGoalFlow({ goalId: goal.id })}
              onOpenSettings={openSettings}
              onWeeklyReset={() => setWeeklyResetOpen(true)}
              onCloseChapter={() => setChapterOpen(true)}
              onChat={() => selectTab('mus')}
            />
          ) : null}
          {!detail && tab === 'mus' ? (
            <MusThread userId={userId} logicalDate={logicalDate} recommended={recommended} />
          ) : null}
        </main>

        {!firstRun && !workoutOpen && !settingsOpen && !goalFlow && !planSheet && !weeklyResetOpen && !commitmentOpen && !chapterOpen && !circlesOpen ? (
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
