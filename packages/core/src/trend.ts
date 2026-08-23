export type WeightObservation = {
  date: string;
  weightKg: number;
};

export type WeightTrendPoint = WeightObservation & {
  trendWeightKg: number;
};

const DAY_MS = 86_400_000;

function dayNumber(date: string): number {
  const value = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(value)) throw new Error(`Invalid logical date: ${date}`);
  return Math.floor(value / DAY_MS);
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * A time-aware EWMA of scale weight. Large single-measurement innovations are
 * winsorized before smoothing so water shifts do not dominate expenditure.
 */
export function computeWeightTrend(
  observations: readonly WeightObservation[],
  options: { halfLifeDays?: number; maxInnovationFraction?: number } = {},
): WeightTrendPoint[] {
  const halfLifeDays = options.halfLifeDays ?? 7;
  const maxInnovationFraction = options.maxInnovationFraction ?? 0.015;
  if (!(halfLifeDays > 0)) throw new Error('halfLifeDays must be positive');

  const byDate = new Map<string, number>();
  for (const observation of observations) {
    if (!Number.isFinite(observation.weightKg) || observation.weightKg <= 0) {
      throw new Error('weightKg must be positive');
    }
    dayNumber(observation.date);
    byDate.set(observation.date, observation.weightKg);
  }
  const sorted = [...byDate.entries()]
    .map(([date, weightKg]) => ({ date, weightKg }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return [];

  let trend = sorted[0]!.weightKg;
  let previousDay = dayNumber(sorted[0]!.date);
  const result: WeightTrendPoint[] = [{ ...sorted[0]!, trendWeightKg: round(trend) }];

  for (const observation of sorted.slice(1)) {
    const currentDay = dayNumber(observation.date);
    const elapsedDays = Math.max(1, currentDay - previousDay);
    const alpha = 1 - 0.5 ** (elapsedDays / halfLifeDays);
    const innovationLimit = Math.max(0.75, trend * maxInnovationFraction);
    const innovation = Math.max(
      -innovationLimit,
      Math.min(innovationLimit, observation.weightKg - trend),
    );
    trend += alpha * innovation;
    result.push({ ...observation, trendWeightKg: round(trend) });
    previousDay = currentDay;
  }
  return result;
}

export function trendChange(
  points: readonly WeightTrendPoint[],
): { days: number; changeKg: number } | null {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return null;
  const days = dayNumber(last.date) - dayNumber(first.date);
  if (days <= 0) return null;
  return { days, changeKg: last.trendWeightKg - first.trendWeightKg };
}
