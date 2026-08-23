export type E1rmEstimate = {
  epleyKg: number | null;
  brzyckiKg: number | null;
  averageKg: number | null;
  lowConfidence: boolean;
};

export type TrainingSetPerformance = {
  id: string;
  sessionId: string;
  sessionDate: string;
  weightKg: number;
  reps: number;
  rpe?: number | null;
  rir?: number | null;
  isWarmup?: boolean;
  muscles?: string[];
};

export type ExerciseSessionPerformance = {
  sessionId: string;
  sessionDate: string;
  sets: TrainingSetPerformance[];
};

export type ProgressionAnalysis = {
  bestE1rmKg: number | null;
  recommendation:
    | { kind: 'add_load'; addKg: number }
    | { kind: 'hold'; reason: 'building_reps' | 'insufficient_data' }
    | {
        kind: 'stall';
        options: ['reset_rep_range', 'technique_check', 'deload'];
      };
  fatigueFlags: Array<'rising_rpe' | 'falling_reps' | 'e1rm_decline'>;
  deload: {
    recommended: boolean;
    reason: 'fatigue' | 'accumulated_volume' | null;
    volumeMultiplier: 0.5 | 1;
    maintainLoad: true;
  };
};

export type MuscleVolumeBand = {
  muscle: string;
  minimum: number;
  preferredMaximum: number;
  recoverableMaximum: number;
};

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function validSet(weightKg: number, reps: number): boolean {
  return Number.isFinite(weightKg) && weightKg >= 0 && Number.isInteger(reps) && reps > 0;
}

/** Stored by the database trigger; this pure twin is used before offline writes. */
export function estimateSetE1rm(weightKg: number, reps: number): E1rmEstimate {
  if (!validSet(weightKg, reps) || weightKg === 0) {
    return {
      epleyKg: null,
      brzyckiKg: null,
      averageKg: null,
      lowConfidence: reps > 12,
    };
  }
  const epley = reps === 1 ? weightKg : weightKg * (1 + reps / 30);
  const brzycki = reps < 37 ? weightKg * (36 / (37 - reps)) : null;
  const values = [epley, brzycki].filter((value): value is number => value !== null);
  return {
    epleyKg: round(epley),
    brzyckiKg: brzycki === null ? null : round(brzycki),
    averageKg: values.length
      ? round(values.reduce((sum, value) => sum + value, 0) / values.length)
      : null,
    lowConfidence: reps > 12,
  };
}

export function isHardSet(set: TrainingSetPerformance): boolean {
  if (set.isWarmup) return false;
  if (set.rir !== null && set.rir !== undefined) return set.rir <= 3;
  if (set.rpe !== null && set.rpe !== undefined) return set.rpe >= 7;
  return true;
}

export function weeklyHardSetsByMuscle(
  sets: readonly TrainingSetPerformance[],
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const set of sets) {
    if (!isHardSet(set)) continue;
    for (const muscle of new Set(set.muscles ?? [])) {
      result[muscle] = (result[muscle] ?? 0) + 1;
    }
  }
  return result;
}

export function compareVolumeToUserBand(
  hardSets: number,
  band: MuscleVolumeBand,
): 'below_your_band' | 'within_your_band' | 'above_your_band' {
  if (hardSets < band.minimum) return 'below_your_band';
  if (hardSets > band.recoverableMaximum) return 'above_your_band';
  return 'within_your_band';
}

function sessionBest(session: ExerciseSessionPerformance): number | null {
  const values = session.sets
    .filter((set) => !set.isWarmup)
    .map((set) => estimateSetE1rm(set.weightKg, set.reps).averageKg)
    .filter((value): value is number => value !== null);
  return values.length ? Math.max(...values) : null;
}

function representativeSet(
  session: ExerciseSessionPerformance,
): TrainingSetPerformance | null {
  return session.sets.find((set) => !set.isWarmup) ?? null;
}

