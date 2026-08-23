import type { MealSlot } from './meal-slot';
import type { NutrientSnapshot } from './numeric';

export {
  mealSlotAtHour,
  mealSlotLabel,
  MEAL_SLOTS,
  LOCALES,
  DEFAULT_LOCALE,
  shiftLogicalDate,
  isMealSlot,
  isLocale,
  asLocale,
  asMealSlot,
  orderedMealSlots,
} from './meal-slot';
export type { MealSlot, Locale } from './meal-slot';
export { scaleNutrientSnapshot, rescaleNutrientSnapshot, type NutrientSnapshot } from './numeric';
export { defaultServing, sortServingsPhFirst } from './portion';

const RECENCY_TAU_DAYS = 14;
export const QUICK_LOG_LIMIT = 8;

export type QuickLogHistoryEntry = NutrientSnapshot & {
  foodId: string;
  name: string;
  mealSlot: MealSlot;
  loggedAtMs: number;
  localHour: number;
  quantity: string;
  grams: string;
  servingId: string | null;
  servingLabel: string | null;
  source: string;
  resolvedVia: string;
  confidence: string;
};

export type QuickLogCandidate = NutrientSnapshot & {
  foodId: string;
  name: string;
  score: number;
  hourFrequency: number;
  recency: number;
  quantity: string;
  grams: string;
  servingId: string | null;
  servingLabel: string | null;
  source: string;
  resolvedVia: string;
  confidence: string;
};

/**
 * Rank foods for the current meal slot: (frequency at this hour + 0.25 × slot
 * frequency) × exponential recency. Last-used serving wins for one-tap log.
 */
export function rankQuickLogFoods(
  entries: readonly QuickLogHistoryEntry[],
  input: { mealSlot: MealSlot; hour: number; nowMs: number; limit?: number },
): QuickLogCandidate[] {
  const limit = input.limit ?? QUICK_LOG_LIMIT;
  const groups = new Map<string, QuickLogHistoryEntry[]>();
  for (const entry of entries) {
    if (entry.mealSlot !== input.mealSlot || !entry.foodId) continue;
    const list = groups.get(entry.foodId) ?? [];
    list.push(entry);
    groups.set(entry.foodId, list);
  }

  const ranked: QuickLogCandidate[] = [];
  for (const group of groups.values()) {
    const last = group.reduce((a, b) => (a.loggedAtMs >= b.loggedAtMs ? a : b));
    const hourFrequency = group.filter((row) => row.localHour === input.hour).length;
    const daysAgo = Math.max(0, (input.nowMs - last.loggedAtMs) / 86_400_000);
    const recency = Math.exp(-daysAgo / RECENCY_TAU_DAYS);
    const score = (hourFrequency + 0.25 * group.length) * recency;
    ranked.push({
      foodId: last.foodId,
      name: last.name,
      score,
      hourFrequency,
      recency,
      quantity: last.quantity,
      grams: last.grams,
      servingId: last.servingId,
      servingLabel: last.servingLabel,
      kcal: last.kcal,
      protein_g: last.protein_g,
      carbs_g: last.carbs_g,
      fat_g: last.fat_g,
      fiber_g: last.fiber_g,
      sugar_g: last.sugar_g,
      sodium_mg: last.sodium_mg,
      source: last.source,
      resolvedVia: last.resolvedVia,
      confidence: last.confidence,
    });
  }

  ranked.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return ranked.slice(0, limit);
}

export function lastMealSlotEntries(
  entries: readonly QuickLogHistoryEntry[],
  mealSlot: MealSlot,
  todayLogicalDate: string,
  logicalDateOf: (loggedAtMs: number) => string,
): QuickLogHistoryEntry[] {
  const byDate = new Map<string, QuickLogHistoryEntry[]>();
  for (const entry of entries) {
    if (entry.mealSlot !== mealSlot) continue;
    const date = logicalDateOf(entry.loggedAtMs);
    if (date >= todayLogicalDate) continue;
    const list = byDate.get(date) ?? [];
    list.push(entry);
    byDate.set(date, list);
  }
  const dates = [...byDate.keys()].sort();
  const lastDate = dates[dates.length - 1];
  if (!lastDate) return [];
  return (byDate.get(lastDate) ?? []).sort((a, b) => a.loggedAtMs - b.loggedAtMs);
}

export function entriesOnLogicalDate(
  entries: readonly QuickLogHistoryEntry[],
  logicalDate: string,
  logicalDateOf: (loggedAtMs: number) => string,
): QuickLogHistoryEntry[] {
  return entries
    .filter((entry) => logicalDateOf(entry.loggedAtMs) === logicalDate)
    .sort((a, b) => a.loggedAtMs - b.loggedAtMs);
}