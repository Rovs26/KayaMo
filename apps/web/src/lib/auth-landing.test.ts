import { authCallbackNextPath } from '@kayamo/features/auth';
import { describe, expect, it } from 'vitest';

describe('desktop auth landing', () => {
  it('defaults next to food history', () => {
    expect(authCallbackNextPath(null, '/app/food')).toBe('/app/food');
  });
});
