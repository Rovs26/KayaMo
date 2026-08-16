import { describe, expect, it } from 'vitest';
import { PACKAGE } from './index';

describe('@kayamo/db', () => {
  it('loads', () => {
    expect(PACKAGE).toBe('@kayamo/db');
  });
});
