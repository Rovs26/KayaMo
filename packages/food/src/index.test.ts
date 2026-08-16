import { describe, expect, it } from 'vitest';
import { PACKAGE } from './index';

describe('@kayamo/food', () => {
  it('loads', () => {
    expect(PACKAGE).toBe('@kayamo/food');
  });
});
