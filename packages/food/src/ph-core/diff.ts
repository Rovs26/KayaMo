import type { Food, Serving } from '@kayamo/db';
import { toConfidenceString, toNutrientString } from '../numeric';
import type { PhCoreFood } from './schema';

export type PhCoreFieldDiff = {
  field: string;
  yaml: string;
  db: string;
};

function num(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return toNutrientString(typeof value === 'number' ? value : Number(value));
}

function servingsKey(servings: Array<{ label: string; grams: string | number; isDefault?: boolean }>): string {
  return servings
    .map((s) => `${s.label}:${typeof s.grams === 'number' ? toNutrientString(s.grams) : s.grams}:${s.isDefault ? '1' : '0'}`)
    .sort()
    .join('|');
}

export function diffPhCoreVsDb(
  yaml: PhCoreFood,
  db: { food: Food; servings: Serving[] } | null,
): PhCoreFieldDiff[] {
  if (!db) {
    return [{ field: '(row)', yaml: yaml.name, db: 'not in database' }];
  }
  const { food, servings } = db;
  const rows: PhCoreFieldDiff[] = [
    { field: 'name', yaml: yaml.name, db: food.name },
    { field: 'name_tl', yaml: yaml.name_tl.join(', '), db: (food.name_tl ?? []).join(', ') },
    { field: 'kcal', yaml: toNutrientString(yaml.per100g.kcal), db: num(food.kcal) },
    { field: 'protein_g', yaml: toNutrientString(yaml.per100g.protein), db: num(food.protein_g) },
    { field: 'carbs_g', yaml: toNutrientString(yaml.per100g.carbs), db: num(food.carbs_g) },
    { field: 'fat_g', yaml: toNutrientString(yaml.per100g.fat), db: num(food.fat_g) },
    { field: 'fiber_g', yaml: toNutrientString(yaml.per100g.fiber), db: num(food.fiber_g) },
    { field: 'sugar_g', yaml: toNutrientString(yaml.per100g.sugar), db: num(food.sugar_g) },
    { field: 'sodium_mg', yaml: toNutrientString(yaml.per100g.sodium_mg), db: num(food.sodium_mg) },
    {
      field: 'confidence',
      yaml: toConfidenceString(yaml.confidence),
      db: food.confidence,
    },
    { field: 'source_note', yaml: yaml.source_note.trim(), db: (food.source_note ?? '').trim() },
    {
      field: 'verified',
      yaml: yaml.verified ? 'true' : 'false',
      db: food.verified_by_user ? 'true' : 'false',
    },
    {
      field: 'servings',
      yaml: servingsKey(
        yaml.servings.map((s) => ({
          label: s.label,
          grams: s.grams,
          isDefault: s.is_default === true,
        })),
      ),
      db: servingsKey(
        servings.map((s) => ({
          label: s.label,
          grams: s.grams_equivalent,
          isDefault: s.is_default,
        })),
      ),
    },
  ];
  return rows.filter((row) => row.yaml !== row.db);
}
