import type { NutritionDayType } from './targets';

/**
 * A read-only projection of stored guidance, shared by the API route that
 * builds it and the offline cache that keeps the last known copy.
 */
export type GuidanceProfileState = {
  complete: boolean;
  /** Profile columns the expenditure engine still needs. */
  missing: string[];
  sex: string | null;
  goal: string | null;
  locale: string;
  timezone: string;
  dayStartsAt: string;
};

export type ExpenditureView = {
  date: string;
  tdeeKcal: number;
  ciLow: number | null;
  ciHigh: number | null;
  method: string;
  confidence: number;
  daysOfData: number | null;
};

export type NutritionTargetView = {
  dayType: string;
  effectiveFrom: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  clamped: boolean;
  clampReasons: string[];
  weeklyRatePercent: number;
  confidence: number;
};

export type GuidanceSnapshot = {
  date: string;
  profile: GuidanceProfileState;
  expenditure: ExpenditureView | null;
  targets: NutritionTargetView[];
};

export function targetForDayType(
  targets: readonly NutritionTargetView[],
  dayType: NutritionDayType,
): NutritionTargetView | null {
  return targets.find((target) => target.dayType === dayType) ?? null;
}

/**
 * Training days carry the surplus, so a logged workout picks the training
 * target. Everything else reads as a rest day until the user says otherwise.
 */
export function dayTypeForToday(hasWorkoutToday: boolean): NutritionDayType {
  return hasWorkoutToday ? 'training' : 'rest';
}

export type NutritionProgress = {
  eatenKcal: number;
  targetKcal: number | null;
  /** Negative once the target is passed. Null when no target exists yet. */
  remainingKcal: number | null;
  /** 0–100 for the progress bar. Null when no target exists yet. */
  percent: number | null;
  over: boolean;
};

export function nutritionProgress(
  eatenKcal: number,
  target: NutritionTargetView | null,
): NutritionProgress {
  const eaten = Math.max(0, Math.round(eatenKcal));
  if (!target || !(target.kcal > 0)) {
    return {
      eatenKcal: eaten,
      targetKcal: null,
      remainingKcal: null,
      percent: null,
      over: false,
    };
  }
  const targetKcal = Math.round(target.kcal);
  const remainingKcal = targetKcal - eaten;
  return {
    eatenKcal: eaten,
    targetKcal,
    remainingKcal,
    percent: Math.min(100, Math.max(0, (eaten / targetKcal) * 100)),
    over: remainingKcal < 0,
  };
}

export type MacroProgress = {
  key: 'protein' | 'carbs' | 'fat';
  label: string;
  eatenG: number;
  targetG: number | null;
};

export function macroProgress(
  eaten: { proteinG: number; carbsG: number; fatG: number },
  target: NutritionTargetView | null,
): MacroProgress[] {
  return [
    { key: 'protein', label: 'Protein', eatenG: eaten.proteinG, targetG: target?.proteinG ?? null },
    { key: 'carbs', label: 'Carbs', eatenG: eaten.carbsG, targetG: target?.carbsG ?? null },
    { key: 'fat', label: 'Fat', eatenG: eaten.fatG, targetG: target?.fatG ?? null },
  ].map((macro) => ({
    ...macro,
    eatenG: Math.round(macro.eatenG),
    targetG: macro.targetG === null ? null : Math.round(macro.targetG),
  })) as MacroProgress[];
}
