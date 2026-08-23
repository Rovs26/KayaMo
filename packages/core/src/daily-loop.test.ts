import { describe, expect, it } from 'vitest';
import {
  buildDailyLoopState,
  focusRemainingSeconds,
  focusSessionState,
  isWithinQuietHours,
  notificationDelivery,
} from './daily-loop';

describe('daily loop', () => {
  it('handles overnight quiet hours without muting the whole day', () => {
    expect(isWithinQuietHours('23:30', '22:00', '07:00')).toBe(true);
    expect(isWithinQuietHours('06:59', '22:00', '07:00')).toBe(true);
    expect(isWithinQuietHours('12:00', '22:00', '07:00')).toBe(false);
    expect(isWithinQuietHours('12:00', '00:00', '00:00')).toBe(false);
  });

  it('never auto-completes focus when its timer expires', () => {
    const session = {
      startedAt: '2026-08-22T08:00:00.000Z',
      endsAt: '2026-08-22T08:25:00.000Z',
      completedAt: null,
      cancelledAt: null,
    };
    expect(focusSessionState(session, '2026-08-22T09:00:00.000Z')).toBe('active');
    expect(focusRemainingSeconds(session.endsAt, '2026-08-22T09:00:00.000Z')).toBe(0);
  });

  it('moves from planning to focus to explicit reflection', () => {
    expect(
      buildDailyLoopState({
        localTime: '08:00',
        morningCompletedAt: null,
        eveningCompletedAt: null,
        now: '2026-08-22T00:00:00.000Z',
      }).nextPrompt,
    ).toBe('plan');
    expect(
      buildDailyLoopState({
        localTime: '13:00',
        morningCompletedAt: '2026-08-22T00:00:00.000Z',
        eveningCompletedAt: null,
        now: '2026-08-22T05:00:00.000Z',
      }).nextPrompt,
    ).toBe('focus');
    expect(
      buildDailyLoopState({
        localTime: '19:00',
        morningCompletedAt: '2026-08-22T00:00:00.000Z',
        eveningCompletedAt: null,
        now: '2026-08-22T11:00:00.000Z',
      }).nextPrompt,
    ).toBe('reflect');
  });

  it('uses an in-app nudge when browser permission is denied', () => {
    expect(
      notificationDelivery({ enabled: true, quiet: false, permission: 'denied' }),
    ).toEqual({ channel: 'in_app', reason: 'permission_denied' });
    expect(
      notificationDelivery({ enabled: true, quiet: true, permission: 'granted' }),
    ).toEqual({ channel: 'none', reason: 'quiet_hours' });
  });
});
