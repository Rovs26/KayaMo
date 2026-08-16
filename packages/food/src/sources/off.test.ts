import { describe, expect, it, vi } from 'vitest';
import { noopLimiter } from './limiter';
import { lookupOffBarcode, searchOff } from './off';
import offProductFixture from './fixtures/off-product-3017620422003.json';
import offMissingFixture from './fixtures/off-product-missing.json';
import offSearchFixture from './fixtures/off-search-nutella.json';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Open Food Facts adapter', () => {
  it('resolves a recorded barcode to Nutella with ODbL attribution', async () => {
    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      expect(input).toContain('/api/v2/product/3017620422003.json');
      const headers = new Headers(init?.headers);
      expect(headers.get('User-Agent')).toMatch(/KayaMo\//);
      return jsonResponse(offProductFixture);
    });

    const food = await lookupOffBarcode('3017620422003', {
      fetch: fetchMock,
      limiter: noopLimiter,
      userAgent: 'KayaMo/1.0 (contact@kayamo.ph)',
    });

    expect(food?.name).toBe('Nutella');
    expect(food?.brand).toBe('Nutella');
    expect(food?.source).toBe('off');
    expect(food?.sourceId).toBe('3017620422003');
    expect(food?.per100g.kcal).toBe(539);
    expect(food?.per100g.protein_g).toBeCloseTo(6.3, 5);
    expect(food?.per100g.fat_g).toBeCloseTo(30.9, 5);
    expect(food?.per100g.sodium_mg).toBeCloseTo(42.8, 1);
    expect(food?.attribution).toMatch(/Open Food Facts/);
    expect(food?.attribution).toMatch(/ODbL/);
  });

  it('returns null when the product is missing', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(offMissingFixture));
    const food = await lookupOffBarcode('0000000000000', {
      fetch: fetchMock,
      limiter: noopLimiter,
    });
    expect(food).toBeNull();
  });

  it('maps a recorded text search', async () => {
    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      expect(input).toContain('cgi/search.pl');
      expect(input).toContain('search_terms=nutella');
      const headers = new Headers(init?.headers);
      expect(headers.get('User-Agent')).toMatch(/KayaMo\//);
      return jsonResponse(offSearchFixture);
    });

    const results = await searchOff('nutella', {
      fetch: fetchMock,
      limiter: noopLimiter,
      userAgent: 'KayaMo/1.0 (contact@kayamo.ph)',
    });
    expect(results[0]?.name).toBe('Nutella');
    expect(results.some((food) => food.barcode === '3017620425035')).toBe(true);
    const withServing = results.find((food) => food.barcode === '3017620425035');
    expect(withServing?.servings.some((s) => s.grams === 15)).toBe(true);
  });
});
