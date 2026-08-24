import {
  analyzeExerciseProgression,
  estimateSetE1rm,
  type ExerciseSessionPerformance,
  type ProgressionAnalysis,
} from './progression';

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
