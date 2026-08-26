import { describe, expect, it } from 'vitest';
import { DEFAULT_FOOD_HISTORY_DAYS } from './hydrate-food-history';

describe('hydrateFoodHistory', () => {
  it('defaults to a 30-day lookback', () => {
    expect(DEFAULT_FOOD_HISTORY_DAYS).toBe(30);
  });
});
