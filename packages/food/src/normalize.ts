import type { FoodServing, NormalizedFood, NutrientsPer100g } from './types';

const GRAMS_PER_UNIT: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  mg: 0.001,
  milligram: 0.001,
  milligrams: 0.001,
  oz: 28.3495,
  ounce: 28.3495,
  ounces: 28.3495,
  lb: 453.592,
  pound: 453.592,
  pounds: 453.592,
  ml: 1,
  milliliter: 1,
  milliliters: 1,
  millilitre: 1,
  millilitres: 1,
  l: 1000,
  liter: 1000,
  liters: 1000,
  litre: 1000,
  litres: 1000,
  floz: 29.5735,
  'fl oz': 29.5735,
};

const KJ_PER_KCAL = 4.184;

export function kjToKcal(kj: number): number {
  return kj / KJ_PER_KCAL;
}

export function toGrams(value: number, unit: string): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const key = unit.trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ');
  const factor = GRAMS_PER_UNIT[key];
  if (factor === undefined) return null;
  return value * factor;
}

export function parseGramsFromText(text: string): number | null {
  const match = text.trim().match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z].*)$/);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2] ?? '';
  return toGrams(value, unit);
}

export function perServingToPer100g(
  perServing: NutrientsPer100g,
  servingGrams: number,
): NutrientsPer100g {
  if (!Number.isFinite(servingGrams) || servingGrams <= 0) {
    throw new Error('servingGrams must be a positive number');
  }
  const factor = 100 / servingGrams;
  return {
    kcal: perServing.kcal * factor,
    protein_g: perServing.protein_g * factor,
    carbs_g: perServing.carbs_g * factor,
    fat_g: perServing.fat_g * factor,
    fiber_g: perServing.fiber_g * factor,
    sugar_g: perServing.sugar_g * factor,
    sodium_mg: perServing.sodium_mg * factor,
  };
}

export function normalizeName(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeBarcode(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 14 ? digits : undefined;
}

export function displayName(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return trimmed;
  const letters = trimmed.replace(/[^A-Za-z]/g, '');
  if (letters.length > 0 && letters === letters.toUpperCase()) {
    return trimmed.toLowerCase().replace(/\b[a-z]/g, (ch) => ch.toUpperCase());
  }
  return trimmed;
}

export function firstBrand(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const first = value.split(',')[0]?.trim();
  return first ? displayName(first) : undefined;
}

export function looksLikeBarcode(query: string): boolean {
  return Boolean(normalizeBarcode(query.trim()));
}

export function dedupeKey(food: Pick<NormalizedFood, 'name' | 'brand' | 'barcode'>): string {
  const barcode = normalizeBarcode(food.barcode);
  if (barcode) return `b:${barcode}`;
  return `n:${normalizeName(food.name)}|${normalizeName(food.brand ?? '')}`;
}

export function withDefaultServings(servings: FoodServing[]): FoodServing[] {
  const list = servings
    .filter((serving) => serving.grams > 0 && serving.label.trim().length > 0)
    .map((serving) => ({
      label: serving.label.trim(),
      grams: serving.grams,
      isDefault: serving.isDefault,
    }));

  if (!list.some((serving) => Math.abs(serving.grams - 100) < 0.05)) {
    list.push({ label: '100 g', grams: 100, isDefault: false });
  }

  if (!list.some((serving) => serving.isDefault)) {
    const preferred = list.find((serving) => serving.label !== '100 g') ?? list[0];
    if (preferred) preferred.isDefault = true;
  }

  const seen = new Set<string>();
  return list.filter((serving) => {
    const key = serving.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function compareCandidates(a: NormalizedFood, b: NormalizedFood): number {
  if (b.confidence !== a.confidence) return b.confidence - a.confidence;
  return a.name.localeCompare(b.name);
}

export function mergeCandidates(foods: NormalizedFood[]): NormalizedFood[] {
  const groups = new Map<string, NormalizedFood[]>();
  for (const food of foods) {
    const key = dedupeKey(food);
    const group = groups.get(key);
    if (group) group.push(food);
    else groups.set(key, [food]);
  }

  const merged: NormalizedFood[] = [];
  for (const group of groups.values()) {
    group.sort(compareCandidates);
    const winner = group[0];
    if (winner) merged.push(winner);
  }
  merged.sort(compareCandidates);
  return merged;
}
