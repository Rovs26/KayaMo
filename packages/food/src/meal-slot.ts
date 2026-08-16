export const MEAL_SLOTS = ['almusal', 'tanghalian', 'meryenda', 'hapunan'] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

const LABELS: Record<MealSlot, string> = {
  almusal: 'Almusal',
  tanghalian: 'Tanghalian',
  meryenda: 'Meryenda',
  hapunan: 'Hapunan',
};

/** Local clock hour 0–23 in the user's timezone. Independent of day_starts_at. */
export function mealSlotAtHour(hour: number): MealSlot {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h >= 5 && h < 11) return 'almusal';
  if (h >= 11 && h < 15) return 'tanghalian';
  if (h >= 15 && h < 18) return 'meryenda';
  return 'hapunan';
}

export function mealSlotLabel(slot: MealSlot): string {
  return LABELS[slot];
}

export function isMealSlot(value: string): value is MealSlot {
  return (MEAL_SLOTS as readonly string[]).includes(value);
}

export function shiftLogicalDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const shifted = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days));
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
