import { describe, expect, it } from 'vitest';
import { backoffMs } from './backoff';

describe('backoffMs', () => {
  it('starts at 2s and doubles, capped at 15 minutes', () => {
    expect(backoffMs(0)).toBe(2_000);
    expect(backoffMs(1)).toBe(4_000);
    expect(backoffMs(2)).toBe(8_000);
    expect(backoffMs(10)).toBe(15 * 60 * 1000);
  });
});
