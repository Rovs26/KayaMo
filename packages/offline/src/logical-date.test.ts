import { describe, expect, it } from 'vitest';
import { logicalDateFromInstant } from './logical-date';

describe('logicalDateFromInstant', () => {
  it('uses the Manila calendar date at midnight start', () => {
    expect(logicalDateFromInstant('2026-08-16T04:00:00.000Z', 'Asia/Manila', '00:00:00')).toBe(
      '2026-08-16',
    );
  });

  it('rolls back before day_starts_at', () => {
    expect(logicalDateFromInstant('2026-08-16T20:00:00.000Z', 'Asia/Manila', '06:00:00')).toBe(
      '2026-08-16',
    );
    expect(logicalDateFromInstant('2026-08-16T21:30:00.000Z', 'Asia/Manila', '06:00:00')).toBe(
      '2026-08-16',
    );
  });
});
