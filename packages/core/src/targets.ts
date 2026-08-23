export type NutritionGoal = 'lose' | 'maintain' | 'gain';
export type NutritionSex = 'female' | 'male' | 'unspecified';
export type NutritionDayType = 'training' | 'rest' | 'refeed' | 'deload';

export type TargetInput = {
  sex: NutritionSex;
  goal: NutritionGoal;
  tdeeKcal: number;
  weightKg: number;
  bodyFatPercent?: number | null;
  requestedWeeklyRatePercent?: number;
  dayType: NutritionDayType;
  trainingDaysPerWeek?: number;
  expenditureConfidence?: number;
};

export type NutritionTarget = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  dayType: NutritionDayType;
  weeklyRatePercent: number;
  clamped: boolean;
  clampReasons: Array<'weekly_rate' | 'deficit' | 'calorie_floor' | 'macro_floor'>;
  source: 'target_engine';
  confidence: number;
};

const KCAL_PER_KG = 7_700;

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function calorieFloor(sex: NutritionSex): number {
  return sex === 'female' ? 1_200 : 1_500;
}

function dayKcalFactor(dayType: NutritionDayType, trainingDays: number): number {
  if (dayType === 'training') return 1.05;
  if (dayType === 'deload') return 1.02;
  if (dayType === 'refeed') return 1;
  const restDays = Math.max(1, 7 - trainingDays);
  return Math.max(0.8, (7 - trainingDays * 1.05) / restDays);
}

/** Generates nutrition guidance entirely in code; callers persist the result. */
export function generateNutritionTarget(input: TargetInput): NutritionTarget {
  if (!(input.tdeeKcal > 0) || !(input.weightKg > 0)) {
    throw new Error('tdeeKcal and weightKg must be positive');
  }
  const reasons: NutritionTarget['clampReasons'] = [];
  const trainingDays = Math.round(clamp(input.trainingDaysPerWeek ?? 3, 0, 6));
  const requested = Math.max(0, input.requestedWeeklyRatePercent ?? 0.5);
  const maxRate = input.goal === 'lose' ? 1 : input.goal === 'gain' ? 0.5 : 0;
  const weeklyRatePercent = clamp(requested, 0, maxRate);
  if (weeklyRatePercent !== requested) reasons.push('weekly_rate');

  let baseKcal = input.tdeeKcal;
  if (input.goal === 'lose') {
    const requestedDeficit =
      (input.weightKg * (weeklyRatePercent / 100) * KCAL_PER_KG) / 7;
    const deficit = Math.min(requestedDeficit, input.tdeeKcal * 0.25);
    if (deficit < requestedDeficit) reasons.push('deficit');
    baseKcal -= deficit;
  } else if (input.goal === 'gain') {
    baseKcal += (input.weightKg * (weeklyRatePercent / 100) * KCAL_PER_KG) / 7;
  }

  const floor = calorieFloor(input.sex);
  let targetKcal =
    input.dayType === 'refeed' && input.goal === 'lose'
      ? input.tdeeKcal
      : baseKcal * dayKcalFactor(input.dayType, trainingDays);
  if (targetKcal < floor) {
    targetKcal = floor;
    reasons.push('calorie_floor');
  }

  const useLeanMass =
    input.bodyFatPercent !== null &&
    input.bodyFatPercent !== undefined &&
    input.bodyFatPercent >= 25 &&
    input.bodyFatPercent < 75;
  const referenceMass = useLeanMass
    ? input.weightKg * (1 - input.bodyFatPercent! / 100)
    : input.weightKg;
  const proteinPerKg = input.goal === 'lose' ? 2 : 1.8;
  const proteinG = referenceMass * proteinPerKg;
  const fatPerKg =
    input.dayType === 'training'
      ? 0.7
      : input.dayType === 'refeed'
        ? 0.6
        : input.dayType === 'rest'
          ? 0.9
          : 0.8;
  const fatG = Math.max(input.weightKg * 0.5, referenceMass * fatPerKg);
  const macroFloorKcal = proteinG * 4 + fatG * 9;
  if (targetKcal < macroFloorKcal) {
    targetKcal = macroFloorKcal;
    reasons.push('macro_floor');
  }
  const carbsG = Math.max(0, (targetKcal - proteinG * 4 - fatG * 9) / 4);

  return {
    kcal: Math.round(targetKcal),
    proteinG: Math.round(proteinG),
    carbsG: Math.round(carbsG),
    fatG: Math.round(fatG),
    dayType: input.dayType,
    weeklyRatePercent: Math.round(weeklyRatePercent * 100) / 100,
    clamped: reasons.length > 0,
    clampReasons: [...new Set(reasons)],
    source: 'target_engine',
    confidence: clamp(input.expenditureConfidence ?? 0.25, 0, 1),
  };
}
