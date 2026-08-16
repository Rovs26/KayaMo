import { describe, expect, it } from 'vitest';
import {
  dedupeKey,
  displayName,
  mergeCandidates,
  parseGramsFromText,
  perServingToPer100g,
  toGrams,
} from './normalize';
import type { NormalizedFood } from './types';

function food(partial: Partial<NormalizedFood> & Pick<NormalizedFood, 'name' | 'sourceId'>): NormalizedFood {
  return {
    brand: partial.brand,
    barcode: partial.barcode,
    per100g: partial.per100g ?? {
      kcal: 165,
      protein_g: 31,
      carbs_g: 0,
      fat_g: 3.6,
      fiber_g: 0,
      sugar_g: 0,
      sodium_mg: 74,
    },
    servings: partial.servings ?? [{ label: '100 g', grams: 100, isDefault: true }],
    source: partial.source ?? 'usda_fdc',
    confidence: partial.confidence ?? 0.7,
    name: partial.name,
    sourceId: partial.sourceId,
    attribution: partial.attribution,
    sourceNote: partial.sourceNote,
  };
}

describe('normalize', () => {
  it('converts common mass units to grams', () => {
    expect(toGrams(1, 'kg')).toBe(1000);
    expect(toGrams(2, 'oz')?.toFixed(2)).toBe('56.70');
    expect(toGrams(8, 'fl oz')?.toFixed(1)).toBe('236.6');
    expect(toGrams(1, 'stone')).toBeNull();
  });

  it('parses a serving size string', () => {
    expect(parseGramsFromText('15 g')).toBe(15);
    expect(parseGramsFromText('1 oz')?.toFixed(2)).toBe('28.35');
  });

  it('scales per-serving nutrients to per 100 g', () => {
    const per100g = perServingToPer100g(
      {
        kcal: 165,
        protein_g: 20.4,
        carbs_g: 1.06,
        fat_g: 8.1,
        fiber_g: 0,
        sugar_g: 0.7,
        sodium_mg: 433,
      },
      284,
    );
    expect(per100g.protein_g).toBeCloseTo(7.183, 3);
    expect(per100g.kcal).toBeCloseTo(58.099, 3);
  });

  it('title-cases ALL CAPS branded names', () => {
    expect(displayName('CHICKEN BREAST')).toBe('Chicken Breast');
    expect(displayName('Chicken, broiler or fryers, breast')).toBe(
      'Chicken, broiler or fryers, breast',
    );
  });

  it('collapses near-duplicates, keeping the higher-confidence source', () => {
    const merged = mergeCandidates([
      food({
        name: 'Chicken, broiler or fryers, breast, skinless, boneless, meat only, cooked, braised',
        sourceId: '171140',
        confidence: 0.85,
      }),
      food({
        name: 'Chicken, broiler or fryers, breast, skinless, boneless, meat only, cooked, braised',
        sourceId: '331960',
        confidence: 0.9,
      }),
      food({
        name: 'Chicken, broiler or fryers, breast, skinless, boneless, meat only, cooked, grilled',
        sourceId: '171534',
        confidence: 0.85,
      }),
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0]?.sourceId).toBe('331960');
    expect(merged.map((item) => item.sourceId).sort()).toEqual(['171534', '331960']);
  });

  it('dedupes by barcode when present', () => {
    expect(
      dedupeKey({ name: 'Nutella', brand: 'Ferrero', barcode: '3017620422003' }),
    ).toBe('b:3017620422003');
  });
});
