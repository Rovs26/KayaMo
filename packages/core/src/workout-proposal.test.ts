import { describe, expect, it } from 'vitest';
import type { ExerciseSessionPerformance } from './progression';
import { proposeFromSessions, proposeExerciseLoad, scaleWorkoutSetCount, selectWorkoutExercises, workoutVersionForCapacity } from './workout-proposal';
import type { ProgressionAnalysis } from './progression';

function holdAnalysis(overrides: Partial<ProgressionAnalysis> = {}): ProgressionAnalysis {
  return {
    bestE1rmKg: 80,
    recommendation: { kind: 'hold', reason: 'building_reps' },
    fatigueFlags: [],
    deload: { recommended: false, reason: null, volumeMultiplier: 1, maintainLoad: true },
    ...overrides,
  };
}

describe('proposeExerciseLoad', () => {
  it('holds load when the engine says building reps', () => {
    const plan = proposeExerciseLoad({
      lastSets: [
        { weightKg: 60, reps: 8 },
        { weightKg: 60, reps: 8 },
        { weightKg: 60, reps: 7 },
      ],
      analysis: holdAnalysis(),
    });
    expect(plan.weightKg).toBe(60);
    expect(plan.setCount).toBe(3);
    expect(plan.wasLabel).toBe('held');
    expect(plan.deload).toBe(false);
  });

  it('adds the increment when every set hit the top of the range', () => {
    const plan = proposeExerciseLoad({
      lastSets: [
        { weightKg: 60, reps: 12 },
        { weightKg: 60, reps: 12 },
        { weightKg: 60, reps: 12 },
      ],
      analysis: holdAnalysis({ recommendation: { kind: 'add_load', addKg: 2.5 } }),
    });
    expect(plan.weightKg).toBe(62.5);
    expect(plan.wasLabel).toBe('was 60');
  });

  it('keeps the same kilos and halves sets on a deload', () => {
    const plan = proposeExerciseLoad({
      lastSets: [
        { weightKg: 60, reps: 5 },
        { weightKg: 60, reps: 5 },
        { weightKg: 60, reps: 4 },
        { weightKg: 60, reps: 4 },
      ],
      analysis: holdAnalysis({
        deload: {
          recommended: true,
          reason: 'fatigue',
          volumeMultiplier: 0.5,
          maintainLoad: true,
        },
      }),
    });
    expect(plan.weightKg).toBe(60);
    expect(plan.setCount).toBe(2);
    expect(plan.deload).toBe(true);
    expect(plan.wasLabel).toBe('was 60');
  });
});

describe('proposeFromSessions', () => {
  it('reads the last session for set count and reps', () => {
    const sessions: ExerciseSessionPerformance[] = [
      {
        sessionId: 'a',
        sessionDate: '2026-08-01',
        sets: [{ id: '1', sessionId: 'a', sessionDate: '2026-08-01', weightKg: 50, reps: 8 }],
      },
      {
        sessionId: 'b',
        sessionDate: '2026-08-08',
        sets: [
          { id: '2', sessionId: 'b', sessionDate: '2026-08-08', weightKg: 52.5, reps: 8 },
          { id: '3', sessionId: 'b', sessionDate: '2026-08-08', weightKg: 52.5, reps: 8 },
          { id: '4', sessionId: 'b', sessionDate: '2026-08-08', weightKg: 52.5, reps: 8 },
        ],
      },
    ];
    const plan = proposeFromSessions({ sessions });
    expect(plan.setCount).toBe(3);
    expect(plan.reps).toBe(8);
    expect(plan.weightKg).toBe(52.5);
  });
});

describe('workout versions', () => {
  it('shortens a low-capacity day to a minimum session', () => {
    expect(workoutVersionForCapacity('overwhelmed')).toBe('minimum');
    expect(workoutVersionForCapacity('normal', 'recovery')).toBe('minimum');
    expect(workoutVersionForCapacity('great')).toBe('full');
    expect(scaleWorkoutSetCount(4, 'minimum')).toBe(2);
    expect(selectWorkoutExercises(['squat', 'bench', 'row'], 'minimum')).toEqual(['squat']);
    expect(selectWorkoutExercises(['squat', 'bench'], 'standard')).toEqual(['squat', 'bench']);
  });
});
