export const PACKAGE = '@kayamo/core';

export {
  actualMinutesBetween,
  busiestWeekday,
  deadlineRisk,
  estimateCapacityFromHistory,
  forgottenItems,
  goalPlausibility,
  learnedFocusMinutes,
  proposeAdaptivePatterns,
  type AdaptivePattern,
  type CapacityHistoryDay,
  type DeadlineRisk,
  type FocusDurationSample,
  type ForgottenItem,
  type LearnedDuration,
} from './adaptive';
export {
  COMPLEXITY_LABELS,
  COMPLEXITY_LEVELS,
  STORY_KINDS,
  buildPersonalArchive,
  chapterCloseReady,
  chapterCloseSummary,
  evidenceBankEntries,
  isMusLite,
  professionalForArea,
  proposeStoryFromGoal,
  renderArchiveMarkdown,
  renderEvidenceMarkdown,
  type ArchiveGoal,
  type ArchiveStoryEntry,
  type ChapterCloseInput,
  type ComplexityLevel,
  type PersonalArchive,
  type StoryDraft,
  type StoryKind,
} from './archive';
export {
  buildDailyLoopState,
  dailyLoopPhase,
  focusRemainingSeconds,
  focusSessionState,
  isWithinQuietHours,
  notificationDelivery,
  type DailyLoopPhase,
  type DailyLoopState,
  type FocusSessionClock,
  type FocusSessionState,
  type NotificationDelivery,
} from './daily-loop';

export {
  COMPANION_EVENT_POINTS,
  COMPANION_EVENT_TYPES,
  COMPANION_STAGES,
  companionEventKey,
  companionStageForPoints,
  earnedAchievementKeys,
  reduceCompanionEvents,
  type AchievementDefinition,
  type AchievementRule,
  type CompanionEventType,
  type CompanionLedgerEvent,
  type CompanionProgression,
} from './companion-progression';
export {
  computeWeightTrend,
  trendChange,
  type WeightObservation,
  type WeightTrendPoint,
} from './trend';
export {
  estimateTdee,
  restingEnergyKcal,
  type DailyIntake,
  type ExpenditureMethod,
  type TdeeEstimate,
  type TdeeEstimateInput,
  type TdeeProfile,
} from './tdee';
export {
  generateNutritionTarget,
  type NutritionDayType,
  type NutritionGoal,
  type NutritionSex,
  type NutritionTarget,
  type TargetInput,
} from './targets';
export {
  dayTypeForToday,
  macroProgress,
  nutritionProgress,
  targetForDayType,
  type ExpenditureView,
  type GuidanceProfileState,
  type GuidanceSnapshot,
  type MacroProgress,
  type NutritionProgress,
  type NutritionTargetView,
} from './guidance';
export {
  analyzeExerciseProgression,
  calculatePlatesPerSide,
  compareVolumeToUserBand,
  estimateSetE1rm,
  isHardSet,
  restTimerDeadline,
  weeklyHardSetsByMuscle,
  type E1rmEstimate,
  type ExerciseSessionPerformance,
  type MuscleVolumeBand,
  type ProgressionAnalysis,
  type TrainingSetPerformance,
} from './progression';
export {
  LIFE_AREA_LABELS,
  LIFE_AREAS,
  goalFitsLifeArea,
  isLifeArea,
  listedLifeAreas,
  suggestLifeArea,
  type LifeArea,
} from './identity';
export {
  DAY_CAPACITIES,
  DAY_CAPACITY_LABELS,
  DAY_INTENT_LABELS,
  DAY_INTENTS,
  PLAN_MODE_LABELS,
  PLAN_MODES,
  daysBetweenLogical,
  proposeDayPlan,
  proposedPlanMode,
  shiftLogicalDateUtc,
  suggestedPlanLimit,
  weeklyResetDue,
  type DayCapacity,
  type DayIntent,
  type DayPlanCandidate,
  type DayPlanItem,
  type DayPlanProposal,
  type PlanMode,
} from './day-plan';
export {
  ACTION_LEVEL_LABELS,
  ACTION_LEVELS,
  INTEGRATION_CATALOG,
  INTEGRATION_IDS,
  adjustedPlanLimit,
  busyHoursFromBlocks,
  hoursBetweenClock,
  integrationStatuses,
  resolveActionLevel,
  voiceCaptureAvailability,
  type ActionLevel,
  type IntegrationAvailability,
  type IntegrationDescriptor,
  type IntegrationId,
  type IntegrationStatus,
} from './integrations';
export {
  WORKOUT_VERSION_LABELS,
  WORKOUT_VERSIONS,
  bestE1rmFromSets,
  proposeExerciseLoad,
  proposeFromSessions,
  scaleWorkoutSetCount,
  selectWorkoutExercises,
  sessionVolumeKg,
  workoutVersionForCapacity,
  type LastWorkingSet,
  type ProposedExercisePlan,
  type WorkoutVersion,
} from './workout-proposal';

