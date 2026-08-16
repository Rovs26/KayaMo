import { describe, expect, it, vi } from 'vitest';
import { searchExternalFoods } from './search';
import { noopLimiter } from './sources/limiter';
import usdaSearchFixture from './sources/fixtures/usda-search-chicken-breast.json';
import offProductFixture from './sources/fixtures/off-product-3017620422003.json';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('searchExternalFoods', () => {
  it('returns clean normalized chicken breast results from USDA', async () => {
    const fetchMock = vi.fn(async (input: string) => {
      if (String(input).includes('api.nal.usda.gov')) return jsonResponse(usdaSearchFixture);
      return jsonResponse({ products: [] });
    });

    const results = await searchExternalFoods('chicken breast', {
      usda: { apiKey: 'test-key', fetch: fetchMock, limiter: noopLimiter },
      off: { fetch: fetchMock, limiter: noopLimiter },
    });

    const chicken = results.filter((food) => food.name.toLowerCase().includes('chicken'));
    expect(chicken.length).toBeGreaterThan(0);
    expect(results[0]?.sourceId).toBe('331960');
    expect(results[0]?.per100g.protein_g).toBeGreaterThan(20);
    expect(results.some((food) => food.sourceId === '171140')).toBe(false);
  });

  it('sends barcodes to Open Food Facts first', async () => {
    const fetchMock = vi.fn(async (input: string) => {
      expect(String(input)).toContain('openfoodfacts.org/api/v2/product/3017620422003');
      return jsonResponse(offProductFixture);
    });

    const results = await searchExternalFoods('3017620422003', {
      usda: { apiKey: 'test-key', fetch: fetchMock, limiter: noopLimiter },
      off: { fetch: fetchMock, limiter: noopLimiter, userAgent: 'KayaMo/1.0 (contact@kayamo.ph)' },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe('Nutella');
    expect(results[0]?.source).toBe('off');
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('api.nal.usda.gov'))).toBe(
      false,
    );
  });
});
