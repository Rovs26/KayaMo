import { describe, expect, it } from 'vitest';
import { PACKAGE } from './index';

describe('@kayamo/ui', () => {
  it('loads', () => {
    expect(PACKAGE).toBe('@kayamo/ui');
  });
});