/** Deterministic suggestions only; these are heuristic signals, not diagnoses. */
export function analyzeExerciseProgression(input: {
  sessions: readonly ExerciseSessionPerformance[];
  repRange: { min: number; max: number };
  loadIncrementKg: number;
  weeksAtOrAboveUpperBand?: number;
}): ProgressionAnalysis {
  const sessions = [...input.sessions]
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate))
    .slice(-3);
  const latest = sessions.at(-1);
  const best = latest ? sessionBest(latest) : null;
  const workingSets = latest?.sets.filter((set) => !set.isWarmup) ?? [];
  let recommendation: ProgressionAnalysis['recommendation'];
  if (workingSets.length === 0) {
    recommendation = { kind: 'hold', reason: 'insufficient_data' };
  } else if (workingSets.every((set) => set.reps >= input.repRange.max)) {
    recommendation = { kind: 'add_load', addKg: input.loadIncrementKg };
  } else {
    recommendation = { kind: 'hold', reason: 'building_reps' };
  }

  const bests = sessions.map(sessionBest);
  const hasThreeBests = bests.length === 3 && bests.every((value) => value !== null);
  if (hasThreeBests) {
    const numericBests = bests as number[];
    const improvement =
      (numericBests[2]! - numericBests[0]!) / Math.max(1, numericBests[0]!);
    if (improvement < 0.01) {
      recommendation = {
        kind: 'stall',
        options: ['reset_rep_range', 'technique_check', 'deload'],
      };
    }
  }

  const fatigueFlags: ProgressionAnalysis['fatigueFlags'] = [];
  const representatives = sessions
    .map(representativeSet)
    .filter((set): set is TrainingSetPerformance => set !== null);
  if (representatives.length === 3) {
    const [first, , last] = representatives;
    const constantLoad = Math.abs(last!.weightKg - first!.weightKg) <= 0.25;
    if (
      constantLoad &&
      first!.rpe !== null &&
      first!.rpe !== undefined &&
      last!.rpe !== null &&
      last!.rpe !== undefined &&
      last!.rpe - first!.rpe >= 1
    ) {
      fatigueFlags.push('rising_rpe');
    }
    if (constantLoad && first!.reps - last!.reps >= 2) {
      fatigueFlags.push('falling_reps');
    }
  }
  if (hasThreeBests) {
    const numericBests = bests as number[];
    if (numericBests[2]! <= numericBests[0]! * 0.95) {
      fatigueFlags.push('e1rm_decline');
    }
  }

  const volumeDeload = (input.weeksAtOrAboveUpperBand ?? 0) >= 5;
  const fatigueDeload = fatigueFlags.length >= 2;
  return {
    bestE1rmKg: best,
    recommendation,
    fatigueFlags,
    deload: {
      recommended: volumeDeload || fatigueDeload,
      reason: fatigueDeload ? 'fatigue' : volumeDeload ? 'accumulated_volume' : null,
      volumeMultiplier: volumeDeload || fatigueDeload ? 0.5 : 1,
      maintainLoad: true,
    },
  };
}

export function restTimerDeadline(startedAt: string, restSeconds: number): string {
  const start = Date.parse(startedAt);
  if (!Number.isFinite(start) || !Number.isInteger(restSeconds) || restSeconds < 0) {
    throw new Error('Invalid rest timer input');
  }
  return new Date(start + restSeconds * 1_000).toISOString();
}

export function calculatePlatesPerSide(input: {
  targetKg: number;
  barKg?: number;
  availablePlatesKg?: readonly number[];
}): {
  platesPerSide: number[];
  actualKg: number;
  remainderKg: number;
  exact: boolean;
} {
  const barKg = input.barKg ?? 20;
  const available = [...(input.availablePlatesKg ?? [20, 15, 10, 5, 2.5, 1.25])]
    .filter((plate) => Number.isFinite(plate) && plate > 0)
    .sort((a, b) => b - a);
  if (
    !Number.isFinite(input.targetKg) ||
    input.targetKg < barKg ||
    available.length === 0
  ) {
    throw new Error('Invalid plate math input');
  }
  let perSide = (input.targetKg - barKg) / 2;
  const platesPerSide: number[] = [];
  for (const plate of available) {
    while (perSide + 1e-9 >= plate) {
      platesPerSide.push(plate);
      perSide -= plate;
    }
  }
  const remainderKg = round(perSide * 2);
  return {
    platesPerSide,
    actualKg: round(input.targetKg - remainderKg),
    remainderKg,
    exact: Math.abs(remainderKg) < 0.001,
  };
}
