import { describe, expect, it } from 'vitest';
import {
  asLocale,
  mealSlotAtHour,
  mealSlotLabel,
  MEAL_SLOTS,
  orderedMealSlots,
  shiftLogicalDate,
} from './meal-slot';
import {
  entriesOnLogicalDate,
  lastMealSlotEntries,
  rankQuickLogFoods,
  type QuickLogHistoryEntry,
} from './quick-log';
import { sortServingsPhFirst } from './portion';
import { scaleNutrientSnapshot } from './numeric';

function entry(
  overrides: Partial<QuickLogHistoryEntry> & Pick<QuickLogHistoryEntry, 'foodId' | 'name' | 'localHour' | 'loggedAtMs'>,
): QuickLogHistoryEntry {
  return {
    mealSlot: 'almusal',
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
    ...overrides,
  };
}

describe('mealSlotAtHour', () => {
  it('maps a PH day onto almusal, tanghalian, meryenda, hapunan', () => {
    expect(mealSlotAtHour(7)).toBe('almusal');
    expect(mealSlotAtHour(12)).toBe('tanghalian');
    expect(mealSlotAtHour(16)).toBe('meryenda');
    expect(mealSlotAtHour(19)).toBe('hapunan');
    expect(mealSlotAtHour(2)).toBe('hapunan');
  });

  it('labels slots in Filipino', () => {
    expect(mealSlotLabel('almusal')).toBe('Almusal');
  });

  it('keeps Filipino meal names for taglish and defaults to taglish', () => {
    for (const slot of MEAL_SLOTS) {
      expect(mealSlotLabel(slot, 'taglish')).toBe(mealSlotLabel(slot, 'fil'));
      expect(mealSlotLabel(slot)).toBe(mealSlotLabel(slot, 'taglish'));
    }
  });

  it('labels slots in English only for the en locale', () => {
    expect(mealSlotLabel('almusal', 'en')).toBe('Breakfast');
    expect(mealSlotLabel('tanghalian', 'en')).toBe('Lunch');
    expect(mealSlotLabel('meryenda', 'en')).toBe('Snack');
    expect(mealSlotLabel('hapunan', 'en')).toBe('Dinner');
  });

  it('falls back to taglish for an unknown profile locale', () => {
    expect(asLocale('es')).toBe('taglish');
    expect(asLocale(null)).toBe('taglish');
    expect(asLocale('en')).toBe('en');
  });

  it('orders slots so snacks sit between lunch and dinner', () => {
    expect(orderedMealSlots()).toEqual(['almusal', 'tanghalian', 'meryenda', 'hapunan']);
  });
});

describe('rankQuickLogFoods', () => {
  const now = Date.parse('2026-08-17T00:00:00.000Z');

  it('ranks frequency at this hour times recency', () => {
    const kanin = [0, 1, 2].map((i) =>
      entry({
        foodId: 'kanin',
        name: 'Kanin',
        localHour: 7,
        loggedAtMs: now - i * 86_400_000,
      }),
    );
    const itlog = [0, 1, 2, 3, 4].map((i) =>
      entry({
        foodId: 'itlog',
        name: 'Itlog',
        localHour: 9,
        loggedAtMs: now - i * 86_400_000,
      }),
    );
    const ranked = rankQuickLogFoods([...kanin, ...itlog], {
      mealSlot: 'almusal',
      hour: 7,
      nowMs: now,
    });
    expect(ranked[0]?.foodId).toBe('kanin');
    expect(ranked[0]?.hourFrequency).toBe(3);
    expect(ranked[1]?.foodId).toBe('itlog');
  });

  it('decays stale foods even if they were frequent', () => {
    const stale = entry({
      foodId: 'stale',
      name: 'Stale',
      localHour: 7,
      loggedAtMs: now - 60 * 86_400_000,
    });
    const recent = entry({
      foodId: 'recent',
      name: 'Recent',
      localHour: 7,
      loggedAtMs: now,
    });
    const ranked = rankQuickLogFoods([stale, stale, stale, recent], {
      mealSlot: 'almusal',
      hour: 7,
      nowMs: now,
    });
    expect(ranked[0]?.foodId).toBe('recent');
  });

  it('uses the last-used serving for one-tap log', () => {
    const older = entry({
      foodId: 'kanin',
      name: 'Kanin',
      localHour: 7,
      loggedAtMs: now - 86_400_000,
      quantity: '1',
      servingLabel: '1 tasa',
    });
    const newer = entry({
      foodId: 'kanin',
      name: 'Kanin',
      localHour: 7,
      loggedAtMs: now,
      quantity: '2',
      servingLabel: '2 tasa',
      grams: '400',
    });
    const ranked = rankQuickLogFoods([older, newer], {
      mealSlot: 'almusal',
      hour: 7,
      nowMs: now,
    });
    expect(ranked[0]?.quantity).toBe('2');
    expect(ranked[0]?.servingLabel).toBe('2 tasa');
  });
});

describe('repeat helpers', () => {
  const now = Date.parse('2026-08-17T00:00:00.000Z');
  const logicalDateOf = (ms: number) => {
    if (ms >= now) return '2026-08-17';
    if (ms >= now - 86_400_000) return '2026-08-16';
    return '2026-08-15';
  };

  it('copies yesterday and the last prior meal slot', () => {
    const yesterday = entry({
      foodId: 'kanin',
      name: 'Kanin',
      localHour: 7,
      loggedAtMs: now - 86_400_000,
    });
    const older = entry({
      foodId: 'itlog',
      name: 'Itlog',
      localHour: 7,
      loggedAtMs: now - 2 * 86_400_000,
    });
    const today = entry({
      foodId: 'kape',
      name: 'Kape',
      localHour: 7,
      loggedAtMs: now,
    });
    expect(entriesOnLogicalDate([yesterday, older, today], '2026-08-16', logicalDateOf).map((e) => e.foodId)).toEqual([
      'kanin',
    ]);
    expect(
      lastMealSlotEntries([yesterday, older, today], 'almusal', '2026-08-17', logicalDateOf).map((e) => e.foodId),
    ).toEqual(['kanin']);
  });
});

describe('sortServingsPhFirst', () => {
  it('puts tasa ahead of grams', () => {
    const sorted = sortServingsPhFirst([
      { label: '100 g' },
      { label: '1 tasa' },
      { label: '1 piraso' },
    ]);
    expect(sorted.map((s) => s.label)).toEqual(['1 tasa', '1 piraso', '100 g']);
  });
});

describe('scaleNutrientSnapshot', () => {
  it('scales a 100 g snapshot to the logged grams', () => {
    const scaled = scaleNutrientSnapshot(
      {
        kcal: '130',
        protein_g: '2.7',
        carbs_g: '28',
        fat_g: '0.3',
        fiber_g: '0.4',
        sugar_g: '0.1',
        sodium_mg: '1',
      },
      200,
    );
    expect(Number(scaled.kcal)).toBeCloseTo(260, 5);
  });
});

describe('shiftLogicalDate', () => {
  it('steps calendar dates without UTC off-by-one', () => {
    expect(shiftLogicalDate('2026-08-17', -1)).toBe('2026-08-16');
    expect(shiftLogicalDate('2026-03-01', -1)).toBe('2026-02-28');
  });
});
