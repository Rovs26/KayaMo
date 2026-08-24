import Dexie, { type Table } from 'dexie';
import type { GuidanceSnapshot } from '@kayamo/core';
import type {
  AgentMemory,
  CocoConversation,
  CocoMessage,
  DailyLoopPreference,
  DailyPlan,
  Food,
  AchievementDefinitionRow,
  CompanionEvent,
  CompanionState,
  CosmeticDefinition,
  CosmeticUnlock,
  EvolutionStage,
  FutureSelf,
  GoalMilestone,
  Habit,
  HabitCompletion,
  InboxItem,
  Compass,
  PersonalRule,
  Exercise,
  FoodEntry,
  FocusSession,
  MealTemplate,
  Routine,
  RoutineCompletion,
  Serving,
  ScripturePassage,
  Task,
  UserAchievement,
  UserGoal,
  WeightLog,
  Workout,
  WorkoutPlan,
  WorkoutPlanExercise,
  WorkoutSet,
} from '@kayamo/db';

export type LocalFoodEntry = FoodEntry;
export type LocalWeightLog = WeightLog;
export type LocalWorkout = Workout;
export type LocalWorkoutSet = WorkoutSet;
export type LocalExercise = Exercise;
export type LocalWorkoutPlan = WorkoutPlan;
export type LocalWorkoutPlanExercise = WorkoutPlanExercise;
export type LocalFood = Food;
export type LocalServing = Serving;
export type LocalMealTemplate = MealTemplate;
export type LocalTask = Task;
export type LocalRoutine = Routine;
export type LocalRoutineCompletion = RoutineCompletion;
export type LocalAgentMemory = AgentMemory;
export type LocalCocoConversation = CocoConversation;
export type LocalCocoMessage = CocoMessage;
export type LocalDailyPlan = DailyPlan;
export type LocalFocusSession = FocusSession;
export type LocalDailyLoopPreference = DailyLoopPreference;
export type LocalScripturePassage = ScripturePassage;
export type LocalGoal = UserGoal;
export type LocalGoalMilestone = GoalMilestone;
export type LocalFutureSelf = FutureSelf;
export type LocalCompass = Compass;
export type LocalInboxItem = InboxItem;
export type LocalPersonalRule = PersonalRule;
export type LocalHabit = Habit;
export type LocalHabitCompletion = HabitCompletion;
export type LocalCompanionEvent = CompanionEvent;
export type LocalCompanionState = CompanionState;
export type LocalAchievementDefinition = AchievementDefinitionRow;
export type LocalUserAchievement = UserAchievement;
export type LocalEvolutionStage = EvolutionStage;
export type LocalCosmeticDefinition = CosmeticDefinition;
export type LocalCosmeticUnlock = CosmeticUnlock;

export type LocalJournalEntry = {
  id: string;
  user_id: string;
  kind: 'diary' | 'vent' | 'prayer' | 'reflection' | 'gratitude';
  content: string;
  created_at: string;
  updated_at: string;
};

