export function fromNumericString(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string' || value.trim() === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toNutrientString(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const n = Math.abs(value) < 1e-12 ? 0 : value;
  return trimNumeric(n.toFixed(4));
}

export function toConfidenceString(value: number): string {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped.toFixed(2);
}

export type NutrientSnapshot = {
  kcal: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  fiber_g: string;
  sugar_g: string;
  sodium_mg: string;
};

export function scaleNutrientSnapshot(per100: NutrientSnapshot, grams: number): NutrientSnapshot {
  const factor = grams / 100;
  return {
    kcal: toNutrientString(fromNumericString(per100.kcal) * factor),
    protein_g: toNutrientString(fromNumericString(per100.protein_g) * factor),
    carbs_g: toNutrientString(fromNumericString(per100.carbs_g) * factor),
    fat_g: toNutrientString(fromNumericString(per100.fat_g) * factor),
    fiber_g: toNutrientString(fromNumericString(per100.fiber_g) * factor),
    sugar_g: toNutrientString(fromNumericString(per100.sugar_g) * factor),
    sodium_mg: toNutrientString(fromNumericString(per100.sodium_mg) * factor),
  };
}

export function rescaleNutrientSnapshot(
  snapshot: NutrientSnapshot,
  fromGrams: number,
  toGrams: number,
): NutrientSnapshot {
  const from = fromGrams > 0 ? fromGrams : 100;
  return scaleNutrientSnapshot(snapshot, (toGrams * 100) / from);
}

function trimNumeric(value: string): string {
  if (!value.includes('.')) return value;
  return value.replace(/\.?0+$/, '') || '0';
}