export type DailyTaskContext = {
  id: string;
  title: string;
  completedAt: string | null;
  dueAt: string | null;
  sortOrder: number;
};

export type DailyRoutineContext = {
  id: string;
  title: string;
  completed: boolean;
  sortOrder: number;
};

export type DailyContextInput = {
  logicalDate: string;
  now: string;
  tasks: DailyTaskContext[];
  routines: DailyRoutineContext[];
  foodEntries: number;
  workouts: number;
};

export type RecommendedNextAction =
  | { kind: 'task'; recordId: string; title: string; reason: 'overdue' | 'planned' }
  | { kind: 'routine'; recordId: string; title: string; reason: 'scheduled' }
  | { kind: 'food'; recordId: null; title: string; reason: 'not_logged' }
  | { kind: 'check_in'; recordId: null; title: string; reason: 'day_clear' };

export type DailyContextSummary = {
  logicalDate: string;
  tasksPlanned: number;
  tasksCompleted: number;
  routinesPlanned: number;
  routinesCompleted: number;
  foodEntries: number;
  workouts: number;
  confirmedActions: number;
  acknowledgement: string;
  nextAction: RecommendedNextAction;
};

function activityPhrase(
  count: number,
  verb: string,
  singular: string,
  plural = `${singular}s`,
): string | null {
  if (count === 0) return null;
  return `${verb} ${count} ${count === 1 ? singular : plural}`;
}

function isOverdue(dueAt: string | null, now: string): boolean {
  if (dueAt === null) return false;
  const dueTime = Date.parse(dueAt);
  const nowTime = Date.parse(now);
  return Number.isFinite(dueTime) && Number.isFinite(nowTime) && dueTime < nowTime;
}

/**
 * Offline-safe context for Coco. It summarizes only confirmed records and
 * picks one action with stable ordering; it never creates or changes data.
 */
export function buildDailyContext(input: DailyContextInput): DailyContextSummary {
  const incompleteTasks = input.tasks
    .filter((task) => !task.completedAt)
    .sort((a, b) => {
      const aOverdue = isOverdue(a.dueAt, input.now);
      const bOverdue = isOverdue(b.dueAt, input.now);
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.id.localeCompare(b.id);
    });
  const incompleteRoutines = input.routines
    .filter((routine) => !routine.completed)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));

  const firstTask = incompleteTasks[0];
  const firstRoutine = incompleteRoutines[0];
  let nextAction: RecommendedNextAction;
  if (firstTask) {
    nextAction = {
      kind: 'task',
      recordId: firstTask.id,
      title: firstTask.title,
      reason: isOverdue(firstTask.dueAt, input.now) ? 'overdue' : 'planned',
    };
  } else if (firstRoutine) {
    nextAction = {
      kind: 'routine',
      recordId: firstRoutine.id,
      title: firstRoutine.title,
      reason: 'scheduled',
    };
  } else if (input.foodEntries === 0) {
    nextAction = {
      kind: 'food',
      recordId: null,
      title: 'Log your first meal',
      reason: 'not_logged',
    };
  } else {
    nextAction = {
      kind: 'check_in',
      recordId: null,
      title: 'Choose what would help next',
      reason: 'day_clear',
    };
  }

  const tasksCompleted = input.tasks.filter((task) => task.completedAt).length;
  const routinesCompleted = input.routines.filter((routine) => routine.completed).length;
  const confirmedActions =
    tasksCompleted + routinesCompleted + input.foodEntries + input.workouts;
  const activity = [
    activityPhrase(tasksCompleted, 'completed', 'task'),
    activityPhrase(routinesCompleted, 'kept', 'routine'),
    activityPhrase(input.foodEntries, 'logged', 'meal'),
    activityPhrase(input.workouts, 'finished', 'workout'),
  ].filter((part): part is string => part !== null);

  return {
    logicalDate: input.logicalDate,
    tasksPlanned: input.tasks.length,
    tasksCompleted,
    routinesPlanned: input.routines.length,
    routinesCompleted,
    foodEntries: input.foodEntries,
    workouts: input.workouts,
    confirmedActions,
    acknowledgement:
      activity.length > 0
        ? `You ${activity.join(', ')}. That effort counts.`
        : 'Nothing is logged yet. We can start with one small step.',
    nextAction,
  };
}
