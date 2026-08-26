import { describe, expect, it } from 'vitest';
import type { LocalFoodEntry } from '@kayamo/offline';
import { filterFoodHistory, foodHistorySince } from './filter-food-history';

function entry(partial: Pick<LocalFoodEntry, 'id' | 'logical_date' | 'meal_slot' | 'food_name_snapshot' | 'logged_at'>): LocalFoodEntry {
  return {
    user_id: 'u1',
    food_id: 'f1',
    recipe_id: null,
    quantity: '1',
    serving_id: null,
    grams: '100',
    kcal: '120',
    protein_g: '4',
    carbs_g: '20',
    fat_g: '2',
    fiber_g: '1',
    sugar_g: '0',
    sodium_mg: '10',
    source: 'ph_core',
    confidence: '0.9',
    input_method: 'search',
    photo_url: null,
    raw_input: null,
    serving_label_snapshot: '1 cup',
    resolved_via: 'ph_core',
    created_at: partial.logged_at,
    updated_at: partial.logged_at,
    server_updated_at: partial.logged_at,
    deleted_at: null,
    ...partial,
  };
}

describe('foodHistorySince', () => {
  it('defaults the week view to seven inclusive days', () => {
    expect(foodHistorySince('2026-08-26', 'week')).toBe('2026-08-20');
  });
});

describe('filterFoodHistory', () => {
  const rows = [
    entry({
      id: 'old',
      logical_date: '2026-08-01',
      meal_slot: 'almusal',
      food_name_snapshot: 'Kanin',
      logged_at: '2026-08-01T00:00:00.000Z',
    }),
    entry({
      id: 'new',
      logical_date: '2026-08-26',
      meal_slot: 'hapunan',
      food_name_snapshot: 'Adobo',
      logged_at: '2026-08-26T10:00:00.000Z',
    }),
  ];

  it('keeps the week window and name filter', () => {
    const filtered = filterFoodHistory(rows, {
      query: 'ado',
      slot: 'all',
      since: foodHistorySince('2026-08-26', 'week'),
    });
    expect(filtered.map((row) => row.id)).toEqual(['new']);
  });
});
