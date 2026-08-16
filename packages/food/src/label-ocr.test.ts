import { describe, expect, it } from 'vitest';
import {
  confirmConfidence,
  draftFromOcr,
  nutrientsFromLabel,
  nutritionLabelOcrSchema,
  userFoodConfirmSchema,
  userFoodToRows,
  type NutritionLabelOcr,
} from './label-ocr';

const luckyMe: NutritionLabelOcr = {
  productName: 'Lucky Me Pancit Canton Original',
  brand: 'Lucky Me',
  servingSizeText: '1 pack (60 g)',
  servingGrams: 60,
  servingsPerPack: 1,
  basis: 'per_serving',
  kcal: 280,
  protein_g: 6,
  carbs_g: 41,
  fat_g: 11,
  fiber_g: 2,
  sugar_g: 3,
  sodium_mg: 820,
  overallConfidence: 0.88,
  fieldConfidence: {
    kcal: 0.92,
    sodium_mg: 0.9,
    servingGrams: 0.95,
    fiber_g: 0.4,
  },
};

describe('nutrition label OCR', () => {
  it('converts a PH per-serving Lucky Me label to per 100 g', () => {
    const draft = draftFromOcr(luckyMe, '4800016641103');
    expect(draft.name).toBe('Lucky Me Pancit Canton Original');
    expect(draft.barcode).toBe('4800016641103');
    expect(draft.servingGrams).toBe(60);
    expect(draft.per100g.kcal).toBeCloseTo(466.666, 2);
    expect(draft.per100g.protein_g).toBeCloseTo(10, 5);
    expect(draft.per100g.sodium_mg).toBeCloseTo(1366.666, 2);
    expect(draft.canSave).toBe(true);
  });

  it('does not invent missing nutrients', () => {
    const parsed = nutritionLabelOcrSchema.parse({
      productName: 'Lucky Me',
      basis: 'per_serving',
      servingGrams: 60,
      kcal: 280,
      protein_g: 6,
      carbs_g: 41,
      fat_g: 11,
      sodium_mg: 820,
      overallConfidence: 0.7,
    });
    expect(parsed.fiber_g).toBeUndefined();
    expect(parsed.sugar_g).toBeUndefined();
    const draft = draftFromOcr(parsed);
    expect(draft.per100g.fiber_g).toBeUndefined();
    expect(draft.per100g.sugar_g).toBeUndefined();
    expect(draft.missing).toEqual(expect.arrayContaining(['fiber_g', 'sugar_g']));
    expect(draft.canSave).toBe(false);
  });

  it('highlights low-confidence fields instead of guessing', () => {
    const draft = draftFromOcr(luckyMe);
    expect(draft.lowConfidence).toContain('fiber_g');
    expect(draft.per100g.fiber_g).toBeCloseTo(3.333, 2);
  });

  it('treats per 100 g labels as already normalized', () => {
    const per100g = nutrientsFromLabel({
      basis: 'per_100g',
      labeled: { kcal: 130, protein_g: 2.7, carbs_g: 28, fat_g: 0.3, fiber_g: 0.4, sugar_g: 0.1, sodium_mg: 1 },
    });
    expect(per100g.kcal).toBe(130);
  });

  it('caps confirmed confidence and writes source=user, private by default', () => {
    expect(confirmConfidence(0.99)).toBe(0.8);
    const rows = userFoodToRows(
      userFoodConfirmSchema.parse({
        name: 'Lucky Me Pancit Canton Original',
        brand: 'Lucky Me',
        barcode: '4800016641103',
        servingLabel: '1 pack (60 g)',
        servingGrams: 60,
        per100g: {
          kcal: 466.67,
          protein_g: 10,
          carbs_g: 68.33,
          fat_g: 18.33,
          fiber_g: 3.33,
          sugar_g: 5,
          sodium_mg: 1366.67,
        },
        shared: false,
        contributeToOff: true,
        confidence: confirmConfidence(0.88),
      }),
      'user-1',
      'food-1',
      '2026-08-16T16:00:00.000Z',
    );
    expect(rows.food.source).toBe('user');
    expect(rows.food.created_by).toBe('user-1');
    expect(rows.food.shared).toBe(false);
    expect(rows.contributeToOff).toBe(true);
    expect(rows.servings[0]?.isDefault).toBe(true);
    expect(Number(rows.food.confidence)).toBeLessThanOrEqual(0.8);
  });

  it('rejects a confirm payload that guesses by omitting required macros', () => {
    const result = userFoodConfirmSchema.safeParse({
      name: 'Lucky Me',
      servingLabel: '1 pack',
      servingGrams: 60,
      per100g: { kcal: 280, protein_g: 6, carbs_g: 41, fat_g: 11, fiber_g: 0, sugar_g: 0, sodium_mg: 820 },
      shared: false,
      contributeToOff: false,
      confidence: 0.7,
    });
    expect(result.success).toBe(true);
    const missingMacros = userFoodConfirmSchema.safeParse({
      name: 'Lucky Me',
      servingLabel: '1 pack',
      servingGrams: 60,
      per100g: { kcal: 280 },
      shared: false,
      contributeToOff: false,
      confidence: 0.7,
    });
    expect(missingMacros.success).toBe(false);
  });
});
