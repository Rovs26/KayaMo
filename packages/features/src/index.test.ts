import { describe, expect, it } from 'vitest';
import { PACKAGE } from './index';

describe('@kayamo/features', () => {
  it('loads', () => {
    expect(PACKAGE).toBe('@kayamo/features');
  });
});
