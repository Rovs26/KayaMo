import { describe, expect, it } from 'vitest';
import { PACKAGE } from './index';

describe('@kayamo/offline', () => {
  it('loads', () => {
    expect(PACKAGE).toBe('@kayamo/offline');
  });
});
