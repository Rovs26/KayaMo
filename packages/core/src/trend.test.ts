import { describe, expect, it } from 'vitest';
import { computeWeightTrend } from './trend';

describe('computeWeightTrend', () => {
  it('smooths a one-day water-weight whoosh', () => {
    const trend = computeWeightTrend([
      { date: '2026-01-01', weightKg: 80 },
      { date: '2026-01-02', weightKg: 79.9 },
      { date: '2026-01-03', weightKg: 78.4 },
      { date: '2026-01-04', weightKg: 79.8 },
    ]);
    expect(trend[2]!.trendWeightKg).toBeGreaterThan(79.7);
    expect(trend.at(-1)!.trendWeightKg).toBeGreaterThan(79.7);
  });

  it('uses elapsed time when weigh-ins are sparse', () => {
    const trend = computeWeightTrend([
      { date: '2026-01-01', weightKg: 80 },
      { date: '2026-01-15', weightKg: 79 },
    ]);
    expect(trend.at(-1)!.trendWeightKg).toBeLessThan(79.4);
  });
});
