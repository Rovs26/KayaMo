import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Food, FoodInsert, Serving, ServingInsert } from '@kayamo/db';
import { DbQueryError } from '@kayamo/db';
import { cacheOnFirstHit, type CanonicalFoodStore } from './cache';
import type { NormalizedFood } from './types';

function sampleFood(sourceId = '331960'): NormalizedFood {
  return {
    name: 'Chicken breast, cooked, braised',
    per100g: {
      kcal: 166,
      protein_g: 32.1,
      carbs_g: 0,
      fat_g: 3.24,
      fiber_g: 0,
      sugar_g: 0,
      sodium_mg: 47,
    },
    servings: [
      { label: '1 piece', grams: 181, isDefault: true },
      { label: '100 g', grams: 100 },
    ],
    source: 'usda_fdc',
    sourceId,
    confidence: 0.9,
    sourceNote: 'USDA FoodData Central (CC0 public domain).',
  };
}

function memoryStore(): CanonicalFoodStore & { foods: Food[]; servings: Serving[] } {
  const foods: Food[] = [];
  const servings: Serving[] = [];
  return {
    foods,
    servings,
    async getBySource(source, sourceId) {
      return foods.find((row) => row.source === source && row.source_id === sourceId) ?? null;
    },
    async insertFood(row: FoodInsert) {
      if (foods.some((existing) => existing.source === row.source && existing.source_id === row.source_id)) {
        throw new DbQueryError('duplicate', '23505');
      }
      const created: Food = {
        id: randomUUID(),
        source: row.source,
        source_id: row.source_id ?? null,
        name: row.name,
        name_tl: row.name_tl ?? [],
        brand: row.brand ?? null,
        barcode: row.barcode ?? null,
        kcal: row.kcal,
        protein_g: row.protein_g,
        carbs_g: row.carbs_g,
        fat_g: row.fat_g,
        fiber_g: row.fiber_g,
        sugar_g: row.sugar_g,
        sodium_mg: row.sodium_mg,
        confidence: row.confidence,
        verified_by_user: row.verified_by_user ?? false,
        created_by: row.created_by ?? null,
        shared: row.shared ?? false,
        attribution: row.attribution ?? null,
        source_note: row.source_note ?? null,
        created_at: row.created_at ?? new Date().toISOString(),
        updated_at: row.updated_at,
        server_updated_at: '2026-08-16T00:00:00.000Z',
        deleted_at: row.deleted_at ?? null,
      };
      foods.push(created);
      return created;
    },
    async insertServings(rows: ServingInsert[]) {
      const created = rows.map((row) => {
        const serving: Serving = {
          id: randomUUID(),
          food_id: row.food_id,
          label: row.label,
          grams_equivalent: row.grams_equivalent,
          is_default: row.is_default ?? false,
          created_at: row.created_at ?? new Date().toISOString(),
          updated_at: row.updated_at,
          server_updated_at: '2026-08-16T00:00:00.000Z',
        };
        servings.push(serving);
        return serving;
      });
      return created;
    },
  };
}

describe('cacheOnFirstHit', () => {
  it('inserts on miss and does not overwrite on the second fetch', async () => {
    const store = memoryStore();
    const first = await cacheOnFirstHit(store, sampleFood());
    expect(store.foods).toHaveLength(1);
    expect(store.servings).toHaveLength(2);
    expect(first.kcal).toBe('166');

    const second = await cacheOnFirstHit(store, {
      ...sampleFood(),
      name: 'Should not replace',
      per100g: { ...sampleFood().per100g, kcal: 1 },
    });
    expect(second.id).toBe(first.id);
    expect(second.name).toBe(first.name);
    expect(store.foods).toHaveLength(1);
    expect(store.foods[0]?.kcal).toBe('166');
  });
});
