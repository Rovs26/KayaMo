import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { diffPhCoreVsDb } from './diff';
import { parsePhCoreDocument, validatePhCoreFoods } from './validate';
import type { PhCoreFood } from './schema';

const yamlPath = resolve(process.cwd(), '../../data/ph-core/foods.yaml');

function sample(overrides: Partial<PhCoreFood> = {}): PhCoreFood {
  return {
    id: 'test-food',
    name: 'Test food',
    name_tl: ['test'],
    category: 'ulam',
    per100g: {
      kcal: 170,
      protein: 12,
      carbs: 8,
      fat: 10,
      fiber: 1,
      sugar: 2,
      sodium_mg: 400,
    },
    servings: [{ label: '1 serving', grams: 100, is_default: true }],
    typical_prep: 'Test.',
    source_note: 'USDA FDC chicken and oil mix.',
    confidence: 0.5,
    verified: false,
    ...overrides,
  };
}

describe('PH core validation', () => {
  it('loads 40 dishes that pass Atwater and USDA-note rules', () => {
    const raw: unknown = parseYaml(readFileSync(yamlPath, 'utf8'));
    const result = parsePhCoreDocument(raw);
    expect(result.foods).toHaveLength(40);
    expect(result.errors).toEqual([]);
    expect(new Set(result.foods.map((food) => food.id)).size).toBe(40);
    for (const food of result.foods) {
      expect(food.source_note.toLowerCase()).toContain('usda');
      expect(food.source_note.toLowerCase()).not.toMatch(/fnri|philfct/);
      if (!food.verified) expect(food.confidence).toBeLessThanOrEqual(0.8);
    }
  });

  it('fails when kcal is more than 5% off 4/4/9', () => {
    const result = validatePhCoreFoods([
      sample({ per100g: { kcal: 400, protein: 12, carbs: 8, fat: 10, fiber: 1, sugar: 2, sodium_mg: 400 } }),
    ]);
    expect(result.errors.some((issue) => issue.code === 'atwater')).toBe(true);
  });

  it('rejects unverified confidence above 0.8 and FNRI notes', () => {
    const high = validatePhCoreFoods([sample({ confidence: 0.9 })]);
    expect(high.errors.some((issue) => issue.code === 'confidence_unverified')).toBe(true);

    const fnri = validatePhCoreFoods([
      sample({ source_note: 'Copied from FNRI PhilFCT lookup page.' }),
    ]);
    expect(fnri.errors.some((issue) => issue.code === 'fnri')).toBe(true);
  });

  it('diffs yaml against a db row', () => {
    const food = sample();
    const diffs = diffPhCoreVsDb(food, {
      food: {
        id: '00000000-0000-4000-8000-000000000001',
        source: 'ph_core',
        source_id: food.id,
        name: 'Old name',
        name_tl: food.name_tl,
        brand: null,
        barcode: null,
        kcal: '170',
        protein_g: '12',
        carbs_g: '8',
        fat_g: '10',
        fiber_g: '1',
        sugar_g: '2',
        sodium_mg: '400',
        confidence: '0.50',
        verified_by_user: false,
        created_by: null,
        shared: false,
        attribution: null,
        source_note: food.source_note,
        created_at: '2026-08-16T00:00:00.000Z',
        updated_at: '2026-08-16T00:00:00.000Z',
        server_updated_at: '2026-08-16T00:00:00.000Z',
        deleted_at: null,
      },
      servings: [
        {
          id: '00000000-0000-4000-8000-000000000002',
          food_id: '00000000-0000-4000-8000-000000000001',
          label: '1 serving',
          grams_equivalent: '100',
          is_default: true,
          created_at: '2026-08-16T00:00:00.000Z',
          updated_at: '2026-08-16T00:00:00.000Z',
          server_updated_at: '2026-08-16T00:00:00.000Z',
        },
      ],
    });
    expect(diffs).toEqual([{ field: 'name', yaml: 'Test food', db: 'Old name' }]);
  });
});
