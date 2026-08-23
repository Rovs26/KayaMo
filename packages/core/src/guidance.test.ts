import { describe, expect, it } from 'vitest';
import {
  dayTypeForToday,
  macroProgress,
  nutritionProgress,
  targetForDayType,
  type NutritionTargetView,
} from './guidance';

function target(overrides: Partial<NutritionTargetView> = {}): NutritionTargetView {
  return {
    dayType: 'rest',
    effectiveFrom: '2026-08-22',
    kcal: 2124,
    proteinG: 157,
    carbsG: 251,
    fatG: 55,
    clamped: false,
    clampReasons: [],
    weeklyRatePercent: 0.6,
    confidence: 0.62,
    ...overrides,
  };
}

describe('nutritionProgress', () => {
  it('reports eaten, target, and remaining', () => {
    const progress = nutritionProgress(345, target());
    expect(progress.eatenKcal).toBe(345);
    expect(progress.targetKcal).toBe(2124);
    expect(progress.remainingKcal).toBe(1779);
    expect(progress.over).toBe(false);
  });

  it('goes negative and flags over once the target is passed', () => {
    const progress = nutritionProgress(2300, target());
    expect(progress.remainingKcal).toBe(-176);
    expect(progress.over).toBe(true);
  });

  it('clamps the bar to 100 percent so an overshoot cannot overflow', () => {
    expect(nutritionProgress(4000, target()).percent).toBe(100);
    expect(nutritionProgress(0, target()).percent).toBe(0);
  });

  it('returns null target fields when no target exists yet', () => {
    const progress = nutritionProgress(345, null);
    expect(progress.eatenKcal).toBe(345);
    expect(progress.targetKcal).toBeNull();
    expect(progress.remainingKcal).toBeNull();
    expect(progress.percent).toBeNull();
    expect(progress.over).toBe(false);
  });

  it('ignores a zero or negative stored target', () => {
    expect(nutritionProgress(345, target({ kcal: 0 })).targetKcal).toBeNull();
  });
});

describe('targetForDayType', () => {
  it('picks the matching day type and returns null when absent', () => {
    const targets = [target({ dayType: 'rest' }), target({ dayType: 'training', kcal: 2400 })];
    expect(targetForDayType(targets, 'training')?.kcal).toBe(2400);
    expect(targetForDayType(targets, 'deload')).toBeNull();
  });
});

describe('dayTypeForToday', () => {
  it('uses the training target only when a workout is logged', () => {
    expect(dayTypeForToday(true)).toBe('training');
    expect(dayTypeForToday(false)).toBe('rest');
  });
});

describe('macroProgress', () => {
  it('pairs eaten macros with their targets and rounds both', () => {
    const rows = macroProgress({ proteinG: 20.4, carbsG: 30.6, fatG: 9.5 }, target());
    expect(rows.map((row) => [row.key, row.eatenG, row.targetG])).toEqual([
      ['protein', 20, 157],
      ['carbs', 31, 251],
      ['fat', 10, 55],
    ]);
  });

  it('leaves targets null when guidance has not been generated', () => {
    expect(macroProgress({ proteinG: 0, carbsG: 0, fatG: 0 }, null).every((row) => row.targetG === null)).toBe(true);
  });
});
