import { describe, expect, it } from 'vitest';
import {
  analyzeExerciseProgression,
  calculatePlatesPerSide,
  compareVolumeToUserBand,
  estimateSetE1rm,
  restTimerDeadline,
  weeklyHardSetsByMuscle,
  type ExerciseSessionPerformance,
} from './progression';

function session(
  index: number,
  values: { weight: number; reps: number; rpe?: number },
): ExerciseSessionPerformance {
  return {
    sessionId: `session-${index}`,
    sessionDate: `2026-0${index + 1}-01`,
    sets: Array.from({ length: 3 }, (_, setIndex) => ({
      id: `set-${index}-${setIndex}`,
      sessionId: `session-${index}`,
      sessionDate: `2026-0${index + 1}-01`,
      weightKg: values.weight,
      reps: values.reps,
      rpe: values.rpe,
      muscles: ['chest', 'triceps'],
    })),
  };
}

describe('stored e1RM calculations', () => {
  it('calculates Epley and Brzycki while flagging high-rep estimates', () => {
    expect(estimateSetE1rm(100, 5)).toEqual({
      epleyKg: 116.67,
      brzyckiKg: 112.5,
      averageKg: 114.58,
      lowConfidence: false,
    });
    expect(estimateSetE1rm(50, 15).lowConfidence).toBe(true);
  });
});

describe('progression and fatigue', () => {
  it('uses double progression when every working set reaches the top', () => {
    const result = analyzeExerciseProgression({
      sessions: [session(0, { weight: 60, reps: 12 })],
      repRange: { min: 8, max: 12 },
      loadIncrementKg: 2.5,
    });
    expect(result.recommendation).toEqual({ kind: 'add_load', addKg: 2.5 });
  });

  it('detects fatigue and proposes a half-volume deload with load maintained', () => {
    const result = analyzeExerciseProgression({
      sessions: [
        session(0, { weight: 80, reps: 10, rpe: 7.5 }),
        session(1, { weight: 80, reps: 9, rpe: 8 }),
        session(2, { weight: 80, reps: 7, rpe: 9 }),
      ],
      repRange: { min: 6, max: 10 },
      loadIncrementKg: 2.5,
    });
    expect(result.fatigueFlags).toEqual(
      expect.arrayContaining(['rising_rpe', 'falling_reps', 'e1rm_decline']),
    );
    expect(result.deload).toEqual({
      recommended: true,
      reason: 'fatigue',
      volumeMultiplier: 0.5,
      maintainLoad: true,
    });
  });

  it('runs deterministically over a 12-week synthetic training history', () => {
    const history = Array.from({ length: 12 }, (_, index) =>
      session(index % 9, {
        weight: 60 + Math.min(index, 8) * 2.5,
        reps: index < 9 ? 12 : 8,
        rpe: index < 9 ? 8 : 9,
      }),
    );
    const first = analyzeExerciseProgression({
      sessions: history,
      repRange: { min: 8, max: 12 },
      loadIncrementKg: 2.5,
      weeksAtOrAboveUpperBand: 5,
    });
    const second = analyzeExerciseProgression({
      sessions: history,
      repRange: { min: 8, max: 12 },
      loadIncrementKg: 2.5,
      weeksAtOrAboveUpperBand: 5,
    });
    expect(first).toEqual(second);
    expect(first.deload.recommended).toBe(true);
  });
});

describe('training helpers', () => {
  it('counts only hard working sets against the user-owned volume band', () => {
    const sets = [
      { ...session(0, { weight: 60, reps: 10 }).sets[0]!, rir: 2 },
      { ...session(0, { weight: 40, reps: 10 }).sets[1]!, isWarmup: true },
      { ...session(0, { weight: 60, reps: 10 }).sets[2]!, rir: 5 },
    ];
    expect(weeklyHardSetsByMuscle(sets)).toEqual({ chest: 1, triceps: 1 });
    expect(
      compareVolumeToUserBand(1, {
        muscle: 'chest',
        minimum: 4,
        preferredMaximum: 10,
        recoverableMaximum: 14,
      }),
    ).toBe('below_your_band');
  });

  it('persists rest deadlines and calculates PH-gym plate loading', () => {
    expect(restTimerDeadline('2026-08-22T08:00:00.000Z', 90)).toBe(
      '2026-08-22T08:01:30.000Z',
    );
    expect(calculatePlatesPerSide({ targetKg: 100 })).toEqual({
      platesPerSide: [20, 20],
      actualKg: 100,
      remainderKg: 0,
      exact: true,
    });
  });
});
