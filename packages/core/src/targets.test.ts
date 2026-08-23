import { describe, expect, it } from 'vitest';
import { generateNutritionTarget, type TargetInput } from './targets';

const base: TargetInput = {
  sex: 'female',
  goal: 'lose',
  tdeeKcal: 1_500,
  weightKg: 60,
  dayType: 'rest',
  trainingDaysPerWeek: 3,
};

describe('generateNutritionTarget', () => {
  it('cannot breach the female or male calorie floors', () => {
    expect(generateNutritionTarget(base).kcal).toBeGreaterThanOrEqual(1_200);
    expect(generateNutritionTarget({ ...base, sex: 'male' }).kcal).toBeGreaterThanOrEqual(
      1_500,
    );
    expect(
      generateNutritionTarget({ ...base, sex: 'unspecified' }).kcal,
    ).toBeGreaterThanOrEqual(1_500);
  });

  it('caps requested loss at one percent and deficit at 25 percent', () => {
    const target = generateNutritionTarget({
      ...base,
      tdeeKcal: 3_000,
      weightKg: 150,
      requestedWeeklyRatePercent: 8,
    });
    expect(target.weeklyRatePercent).toBe(1);
    expect(target.clampReasons).toContain('weekly_rate');
    expect(target.clampReasons).toContain('deficit');
    expect(target.kcal).toBeGreaterThanOrEqual(2_250 * 0.8);
  });

  it('caps a requested gain rate at half a percent per week', () => {
    const target = generateNutritionTarget({
      ...base,
      goal: 'gain',
      tdeeKcal: 2_400,
      requestedWeeklyRatePercent: 4,
    });
    expect(target.weeklyRatePercent).toBe(0.5);
    expect(target.clampReasons).toContain('weekly_rate');
  });

  it('never pushes fat below 0.5 g/kg and keeps carbs nonnegative', () => {
    const target = generateNutritionTarget({
      ...base,
      tdeeKcal: 1_200,
      weightKg: 200,
      requestedWeeklyRatePercent: 1,
      dayType: 'training',
    });
    expect(target.fatG).toBeGreaterThanOrEqual(100);
    expect(target.carbsG).toBeGreaterThanOrEqual(0);
    expect(target.clampReasons).toContain('macro_floor');
  });

  it('uses lean mass for protein guidance at higher known body-fat levels', () => {
    const totalMass = generateNutritionTarget({
      ...base,
      tdeeKcal: 2_500,
      weightKg: 100,
    });
    const leanMass = generateNutritionTarget({
      ...base,
      tdeeKcal: 2_500,
      weightKg: 100,
      bodyFatPercent: 35,
    });
    expect(leanMass.proteinG).toBeLessThan(totalMass.proteinG);
  });

  it('redistributes training and rest calories while preserving the weekly total', () => {
    const training = generateNutritionTarget({
      ...base,
      tdeeKcal: 2_400,
      goal: 'maintain',
      dayType: 'training',
    });
    const rest = generateNutritionTarget({
      ...base,
      tdeeKcal: 2_400,
      goal: 'maintain',
      dayType: 'rest',
    });
    expect(training.kcal).toBeGreaterThan(rest.kcal);
    expect(training.kcal * 3 + rest.kcal * 4).toBeCloseTo(2_400 * 7, -1);
  });
});
