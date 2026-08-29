import { describe, expect, it } from 'vitest';
import { clampUpdatedAt, incomingWins, omitServerCursor } from './lww';

describe('clampUpdatedAt', () => {
  it('leaves timestamps within 5 minutes in the future unchanged', () => {
    const now = new Date('2026-08-16T12:00:00.000Z');
    const incoming = new Date('2026-08-16T12:04:59.000Z');
    expect(clampUpdatedAt(incoming, now).toISOString()).toBe(incoming.toISOString());
  });

  it('clamps timestamps more than 5 minutes in the future to now', () => {
    const now = new Date('2026-08-16T12:00:00.000Z');
    const incoming = new Date('2026-08-16T12:05:00.001Z');
    expect(clampUpdatedAt(incoming, now).toISOString()).toBe(now.toISOString());
  });
});

describe('incomingWins', () => {
  it('applies only a strictly newer updated_at', () => {
    expect(incomingWins('2026-08-16T12:00:00.000Z', '2026-08-16T12:00:00.001Z')).toBe(
      true,
    );
    expect(incomingWins('2026-08-16T12:00:00.000Z', '2026-08-16T12:00:00.000Z')).toBe(
      false,
    );
    expect(incomingWins('2026-08-16T12:00:01.000Z', '2026-08-16T12:00:00.000Z')).toBe(
      false,
    );
  });
});

describe('omitServerCursor', () => {
  it('strips both server-maintained cursor fields from a write payload', () => {
    expect(
      omitServerCursor({
        id: 'row',
        updated_at: '2026-08-16T12:00:00.000Z',
        server_updated_at: '2099-01-01T00:00:00.000Z',
        server_seq: 999_999,
      }),
    ).toEqual({ id: 'row', updated_at: '2026-08-16T12:00:00.000Z' });
  });
});
