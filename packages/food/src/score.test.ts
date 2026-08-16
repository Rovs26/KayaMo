import { describe, expect, it } from 'vitest';
import { affinityBoost, rankScore, shouldAutoPick, SOURCE_PRIORITY } from './score';

describe('scoring', () => {
  it('gives never-logged foods a 1.00 affinity and caps at 1.20', () => {
    expect(affinityBoost(0)).toBe(1);
    expect(affinityBoost(20)).toBeCloseTo(1.2, 10);
    expect(affinityBoost(100)).toBeCloseTo(1.2, 10);
  });

  it('ranks PH core exact alias above USDA cache', () => {
    const ph = rankScore({ source: 'ph_core', matchScore: 1, timesLogged: 0 });
    const cache = rankScore({
      source: 'usda_fdc',
      matchScore: 1,
      timesLogged: 0,
      fromCache: true,
    });
    expect(ph).toBeCloseTo(SOURCE_PRIORITY.ph_core, 10);
    expect(ph).toBeGreaterThan(cache);
  });

  it('auto-picks only when the top is strong and twice the runner-up', () => {
    expect(shouldAutoPick([{ rankScore: 0.95 }])).toBe(true);
    expect(shouldAutoPick([{ rankScore: 0.95 }, { rankScore: 0.4 }])).toBe(true);
    expect(shouldAutoPick([{ rankScore: 0.95 }, { rankScore: 0.5 }])).toBe(false);
    expect(shouldAutoPick([{ rankScore: 0.8 }])).toBe(false);
  });
});
