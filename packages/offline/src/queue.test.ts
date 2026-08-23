import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enqueueUpsert, pendingCount } from './queue';
import { getOfflineDb, resetOfflineDb } from './db';
import { logFoodEntry, saveMealTemplate } from './writes';

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

describe('sync queue idempotency', () => {
  beforeEach(async () => {
    await resetOfflineDb();
  });

  afterEach(async () => {
    await resetOfflineDb();
  });

  it('replaces the queue row when the same entity is written twice', async () => {
    const payload = {
      id: 'entry-1',
      kcal: '100',
      updated_at: '2026-08-16T04:00:00.000Z',
    };
    await enqueueUpsert('food_entries', 'entry-1', payload);
    await enqueueUpsert('food_entries', 'entry-1', { ...payload, kcal: '120' });

    expect(await pendingCount()).toBe(1);
    expect(await getOfflineDb().companion_events.count()).toBe(0);
    const item = await getOfflineDb().sync_queue.get('food_entries:entry-1');
    expect(item?.payload.kcal).toBe('120');
  });

  it('writes Dexie immediately when logging a meal', async () => {
    const entry = await logFoodEntry({
      userId: 'user-1',
      mealSlot: 'tanghalian',
      foodId: 'food-1',
      foodName: 'Kanin',
      quantity: '1',
      grams: '200',
      kcal: '260',
      protein_g: '5.4',
      carbs_g: '56.4',
      fat_g: '0.6',
      fiber_g: '0.8',
      sugar_g: '0.2',
      sodium_mg: '2',
      source: 'ph_core',
      resolvedVia: 'ph_core',
      inputMethod: 'quick',
      servingLabel: '1 tasa',
    });

    const stored = await getOfflineDb().food_entries.get(entry.id);
    expect(stored?.food_name_snapshot).toBe('Kanin');
    expect(await pendingCount()).toBe(2);
    expect(await getOfflineDb().companion_events.count()).toBe(1);
  });

  it('stores a meal template in Dexie and the sync queue', async () => {
    const template = await saveMealTemplate({
      userId: 'user-1',
      name: 'Baon',
      items: [
        {
          foodId: 'food-1',
          foodName: 'Kanin',
          quantity: '1',
          grams: '200',
          servingId: 's1',
          servingLabel: '1 tasa',
          kcal: '260',
          protein_g: '5',
          carbs_g: '56',
          fat_g: '0.6',
          fiber_g: '0.8',
          sugar_g: '0.2',
          sodium_mg: '2',
          source: 'ph_core',
          resolvedVia: 'ph_core',
          confidence: '0.90',
        },
      ],
    });
    const stored = await getOfflineDb().meal_templates.get(template.id);
    expect(stored?.name).toBe('Baon');
    expect(await pendingCount()).toBe(1);
  });
});
