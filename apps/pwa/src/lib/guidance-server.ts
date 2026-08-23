import {
  estimateTdee,
  generateNutritionTarget,
  type NutritionDayType,
} from '@kayamo/core';
import {
  appendExpenditureEstimate,
  getLatestExpenditureEstimate,
  getProfile,
  insertNutritionTargets,
  isUniqueViolation,
  listEffectiveNutritionTargets,
  listFoodEntriesSince,
  listWeightLogsSince,
  type DbClient,
  type ExpenditureEstimate,
  type NutritionTarget,
} from '@kayamo/db';

export const NUTRITION_DAY_TYPES: readonly NutritionDayType[] = [
  'training',
  'rest',
  'refeed',
  'deload',
];

/** The expenditure engine blends up to six weeks of intake and weight. */
const LOOKBACK_DAYS = 41;
const DAY_MS = 86_400_000;

export type GuidanceResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; error: string };

function daysBefore(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) - days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/**
 * Appends a new expenditure revision for `asOfDate`. Existing revisions are
 * never overwritten, so a recompute is always additive.
 */
export async function refreshExpenditure(
  client: DbClient,
  userId: string,
  asOfDate: string,
): Promise<GuidanceResult<ExpenditureEstimate>> {
  const profile = await getProfile(client, userId);
  const sex = profile?.sex === 'female' || profile?.sex === 'male' ? profile.sex : null;
  if (
    !profile ||
    !sex ||
    !profile.birth_year ||
    !profile.height_cm ||
    !profile.activity_baseline
  ) {
    return {
      ok: false,
      status: 422,
      error: 'Complete sex, birth year, height, and activity baseline first.',
    };
  }

  const sinceLogicalDate = daysBefore(asOfDate, LOOKBACK_DAYS);
  const [entries, weightLogs] = await Promise.all([
    listFoodEntriesSince(client, { userId, sinceLogicalDate }),
    listWeightLogsSince(client, { userId, sinceLogicalDate }),
  ]);
  const eligibleWeights = weightLogs.filter((row) => row.logical_date <= asOfDate);
  const currentWeight = eligibleWeights.at(-1);
  if (!currentWeight) {
    return { ok: false, status: 422, error: 'At least one weight log is required.' };
  }

  const intakeByDate = new Map<string, number>();
  for (const entry of entries) {
    if (entry.logical_date > asOfDate) continue;
    intakeByDate.set(
      entry.logical_date,
      (intakeByDate.get(entry.logical_date) ?? 0) + Number(entry.kcal),
    );
  }
  const estimate = estimateTdee({
    asOfDate,
    profile: {
      sex,
      birthYear: profile.birth_year,
      heightCm: Number(profile.height_cm),
      weightKg: Number(currentWeight.weight_kg),
      activityMultiplier: Number(profile.activity_baseline),
    },
    intake: [...intakeByDate].map(([date, kcal]) => ({ date, kcal })),
    weights: eligibleWeights.map((row) => ({
      date: row.logical_date,
      weightKg: Number(row.weight_kg),
    })),
  });
  const confidence =
    estimate.method === 'formula'
      ? 0.25
      : Math.min(0.9, 0.4 + estimate.completeness * 0.5);
  const stored = await appendExpenditureEstimate(client, {
    id: crypto.randomUUID(),
    user_id: userId,
    date: asOfDate,
    tdee_kcal: String(estimate.tdeeKcal),
    ci_low: String(estimate.ciLow),
    ci_high: String(estimate.ciHigh),
    method: estimate.method,
    source: 'expenditure_engine',
    confidence: confidence.toFixed(2),
    completeness: String(estimate.completeness),
    days_of_data: estimate.daysOfData,
    inputs_hash: estimate.inputsHash,
    updated_at: new Date().toISOString(),
  });
  return { ok: true, value: stored };
}

/**
 * Writes one target row per day type. Calorie floors and the deficit ceiling
 * are applied by `generateNutritionTarget`, never here.
 */
export async function refreshTargets(
  client: DbClient,
  userId: string,
  params: {
    effectiveFrom: string;
    requestedWeeklyRatePercent?: number;
    trainingDaysPerWeek?: number;
  },
): Promise<GuidanceResult<NutritionTarget[]>> {
  const [profile, estimate, weights] = await Promise.all([
    getProfile(client, userId),
    getLatestExpenditureEstimate(client, { userId, throughDate: params.effectiveFrom }),
    listWeightLogsSince(client, { userId, sinceLogicalDate: '1900-01-01' }),
  ]);
  const currentWeight = weights
    .filter((row) => row.logical_date <= params.effectiveFrom)
    .at(-1);
  const goal =
    profile?.goal === 'lose' || profile?.goal === 'maintain' || profile?.goal === 'gain'
      ? profile.goal
      : null;
  const sex = profile?.sex === 'female' || profile?.sex === 'male' ? profile.sex : 'unspecified';
  if (!goal || !estimate || !currentWeight) {
    return {
      ok: false,
      status: 422,
      error: 'A goal, weight log, and expenditure estimate are required.',
    };
  }

  const now = new Date().toISOString();
  const generated = NUTRITION_DAY_TYPES.map((dayType) =>
    generateNutritionTarget({
      sex,
      goal,
      tdeeKcal: Number(estimate.tdee_kcal),
      weightKg: Number(currentWeight.weight_kg),
      requestedWeeklyRatePercent: params.requestedWeeklyRatePercent,
      dayType,
      trainingDaysPerWeek: params.trainingDaysPerWeek ?? 3,
      expenditureConfidence: Number(estimate.confidence),
    }),
  );
  try {
    const targets = await insertNutritionTargets(
      client,
      generated.map((target) => ({
        id: crypto.randomUUID(),
        user_id: userId,
        effective_from: params.effectiveFrom,
        kcal: String(target.kcal),
        protein_g: String(target.proteinG),
        carbs_g: String(target.carbsG),
        fat_g: String(target.fatG),
        day_type: target.dayType,
        clamped: target.clamped,
        weekly_rate_percent: String(target.weeklyRatePercent),
        clamp_reasons: target.clampReasons,
        source: target.source,
        confidence: target.confidence.toFixed(2),
        updated_at: now,
      })),
    );
    return { ok: true, value: targets };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        status: 409,
        error: 'Targets already exist for that effective date.',
      };
    }
    throw error;
  }
}

/**
 * Re-runs expenditure then targets for a date. A duplicate target date is not
 * an error here: the caller asked for current guidance, so the existing rows
 * are returned instead.
 */
export async function refreshGuidance(
  client: DbClient,
  userId: string,
  params: {
    date: string;
    requestedWeeklyRatePercent?: number;
    trainingDaysPerWeek?: number;
  },
): Promise<
  GuidanceResult<{ estimate: ExpenditureEstimate; targets: NutritionTarget[] }>
> {
  const expenditure = await refreshExpenditure(client, userId, params.date);
  if (!expenditure.ok) return expenditure;

  const targets = await refreshTargets(client, userId, {
    effectiveFrom: params.date,
    requestedWeeklyRatePercent: params.requestedWeeklyRatePercent,
    trainingDaysPerWeek: params.trainingDaysPerWeek,
  });
  if (targets.ok) {
    return { ok: true, value: { estimate: expenditure.value, targets: targets.value } };
  }
  if (targets.status !== 409) return targets;

  return {
    ok: true,
    value: {
      estimate: expenditure.value,
      targets: await listEffectiveNutritionTargets(client, { userId, date: params.date }),
    },
  };
}
