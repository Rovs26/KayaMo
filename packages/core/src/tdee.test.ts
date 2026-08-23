import { describe, expect, it } from 'vitest';
import { estimateTdee, restingEnergyKcal, type TdeeEstimateInput } from './tdee';

const profile = {
  sex: 'male' as const,
  birthYear: 1996,
  heightCm: 175,
  weightKg: 80,
  activityMultiplier: 1.5,
};

function days(count: number, kcal: number, dailyWeightChange = 0) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10);
    return {
      intake: { date, kcal },
      weight: { date, weightKg: 80 + index * dailyWeightChange },
    };
  });
}

function estimate(
  rows: ReturnType<typeof days>,
  overrides: Partial<TdeeEstimateInput> = {},
) {
  return estimateTdee({
    asOfDate: rows.at(-1)!.intake.date,
    profile,
    intake: rows.map((row) => row.intake),
    weights: rows.map((row) => row.weight),
    ...overrides,
  });
}

describe('estimateTdee', () => {
  it('uses Mifflin-St Jeor as a low-confidence cold-start prior', () => {
    expect(restingEnergyKcal(profile, '2026-01-01')).toBeCloseTo(1748.75, 2);
    const result = estimate(days(10, 2400));
    expect(result.method).toBe('formula');
    expect(result.ciHigh - result.ciLow).toBeGreaterThan(500);
  });

  it('uses Katch-McArdle when a valid body-fat measurement is available', () => {
    const ree = restingEnergyKcal(
      { ...profile, bodyFatPercent: 25 },
      '2026-01-01',
    );
    expect(ree).toBeCloseTo(1_666, 2);
  });

  it('moves toward complete energy-balance data after day 14', () => {
    const result = estimate(days(28, 2300, -0.03), {
      profile: { ...profile, activityMultiplier: 1.3 },
    });
    expect(result.method).toBe('adaptive');
    expect(result.dataEstimateKcal).not.toBeNull();
    expect(result.tdeeKcal).toBeGreaterThan(result.formulaPriorKcal);
  });

  it('widens uncertainty and limits influence for erratic logging', () => {
    const rows = days(28, 2300, -0.02);
    const result = estimate(rows, {
      intake: rows.map((row, index) => ({
        ...row.intake,
        kcal: index % 2 === 0 ? row.intake.kcal : null,
      })),
    });
    expect(result.completeness).toBe(0.5);
    expect(result.method).toBe('blended');
    expect(result.ciHigh - result.ciLow).toBeGreaterThan(500);
  });

  it('does not blow up on a sudden water-weight drop', () => {
    const rows = days(28, 2300, -0.01);
    rows[17]!.weight.weightKg -= 1.5;
    const result = estimate(rows);
    expect(result.tdeeKcal).toBeGreaterThan(result.formulaPriorKcal * 0.7);
    expect(result.tdeeKcal).toBeLessThan(result.formulaPriorKcal * 1.3);
  });
});