export type LocalBusyBlock = {
  id: string;
  user_id: string;
  title: string;
  logical_date: string;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type LocalActionGrants = {
  user_id: string;
  levels: Record<string, string>;
  updated_at: string;
};

export type SyncableTable =
  | 'food_entries'
  | 'weight_logs'
  | 'workouts'
  | 'workout_sets'
  | 'exercises'
  | 'workout_plans'
  | 'workout_plan_exercises'
  | 'meal_templates'
  | 'tasks'
  | 'routines'
  | 'routine_completions'
  | 'agent_memory'
  | 'coco_conversations'
  | 'coco_messages'
  | 'goals'
  | 'goal_milestones'
  | 'habits'
  | 'habit_completions'
  | 'companion_events'
  | 'daily_plans'
  | 'focus_sessions'
  | 'daily_loop_preferences'
  | 'future_selves'
  | 'compasses'
  | 'inbox_items'
  | 'personal_rules';

export type SyncQueueItem = {
  id: string;
  table: SyncableTable;
  entityId: string;
  payload: Record<string, unknown>;
  attempt: number;
  nextAttemptAt: number;
  lastError: string | null;
};

export type LocalRestTimer = {
  workout_id: string;
  user_id: string;
  started_at: string;
  ends_at: string;
};

/**
 * Last known guidance from the server, kept so Health can still show a target
 * offline. A read cache only — it is never queued for sync.
 */
export type LocalGuidanceSnapshot = {
  user_id: string;
  snapshot: GuidanceSnapshot;
  cached_at: string;
};

export class KayaMoDB extends Dexie {
  food_entries!: Table<LocalFoodEntry, string>;
  weight_logs!: Table<LocalWeightLog, string>;
  workouts!: Table<LocalWorkout, string>;
  workout_sets!: Table<LocalWorkoutSet, string>;
  exercises!: Table<LocalExercise, string>;
  workout_plans!: Table<LocalWorkoutPlan, string>;
  workout_plan_exercises!: Table<LocalWorkoutPlanExercise, string>;
  rest_timers!: Table<LocalRestTimer, string>;
  foods!: Table<LocalFood, string>;
  servings!: Table<LocalServing, string>;
  meal_templates!: Table<LocalMealTemplate, string>;
  tasks!: Table<LocalTask, string>;
  routines!: Table<LocalRoutine, string>;
  routine_completions!: Table<LocalRoutineCompletion, string>;
  agent_memory!: Table<LocalAgentMemory, string>;
  coco_conversations!: Table<LocalCocoConversation, string>;
  coco_messages!: Table<LocalCocoMessage, string>;
  goals!: Table<LocalGoal, string>;
  goal_milestones!: Table<LocalGoalMilestone, string>;
  future_selves!: Table<LocalFutureSelf, string>;
  compasses!: Table<LocalCompass, string>;
  inbox_items!: Table<LocalInboxItem, string>;
  personal_rules!: Table<LocalPersonalRule, string>;
  habits!: Table<LocalHabit, string>;
  habit_completions!: Table<LocalHabitCompletion, string>;
  companion_events!: Table<LocalCompanionEvent, string>;
  companion_state!: Table<LocalCompanionState, string>;
  achievement_definitions!: Table<LocalAchievementDefinition, string>;
  user_achievements!: Table<LocalUserAchievement, string>;
  evolution_stages!: Table<LocalEvolutionStage, string>;
  cosmetic_definitions!: Table<LocalCosmeticDefinition, string>;
  cosmetic_unlocks!: Table<LocalCosmeticUnlock, string>;
  daily_plans!: Table<LocalDailyPlan, string>;
  focus_sessions!: Table<LocalFocusSession, string>;
  daily_loop_preferences!: Table<LocalDailyLoopPreference, string>;
  scripture_passages!: Table<LocalScripturePassage, string>;
  local_journal_entries!: Table<LocalJournalEntry, string>;
  busy_blocks!: Table<LocalBusyBlock, string>;
  action_grants!: Table<LocalActionGrants, string>;
  guidance_snapshots!: Table<LocalGuidanceSnapshot, string>;
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
    this.version(2).stores({
      meal_templates: 'id, user_id, updated_at, deleted_at',
    });
    this.version(3).stores({
      tasks: 'id, user_id, scheduled_for, due_at, completed_at, updated_at, deleted_at',
      routines: 'id, user_id, active, updated_at, deleted_at',
      routine_completions:
        'id, user_id, routine_id, logical_date, [routine_id+logical_date], updated_at, deleted_at',
    });
    this.version(4).stores({
      agent_memory: 'id, user_id, kind, updated_at, deleted_at',
      coco_conversations: 'id, user_id, updated_at, deleted_at',
      coco_messages: 'id, user_id, conversation_id, created_at, updated_at, deleted_at',
      local_journal_entries: 'id, user_id, kind, created_at, updated_at',
    });
    this.version(5).stores({
      workouts: 'id, user_id, status, logical_date, started_at, updated_at, deleted_at',
      workout_sets:
        'id, user_id, workout_id, exercise_id, [workout_id+exercise_id], updated_at, deleted_at',
      exercises: 'id, source, created_by, name, updated_at, deleted_at',
      workout_plans: 'id, user_id, active, updated_at, deleted_at',
      workout_plan_exercises:
        'id, user_id, plan_id, day_index, [plan_id+day_index], exercise_order, updated_at, deleted_at',
      rest_timers: 'workout_id, user_id, ends_at',
    });
    this.version(6).stores({
      goals: 'id, user_id, kind, status, target_date, updated_at, deleted_at',
      goal_milestones:
        'id, user_id, goal_id, sort_order, completed_at, updated_at, deleted_at',
      habits: 'id, user_id, goal_id, active, frequency, updated_at, deleted_at',
      habit_completions:
        'id, user_id, habit_id, logical_date, [habit_id+logical_date], updated_at, deleted_at',
      companion_events:
        'id, user_id, event_key, [user_id+event_key], event_type, logical_date, created_at',
      companion_state: 'user_id, stage_key, total_points, updated_at',
      achievement_definitions: 'id, key, metric, event_type, threshold',
      user_achievements: 'id, user_id, achievement_id, earned_at',
      evolution_stages: 'key, minimum_points, sort_order',
      cosmetic_definitions: 'id, key, required_stage_key, active',
      cosmetic_unlocks: 'id, user_id, cosmetic_id, unlocked_at',
    });
    this.version(7).stores({
      daily_plans:
        'id, user_id, logical_date, [user_id+logical_date], updated_at, deleted_at',
      focus_sessions:
        'id, user_id, logical_date, status, daily_plan_id, updated_at, deleted_at',
      daily_loop_preferences: 'user_id, updated_at, deleted_at',
      scripture_passages: 'id, key, reference, *tags, active',
    });
    this.version(8).stores({
      guidance_snapshots: 'user_id, cached_at',
    });
    this.version(9).stores({
      future_selves: 'user_id, updated_at, deleted_at',
      compasses: 'user_id, updated_at, deleted_at',
      inbox_items: 'id, user_id, processed_at, updated_at, deleted_at',
      personal_rules: 'id, user_id, active, updated_at, deleted_at',
    });
    this.version(10).stores({
      busy_blocks: 'id, user_id, logical_date, updated_at, deleted_at',
      action_grants: 'user_id, updated_at',
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
