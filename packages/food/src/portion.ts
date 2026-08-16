import { toGrams } from './normalize';
import { SIZE_MULTIPLIER, type ParsedFoodQuery } from './query-parse';
import type { FoodServing } from './types';

const UNIT_HINTS: Record<string, string[]> = {
  tasa: ['tasa', 'cup', 'cups'],
  cup: ['tasa', 'cup', 'cups'],
  cups: ['tasa', 'cup', 'cups'],
  piraso: ['piraso', 'piece', 'pieces', 'pc', 'pcs'],
  piece: ['piraso', 'piece', 'pieces', 'pc', 'pcs'],
  pieces: ['piraso', 'piece', 'pieces', 'pc', 'pcs'],
  pc: ['piraso', 'piece', 'pieces', 'pc', 'pcs'],
  pcs: ['piraso', 'piece', 'pieces', 'pc', 'pcs'],
  order: ['order'],
  hiwa: ['hiwa', 'slice'],
  kutsara: ['kutsara', 'tablespoon', 'tablespoons', 'tbsp'],
  tablespoon: ['kutsara', 'tablespoon', 'tablespoons', 'tbsp'],
  tablespoons: ['kutsara', 'tablespoon', 'tablespoons', 'tbsp'],
  tbsp: ['kutsara', 'tablespoon', 'tablespoons', 'tbsp'],
  bowl: ['bowl'],
};

export type ResolvedPortion = {
  amount: number;
  unit: string;
  grams: number;
  servingLabel: string;
  kcal: number;
};

const PH_SERVING_RANK = ['tasa', 'piraso', 'order', 'hiwa', 'kutsara', 'bowl'] as const;

function servingRank(label: string): number {
  const tokens = label.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const phIndex = PH_SERVING_RANK.findIndex((unit) => {
    const hints = UNIT_HINTS[unit] ?? [unit];
    return hints.some((hint) => tokens.includes(hint));
  });
  if (phIndex >= 0) return phIndex;
  if (tokens.includes('g') || tokens.includes('gram') || tokens.includes('grams')) {
    return PH_SERVING_RANK.length + 1;
  }
  return PH_SERVING_RANK.length;
}

/** PH-native units first (tasa, piraso, order, hiwa, kutsara, bowl), grams last. */
export function sortServingsPhFirst<T extends { label: string }>(servings: readonly T[]): T[] {
  return servings
    .map((serving, index) => ({ serving, index, rank: servingRank(serving.label) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((row) => row.serving);
}

export function defaultServing(servings: FoodServing[]): FoodServing {
  return (
    servings.find((serving) => serving.isDefault) ??
    servings[0] ?? { label: '100 g', grams: 100, isDefault: true }
  );
}

export function pickServing(unit: string | undefined, servings: FoodServing[]): FoodServing {
  if (!unit) return defaultServing(servings);
  const hints = UNIT_HINTS[unit] ?? [unit];
  const hit = servings.find((serving) => {
    const tokens = serving.label.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    return hints.some((hint) => tokens.includes(hint));
  });
  return hit ?? defaultServing(servings);
}

export function resolvePortion(
  parsed: ParsedFoodQuery,
  servings: FoodServing[],
  kcalPer100g: number,
): ResolvedPortion {
  const unit = parsed.unit;
  const sizeMul = parsed.size ? SIZE_MULTIPLIER[parsed.size] : 1;
  const massGrams = unit ? toGrams(parsed.amount, unit) : null;
  if (massGrams !== null) {
    const grams = massGrams * sizeMul;
    return {
      amount: parsed.amount,
      unit: unit ?? 'g',
      grams,
      servingLabel: `${parsed.amount} ${unit}`,
      kcal: (kcalPer100g * grams) / 100,
    };
  }

  const serving = pickServing(unit, servings);
  const grams = serving.grams * parsed.amount * sizeMul;
  return {
    amount: parsed.amount,
    unit: unit ?? serving.label,
    grams,
    servingLabel: serving.label,
    kcal: (kcalPer100g * grams) / 100,
  };
}
