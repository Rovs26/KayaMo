import type { DayCapacity, DayIntent } from './day-plan';
import {
  analyzeExerciseProgression,
  estimateSetE1rm,
  type ExerciseSessionPerformance,
  type ProgressionAnalysis,
} from './progression';

export const WORKOUT_VERSIONS = ['minimum', 'standard', 'full'] as const;
export type WorkoutVersion = (typeof WORKOUT_VERSIONS)[number];

export const WORKOUT_VERSION_LABELS: Record<WorkoutVersion, string> = {
  minimum: 'Minimum session',
  standard: 'Standard session',
  full: 'Full session',
};

export function workoutVersionForCapacity(
  capacity: DayCapacity | null | undefined,
  intent?: DayIntent | null,
): WorkoutVersion {
  if (capacity === 'sick' || capacity === 'overwhelmed') return 'minimum';
  if (capacity === 'low' || intent === 'recovery') return 'minimum';
  if (capacity === 'great') return 'full';
  return 'standard';
}

export function scaleWorkoutSetCount(setCount: number, version: WorkoutVersion): number {
  if (version === 'minimum') return Math.max(1, Math.ceil(setCount / 2));
  return Math.max(1, setCount);
}

export function selectWorkoutExercises<T>(exercises: readonly T[], version: WorkoutVersion): T[] {
  if (exercises.length === 0) return [];
  if (version === 'minimum') return [exercises[0]!];
  return [...exercises];
}

export type LastWorkingSet = {
  weightKg: number;
  reps: number;
};

export type ProposedExercisePlan = {
  setCount: number;
  weightKg: number;
  reps: number;
  wasLabel: string;
  planLabel: string;
  suggestLabel: string;
  ormLabel: string;
  deload: boolean;
};

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Maps last-session sets + engine analysis onto a proposed load. Deload keeps kg. */
export function proposeExerciseLoad(input: {
  lastSets: readonly LastWorkingSet[];
  analysis: ProgressionAnalysis;
  loadIncrementKg?: number;
}): ProposedExercisePlan {
  const last = input.lastSets.at(-1);
  const lastCount = Math.max(1, input.lastSets.length);
  const lastKg = last?.weightKg ?? 20;
  const lastReps = last?.reps ?? 8;
  const increment = input.loadIncrementKg ?? 2.5;
  const deload = input.analysis.deload.recommended;
  const setCount = deload
    ? Math.max(1, Math.round(lastCount * input.analysis.deload.volumeMultiplier))
    : lastCount;
  let weightKg = lastKg;
  if (!deload && input.analysis.recommendation.kind === 'add_load') {
    weightKg = lastKg + input.analysis.recommendation.addKg;
  }
  weightKg = roundTo(weightKg, increment);
  const wasLabel = deload || weightKg !== lastKg ? `was ${lastKg}` : 'held';
  return {
    setCount,
    weightKg,
    reps: lastReps,
    wasLabel,
    planLabel: `${setCount} sets × ${lastReps} reps`,
    suggestLabel: `${weightKg} kg × ${lastReps}`,
    ormLabel:
      input.analysis.bestE1rmKg === null ? '—' : `${Math.round(input.analysis.bestE1rmKg)} kg`,
    deload,
  };
}

export function proposeFromSessions(input: {
  sessions: readonly ExerciseSessionPerformance[];
  loadIncrementKg?: number;
}): ProposedExercisePlan {
  const sessions = [...input.sessions].sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
  const latest = sessions.at(-1);
  const lastSets = (latest?.sets ?? [])
    .filter((set) => !set.isWarmup)
    .map((set) => ({ weightKg: set.weightKg, reps: set.reps }));
  const lastReps = lastSets.at(-1)?.reps ?? 8;
  const analysis = analyzeExerciseProgression({
    sessions,
    repRange: { min: Math.max(1, lastReps - 2), max: lastReps + 2 },
    loadIncrementKg: input.loadIncrementKg ?? 2.5,
  });
  return proposeExerciseLoad({
    lastSets,
    analysis,
    loadIncrementKg: input.loadIncrementKg,
  });
}

export function sessionVolumeKg(sets: readonly LastWorkingSet[]): number {
  return sets.reduce((sum, set) => sum + set.weightKg * set.reps, 0);
}

export function bestE1rmFromSets(sets: readonly LastWorkingSet[]): number | null {
  const values = sets
    .map((set) => estimateSetE1rm(set.weightKg, set.reps).averageKg)
    .filter((value): value is number => value !== null);
  return values.length ? Math.max(...values) : null;
}
