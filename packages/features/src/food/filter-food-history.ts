import { asMealSlot, shiftLogicalDate, type MealSlot } from '@kayamo/food/quick-log';
import type { LocalFoodEntry } from '@kayamo/offline';

export type FoodHistoryRange = 'week' | 'month' | 'all';

export function foodHistorySince(todayLogical: string, range: FoodHistoryRange): string | null {
  if (range === 'week') return shiftLogicalDate(todayLogical, -6);
  if (range === 'month') return shiftLogicalDate(todayLogical, -29);
  return null;
}

export function filterFoodHistory(
  rows: readonly LocalFoodEntry[],
  params: { query: string; slot: MealSlot | 'all'; since: string | null },
): LocalFoodEntry[] {
  const query = params.query.trim().toLowerCase();
  return rows
    .filter((row) => {
      if (params.since && row.logical_date < params.since) return false;
      if (params.slot !== 'all' && asMealSlot(row.meal_slot) !== params.slot) return false;
      if (query && !row.food_name_snapshot.toLowerCase().includes(query)) return false;
      return true;
    })
    .sort((a, b) => b.logged_at.localeCompare(a.logged_at));
}
