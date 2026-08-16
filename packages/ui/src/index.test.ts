import { describe, expect, it } from 'vitest';
import { PACKAGE } from './index';
import {
  DEFAULT_RIBBON_GEOM,
  ribbonDomain,
  scaleY,
  trendBandPath,
  weeklyRateKg,
  type RibbonPoint,
} from './ribbon';

describe('@kayamo/ui', () => {
  it('loads', () => {
    expect(PACKAGE).toBe('@kayamo/ui');
  });
});

const series: RibbonPoint[] = [
  { date: '2026-08-01', weight: 73.4, trend: 73.2 },
  { date: '2026-08-08', weight: 72.1, trend: 72.6 },
];

describe('ribbonDomain', () => {
  it('does not squash the band when the target sits far below the series', () => {
    const domain = ribbonDomain(series, 70);
    expect(domain.min).toBeGreaterThan(70.5);
    expect(domain.max).toBeGreaterThan(73.4);
  });

  it('includes a nearby target in the domain', () => {
    const domain = ribbonDomain(series, 72.0);
    expect(domain.min).toBeLessThan(72.0);
  });
});

describe('scaleY', () => {
  it('puts higher weight nearer the top of the viewBox', () => {
    const domain = { min: 70, max: 74 };
    const high = scaleY(74, domain, DEFAULT_RIBBON_GEOM);
    const low = scaleY(70, domain, DEFAULT_RIBBON_GEOM);
    expect(high).toBeLessThan(low);
  });
});

describe('trendBandPath', () => {
  it('closes the band to the floor', () => {
    const path = trendBandPath(
      [73.2, 72.6],
      { min: 70, max: 74 },
      DEFAULT_RIBBON_GEOM,
    );
    expect(path.startsWith('M')).toBe(true);
    expect(path.endsWith('Z')).toBe(true);
  });
});

describe('weeklyRateKg', () => {
  it('returns kg per week from trend endpoints', () => {
    const rate = weeklyRateKg(series);
    expect(rate).not.toBeNull();
    expect(rate ?? 0).toBeCloseTo(-0.6, 5);
  });
});
