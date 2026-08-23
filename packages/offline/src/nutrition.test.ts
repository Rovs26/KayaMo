import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getOfflineDb, resetOfflineDb } from './db';
import {
  listLocalWeightLogs,
  logFoodEntry,
  logWeight,
  mergeRemoteWeightLogs,
  recomputeLocalLogicalDates,
  tombstoneLocalWeightLog,
} from './writes';

vi.mock('./sync', async () => {
  const status = await import('./status');
  return {
    drainQueue: vi.fn(async () => undefined),
    startSync: vi.fn(),
    getSyncStatusSnapshot: vi.fn(() => ({ kind: 'synced' })),
    bindStatusStore: status.subscribeSyncStatus,
    resumeSync: vi.fn(),
  };
});

describe('offline nutrition and weight', () => {
  beforeEach(resetOfflineDb);
  afterEach(resetOfflineDb);

  it('preserves the write-time logical date for backfilled food and weight', async () => {
    const loggedAt = '2026-08-22T20:30:00.000Z';
    const food = await logFoodEntry({
      userId: 'user-1',
      mealSlot: 'hapunan',
      foodId: 'food-1',
      foodName: 'Kanin',
      quantity: '1',
      grams: '100',
      kcal: '130',
      protein_g: '2.7',
      carbs_g: '28.2',
      fat_g: '0.3',
      fiber_g: '0.4',
      sugar_g: '0.1',
      sodium_mg: '1',
      source: 'ph_core',
      resolvedVia: 'ph_core',
      inputMethod: 'quick',
      loggedAt,
      timeZone: 'Asia/Manila',
      dayStartsAt: '05:00:00',
    });
    const weight = await logWeight({
      userId: 'user-1',
      weightKg: '70',
      source: 'manual',
      loggedAt,
      timeZone: 'Asia/Manila',
      dayStartsAt: '05:00:00',
    });
    expect(food.logical_date).toBe('2026-08-22');
    expect(weight.logical_date).toBe('2026-08-22');
    expect(weight.measured_on).toBe('2026-08-22');
  });

  it('rejects invalid health values before they enter Dexie or the sync queue', async () => {
    await expect(
      logWeight({ userId: 'user-1', weightKg: '-1', source: 'manual' }),
    ).rejects.toThrow('outside the allowed range');
    expect(await getOfflineDb().weight_logs.count()).toBe(0);
    expect(await getOfflineDb().sync_queue.count()).toBe(0);
  });

  it('keeps a tombstoned weight deleted after a stale sync round-trip', async () => {
    const live = await logWeight({
      userId: 'user-1',
      weightKg: '70',
      source: 'manual',
      loggedAt: '2026-08-22T08:00:00.000Z',
    });
    await tombstoneLocalWeightLog({ id: live.id, userId: 'user-1' });
    const tombstone = await getOfflineDb().weight_logs.get(live.id);
    const staleUpdatedAt = new Date(
      new Date(tombstone!.updated_at).getTime() - 1,
    ).toISOString();
    await mergeRemoteWeightLogs([
      {
        ...live,
        weight_kg: '71',
        updated_at: staleUpdatedAt,
        deleted_at: null,
      },
    ]);
    expect(await listLocalWeightLogs('user-1')).toEqual([]);
    expect((await getOfflineDb().weight_logs.get(live.id))?.deleted_at).toBeTruthy();
  });

  it('changes historical buckets only through the explicit recompute operation', async () => {
    const weight = await logWeight({
      userId: 'user-1',
      weightKg: '70',
      source: 'manual',
      loggedAt: '2026-08-22T20:30:00.000Z',
      timeZone: 'Asia/Manila',
      dayStartsAt: '00:00:00',
    });
    expect(weight.logical_date).toBe('2026-08-23');
    const result = await recomputeLocalLogicalDates({
      userId: 'user-1',
      timeZone: 'Asia/Manila',
      dayStartsAt: '05:00:00',
    });
    expect(result.weight_logs).toBe(1);
    expect((await getOfflineDb().weight_logs.get(weight.id))?.logical_date).toBe(
      '2026-08-22',
    );
  });
});
