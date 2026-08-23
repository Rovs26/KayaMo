import { NextResponse } from 'next/server';
import { analyzeExerciseProgression } from '@kayamo/core';
import { getExercise, listWorkoutHistory, listWorkoutSets } from '@kayamo/db';
import { z } from 'zod';
import { createServerSupabase } from '@/lib/supabase/server';

const querySchema = z.object({
  exerciseId: z.string().uuid(),
  loadIncrementKg: z.coerce.number().positive().max(20).default(2.5),
});

export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    exerciseId: url.searchParams.get('exerciseId'),
    loadIncrementKg: url.searchParams.get('loadIncrementKg') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid progression request.' }, { status: 400 });
  }

  const [exercise, workouts] = await Promise.all([
    getExercise(supabase, parsed.data.exerciseId),
    listWorkoutHistory(supabase, { userId: user.id, limit: 50 }),
  ]);
  if (!exercise)
    return NextResponse.json({ error: 'Exercise not found.' }, { status: 404 });

  const setsByWorkout = await Promise.all(
    workouts.map((workout) => listWorkoutSets(supabase, workout.id)),
  );
  const sessions = workouts
    .map((workout, index) => ({
      sessionId: workout.id,
      sessionDate: workout.started_at,
      sets: (setsByWorkout[index] ?? [])
        .filter((set) => set.exercise_id === exercise.id && set.completed_at !== null)
        .map((set) => ({
          id: set.id,
          sessionId: workout.id,
          sessionDate: workout.started_at,
          weightKg: Number(set.weight_kg),
          reps: set.reps,
          rpe: set.rpe === null ? null : Number(set.rpe),
          rir: set.rir === null ? null : Number(set.rir),
          isWarmup: set.is_warmup,
          muscles: exercise.muscles,
        })),
    }))
    .filter((session) => session.sets.length > 0);

  const analysis = analyzeExerciseProgression({
    sessions,
    repRange: {
      min: exercise.default_rep_min ?? 5,
      max: exercise.default_rep_max ?? 12,
    },
    loadIncrementKg: parsed.data.loadIncrementKg,
  });
  return NextResponse.json({
    exercise: { id: exercise.id, name: exercise.name },
    sessionsAnalyzed: sessions.length,
    analysis,
    disclaimer: 'Training suggestions are heuristic signals, not medical advice.',
  });
}
