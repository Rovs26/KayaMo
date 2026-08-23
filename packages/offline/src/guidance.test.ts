import type { GuidanceSnapshot } from '@kayamo/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { getOfflineDb, resetOfflineDb } from './db';
import {
  cacheGuidanceSnapshot,
  clearCachedGuidanceSnapshot,
  getCachedGuidanceSnapshot,
} from './guidance';
import { pendingCount } from './queue';

const USER = '11111111-1111-4111-8111-111111111111';

function snapshot(overrides: Partial<GuidanceSnapshot> = {}): GuidanceSnapshot {
  return {
    date: '2026-08-22',
    profile: {
      complete: true,
      missing: [],
      sex: 'male',
      goal: 'lose',
      locale: 'taglish',
      timezone: 'Asia/Manila',
      dayStartsAt: '04:00:00',
    },
    expenditure: {
      date: '2026-08-22',
      tdeeKcal: 2540,
      ciLow: 2380,
      ciHigh: 2700,
      method: 'blended',
      confidence: 0.62,
      daysOfData: 18,
    },
    targets: [
      {
        dayType: 'rest',
        effectiveFrom: '2026-08-22',
        kcal: 2124,
        proteinG: 157,
        carbsG: 251,
        fatG: 55,
        clamped: false,
        clampReasons: [],
        weeklyRatePercent: 0.6,
        confidence: 0.62,
      },
    ],
    ...overrides,
  };
}

describe('guidance cache', () => {
  beforeEach(async () => {
    await resetOfflineDb();
  });

  it('round-trips a snapshot for the user', async () => {
    await cacheGuidanceSnapshot(USER, snapshot());
    const cached = await getCachedGuidanceSnapshot(USER);
    expect(cached?.snapshot.targets[0]?.kcal).toBe(2124);
    expect(cached?.snapshot.expenditure?.tdeeKcal).toBe(2540);
    expect(cached?.cached_at).toBeTruthy();
  });

  it('replaces the snapshot whole rather than merging', async () => {
    await cacheGuidanceSnapshot(USER, snapshot());
    await cacheGuidanceSnapshot(USER, snapshot({ targets: [], expenditure: null }));
    const cached = await getCachedGuidanceSnapshot(USER);
    expect(cached?.snapshot.targets).toEqual([]);
    expect(cached?.snapshot.expenditure).toBeNull();
  });

  it('never enqueues guidance for sync', async () => {
    await cacheGuidanceSnapshot(USER, snapshot());
    expect(await pendingCount()).toBe(0);
  });

  it('returns null for an unknown user and after clearing', async () => {
    expect(await getCachedGuidanceSnapshot(USER)).toBeNull();
    await cacheGuidanceSnapshot(USER, snapshot());
    await clearCachedGuidanceSnapshot(USER);
    expect(await getCachedGuidanceSnapshot(USER)).toBeNull();
  });

  it('keeps snapshots separate per user', async () => {
    const other = '22222222-2222-4222-8222-222222222222';
    await cacheGuidanceSnapshot(USER, snapshot());
    await cacheGuidanceSnapshot(other, snapshot({ date: '2026-08-23' }));
    expect((await getCachedGuidanceSnapshot(USER))?.snapshot.date).toBe('2026-08-22');
    expect((await getCachedGuidanceSnapshot(other))?.snapshot.date).toBe('2026-08-23');
    expect(await getOfflineDb().guidance_snapshots.count()).toBe(2);
  });
});
