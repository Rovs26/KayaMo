import { computeWeightTrend, trendChange, type WeightObservation } from './trend';

export type ExpenditureMethod = 'formula' | 'blended' | 'adaptive';

export type TdeeProfile = {
  sex: 'female' | 'male';
  birthYear: number;
  heightCm: number;
  weightKg: number;
  activityMultiplier: number;
  bodyFatPercent?: number | null;
};

export type DailyIntake = {
  date: string;
  kcal: number | null;
};

export type TdeeEstimateInput = {
  asOfDate: string;
  profile: TdeeProfile;
  intake: readonly DailyIntake[];
  weights: readonly WeightObservation[];
  windowDays?: number;
};

export type TdeeEstimate = {
  tdeeKcal: number;
  ciLow: number;
  ciHigh: number;
  method: ExpenditureMethod;
  completeness: number;
  daysOfData: number;
  formulaPriorKcal: number;
  dataEstimateKcal: number | null;
  inputsHash: string;
};

const DAY_MS = 86_400_000;
const TISSUE_ENERGY_KCAL_PER_KG = 7_700;

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function dateMs(date: string): number {
  const value = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(value)) throw new Error(`Invalid logical date: ${date}`);
  return value;
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function stableHash(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function restingEnergyKcal(profile: TdeeProfile, asOfDate: string): number {
  if (profile.weightKg <= 0 || profile.heightCm <= 0) {
    throw new Error('weightKg and heightCm must be positive');
  }
  const age = new Date(`${asOfDate}T00:00:00.000Z`).getUTCFullYear() - profile.birthYear;
  if (age < 18 || age > 100) throw new Error('profile age must be between 18 and 100');
  if (
    profile.bodyFatPercent !== null &&
    profile.bodyFatPercent !== undefined &&
    profile.bodyFatPercent > 0 &&
    profile.bodyFatPercent < 75
  ) {
    const leanMassKg = profile.weightKg * (1 - profile.bodyFatPercent / 100);
    return 370 + 21.6 * leanMassKg;
  }
  const sexOffset = profile.sex === 'male' ? 5 : -161;
  return 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * age + sexOffset;
}

/**
 * Formula prior for cold start, then an intake/weight-trend energy-balance
 * estimate blended in as complete data accumulates. Wearable burn is absent by
 * design and historical estimates are returned as immutable snapshots.
 */
export function estimateTdee(input: TdeeEstimateInput): TdeeEstimate {
  const windowDays = Math.round(clamp(input.windowDays ?? 28, 14, 42));
  const asOfMs = dateMs(input.asOfDate);
  const windowStartMs = asOfMs - (windowDays - 1) * DAY_MS;
  const activityMultiplier = clamp(input.profile.activityMultiplier, 1.2, 2);
  const formulaPriorKcal =
    restingEnergyKcal(input.profile, input.asOfDate) * activityMultiplier;

  const intakeByDate = new Map<string, number>();
  for (const day of input.intake) {
    const time = dateMs(day.date);
    if (
      time >= windowStartMs &&
      time <= asOfMs &&
      day.kcal !== null &&
      Number.isFinite(day.kcal) &&
      day.kcal >= 0
    ) {
      intakeByDate.set(day.date, day.kcal);
    }
  }
  const loggedIntake = [...intakeByDate.values()];
  const daysOfData = loggedIntake.length;
  const completeness = clamp(daysOfData / windowDays, 0, 1);
  const meanIntake =
    daysOfData === 0
      ? null
      : loggedIntake.reduce((total, kcal) => total + kcal, 0) / daysOfData;

  const trend = computeWeightTrend(
    input.weights.filter((row) => dateMs(row.date) <= asOfMs),
  ).filter((row) => dateMs(row.date) >= windowStartMs);
  const change = trendChange(trend);
  let dataEstimateKcal: number | null = null;
  if (meanIntake !== null && daysOfData >= 14 && change && change.days >= 13) {
    const raw = meanIntake - (change.changeKg * TISSUE_ENERGY_KCAL_PER_KG) / change.days;
    dataEstimateKcal = clamp(raw, formulaPriorKcal * 0.6, formulaPriorKcal * 1.4);
  }

  const maturity = clamp((daysOfData - 13) / 15, 0, 1);
  const dataWeight =
    dataEstimateKcal === null ? 0 : Math.min(0.85, maturity * completeness);
  const tdeeKcal =
    formulaPriorKcal * (1 - dataWeight) +
    (dataEstimateKcal ?? formulaPriorKcal) * dataWeight;
  const method: ExpenditureMethod =
    dataWeight === 0 ? 'formula' : dataWeight >= 0.65 ? 'adaptive' : 'blended';
  const relativeUncertainty =
    method === 'formula' ? 0.2 : 0.08 + (1 - completeness) * 0.22;
  const uncertainty = Math.max(120, tdeeKcal * relativeUncertainty);

  const normalized = {
    asOfDate: input.asOfDate,
    profile: { ...input.profile, activityMultiplier },
    intake: [...intakeByDate.entries()].sort(([a], [b]) => a.localeCompare(b)),
    weights: trend.map((row) => [row.date, row.trendWeightKg]),
    windowDays,
  };
  return {
    tdeeKcal: round(tdeeKcal),
    ciLow: round(Math.max(800, tdeeKcal - uncertainty)),
    ciHigh: round(tdeeKcal + uncertainty),
    method,
    completeness: round(completeness, 4),
    daysOfData,
    formulaPriorKcal: round(formulaPriorKcal),
    dataEstimateKcal: dataEstimateKcal === null ? null : round(dataEstimateKcal),
    inputsHash: stableHash(normalized),
  };
}
