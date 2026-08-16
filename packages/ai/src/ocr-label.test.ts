import { describe, expect, it, vi } from 'vitest';
import { extractNutritionLabel } from './ocr-label';
import { completeObject } from './router';
import { z } from 'zod';

describe('extractNutritionLabel', () => {
  it('returns Zod-validated label numbers from the model', async () => {
    const generateObject = vi.fn(async () => ({
      object: {
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
        overallConfidence: 0.86,
      },
    }));

    const result = await extractNutritionLabel(
      { image: new Uint8Array([1, 2, 3]), mediaType: 'image/jpeg', userId: 'user-1' },
      { generateObject },
    );

    expect(result.productName).toContain('Lucky Me');
    expect(result.basis).toBe('per_serving');
    expect(result.kcal).toBe(280);
    expect(generateObject).toHaveBeenCalledTimes(1);
    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({ tier: 'vision', userId: 'user-1' }),
    );
  });

  it('rejects invented extra nutrition fields via the schema', async () => {
    await expect(
      completeObject(
        {
          tier: 'vision',
          schema: z.object({ kcal: z.number() }),
          system: 'test',
          userId: 'user-1',
          messages: [{ role: 'user', content: 'x' }],
        },
        {
          generateObject: async () => ({ object: { kcal: 'hot' } }),
        },
      ),
    ).rejects.toThrow();
  });
});
