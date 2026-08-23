import { NextResponse } from 'next/server';
import {
  createCocoRouter,
  type CocoContextSnapshot,
  type CocoProvider,
} from '@kayamo/ai';
import { createOpenAICocoProvider } from '@kayamo/ai/server';
import {
  getAgentSpendUsd,
  getLatestExpenditureEstimate,
  getCompanionState,
  getProfile,
  getDailyLoopPreferences,
  insertAgentRunTelemetry,
  listActiveRoutines,
  listAchievementDefinitions,
  listAgentMemories,
  listFoodEntriesByLogicalDate,
  listGoals,
  listScriptureByTag,
  listEffectiveNutritionTargets,
  listRoutineCompletionsForDate,
  listTasksForDate,
  listWeightLogsByLogicalDate,
  listWorkoutsByLogicalDate,
  listWorkoutSets,
  listUserAchievements,
} from '@kayamo/db';
import { z } from 'zod';
import { createServerSupabase } from '@/lib/supabase/server';

const requestSchema = z
  .object({
    requestId: z.string().min(1).max(100),
    mode: z.enum(['chat', 'focus', 'workout']),
    message: z.string().trim().min(1).max(5000),
    logicalDate: z.string().date(),
  })
  .strict();

const ALLOWED_ACTIONS = [
  'create_task',
  'complete_task',
  'create_routine',
  'create_goal',
  'start_focus',
  'log_food',
  'remember_this',
] as const;

function nonnegativeEnvNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function configuredProvider(): CocoProvider {
  try {
    return createOpenAICocoProvider();
  } catch {
    return {
      generate: async () => {
        throw new Error('Coco provider is unavailable');
      },
    };
  }
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in to talk with Coco.' }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Coco request.' }, { status: 400 });
  }

  const profile = await getProfile(supabase, user.id);
  const weekday = new Date(`${parsed.data.logicalDate}T12:00:00.000Z`).getUTCDay();
  const [
    tasks,
    routines,
    completions,
    foodEntries,
    weightLogs,
    workouts,
    memories,
    targets,
    expenditure,
    goals,
    companionState,
    achievementDefinitions,
    userAchievements,
    dailyLoopPreferences,
  ] = await Promise.all([
    listTasksForDate(supabase, {
      userId: user.id,
      logicalDate: parsed.data.logicalDate,
    }),
    listActiveRoutines(supabase, { userId: user.id, weekday }),
    listRoutineCompletionsForDate(supabase, {
      userId: user.id,
      logicalDate: parsed.data.logicalDate,
    }),
    listFoodEntriesByLogicalDate(supabase, {
      userId: user.id,
      logicalDate: parsed.data.logicalDate,
    }),
    listWeightLogsByLogicalDate(supabase, {
      userId: user.id,
      logicalDate: parsed.data.logicalDate,
    }),
    listWorkoutsByLogicalDate(supabase, {
      userId: user.id,
      logicalDate: parsed.data.logicalDate,
    }),
    listAgentMemories(supabase, user.id),
    listEffectiveNutritionTargets(supabase, {
      userId: user.id,
      date: parsed.data.logicalDate,
    }),
    getLatestExpenditureEstimate(supabase, {
      userId: user.id,
      throughDate: parsed.data.logicalDate,
    }),
    listGoals(supabase, user.id),
    getCompanionState(supabase, user.id),
    listAchievementDefinitions(supabase),
    listUserAchievements(supabase, user.id),
    getDailyLoopPreferences(supabase, user.id),
  ]);
  const faithEnabled = dailyLoopPreferences?.faith_enabled === true;
  const scripture = await listScriptureByTag(supabase, {
    faithEnabled,
    limit: 10,
  });
  const completedRoutineIds = new Set(completions.map((row) => row.routine_id));
  const workoutSets = await Promise.all(
    workouts.map((workout) => listWorkoutSets(supabase, workout.id)),
  );
  const nextTask = tasks.find((row) => !row.completed_at);
  const nextRoutine = routines.find((row) => !completedRoutineIds.has(row.id));
  const guidanceDayType = workouts.length > 0 ? 'training' : 'rest';
  const nutritionTarget = targets.find((row) => row.day_type === guidanceDayType);
  const loggedKcal = foodEntries.reduce((sum, row) => sum + Number(row.kcal), 0);
  const loggedProteinG = foodEntries.reduce((sum, row) => sum + Number(row.protein_g), 0);

  const context: CocoContextSnapshot = {
    version: 1,
    logicalDate: parsed.data.logicalDate,
    timezone: profile?.timezone ?? 'Asia/Manila',
    recommendedAction: nextTask
      ? { kind: 'task', recordId: nextTask.id, title: nextTask.title }
      : nextRoutine
        ? { kind: 'routine', recordId: nextRoutine.id, title: nextRoutine.title }
        : foodEntries.length === 0
          ? { kind: 'food', recordId: null, title: 'Log your first meal' }
          : { kind: 'check_in', recordId: null, title: 'Choose what would help next' },
    tasks: tasks.map((row) => ({
      id: row.id,
      title: row.title,
      completed: row.completed_at !== null,
      dueAt: row.due_at,
    })),
    routines: routines.map((row) => ({
      id: row.id,
      title: row.title,
      completed: completedRoutineIds.has(row.id),
    })),
    health: {
      mealsLogged: foodEntries.length,
      weightLogged: weightLogs.length > 0,
      workoutStatus:
        workouts.length === 0
          ? 'none'
          : workouts.some((row) => row.ended_at === null)
            ? 'active'
            : 'completed',
      confirmedWorkouts: workouts.map((workout, index) => {
        const sets = workoutSets[index] ?? [];
        const bestE1rmKg = sets.reduce<number | null>((best, set) => {
          const estimates = [set.e1rm_epley_kg, set.e1rm_brzycki_kg]
            .filter((value): value is string => value !== null)
            .map(Number)
            .filter(Number.isFinite);
          const current = estimates.length
            ? estimates.reduce((sum, value) => sum + value, 0) / estimates.length
            : null;
          return current === null ? best : Math.max(best ?? current, current);
        }, null);
        return {
          id: workout.id,
          status:
            workout.status === 'completed' || workout.status === 'abandoned'
              ? workout.status
              : 'active',
          startedAt: workout.started_at,
          endedAt: workout.ended_at,
          setsCompleted: sets.filter((set) => set.completed_at !== null).length,
          exerciseNames: [...new Set(sets.map((set) => set.exercise_name_snapshot))],
          bestE1rmKg,
          isDeload: workout.is_deload,
        };
      }),
      nutritionGuidance:
        nutritionTarget && expenditure
          ? {
              targetId: nutritionTarget.id,
              expenditureId: expenditure.id,
              targetKcal: Number(nutritionTarget.kcal),
              targetProteinG: Number(nutritionTarget.protein_g),
              loggedKcal,
              loggedProteinG,
              source: 'target_engine',
              confidence: Number(nutritionTarget.confidence),
            }
          : null,
    },
    goals: goals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      status:
        goal.status === 'completed' || goal.status === 'paused' ? goal.status : 'active',
      kind: goal.kind === 'campaign' || goal.kind === 'chapter' ? goal.kind : 'goal',
    })),
    companion: companionState
      ? {
          totalPoints: companionState.total_points,
          stageKey:
            companionState.stage_key === 'sprout' ||
            companionState.stage_key === 'sapling' ||
            companionState.stage_key === 'young_tree' ||
            companionState.stage_key === 'flourishing_tree'
              ? companionState.stage_key
              : 'seed',
          achievements: userAchievements.map((earned) => ({
            id: earned.id,
            title:
              achievementDefinitions.find(
                (definition) => definition.id === earned.achievement_id,
              )?.title ?? 'Achievement',
            sourceEventId: earned.source_event_id,
          })),
        }
      : undefined,
    scripture: faithEnabled
      ? scripture.map((passage) => ({
          id: passage.id,
          reference: passage.reference,
          text: passage.text,
          translation: 'engwebp' as const,
          sourceUrl: passage.source_url,
          tags: passage.tags,
        }))
      : undefined,
    memories: memories.map((row) => ({
      id: row.id,
      kind: row.kind,
      content: row.content,
    })),
    permissions: { health: true, faith: faithEnabled, memory: true },
  };

  const routeCoco = createCocoRouter({
    provider: configuredProvider(),
    budget: {
      spentUsd: (userId, logicalDate) =>
        getAgentSpendUsd(supabase, { userId, logicalDate }),
      recordUsage: async () => undefined,
    },
    telemetry: {
      record: (event) =>
        insertAgentRunTelemetry(supabase, {
          id: crypto.randomUUID(),
          userId: event.userId,
          requestId: event.requestId,
          logicalDate: event.logicalDate,
          trigger: event.trigger,
          model: event.model,
          inputTokens: event.inputTokens,
          outputTokens: event.outputTokens,
          costUsd: event.costUsd,
          latencyMs: event.latencyMs,
          outcome: event.outcome,
          errorCode: event.errorCode,
          updatedAt: new Date().toISOString(),
        }),
    },
    config: {
      dailyBudgetUsd: nonnegativeEnvNumber('AI_DAILY_BUDGET_USD_PER_USER', 0.05),
      estimatedRequestCostUsd: nonnegativeEnvNumber('AI_ESTIMATED_REQUEST_USD', 0.01),
    },
  });

  const result = await routeCoco({
    requestId: parsed.data.requestId,
    userId: user.id,
    mode: parsed.data.mode,
    message: parsed.data.message,
    context,
    allowedActions: [...ALLOWED_ACTIONS],
  });
  return NextResponse.json(result);
}
