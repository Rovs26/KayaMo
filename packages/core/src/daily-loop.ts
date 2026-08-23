export type DailyLoopPhase = 'morning' | 'day' | 'evening';

export type FocusSessionState = 'scheduled' | 'active' | 'completed' | 'cancelled';

export type FocusSessionClock = {
  startedAt: string | null;
  endsAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
};

export type DailyLoopState = {
  phase: DailyLoopPhase;
  morningComplete: boolean;
  eveningComplete: boolean;
  focus: FocusSessionState | null;
  nextPrompt: 'plan' | 'focus' | 'reflect' | 'return_tomorrow';
};

function minutesFromTime(value: string): number {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!match) throw new Error(`Invalid local time: ${value}`);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error(`Invalid local time: ${value}`);
  return hour * 60 + minute;
}

export function isWithinQuietHours(
  localTime: string,
  quietStartsAt: string,
  quietEndsAt: string,
): boolean {
  const current = minutesFromTime(localTime);
  const start = minutesFromTime(quietStartsAt);
  const end = minutesFromTime(quietEndsAt);
  if (start === end) return false;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

export function focusSessionState(
  session: FocusSessionClock,
  now: string,
): FocusSessionState {
  if (session.completedAt) return 'completed';
  if (session.cancelledAt) return 'cancelled';
  if (!session.startedAt) return 'scheduled';
  // A timer reaching its deadline does not silently mark the user's work complete.
  // Completion is always explicit; the deadline only drives the visible clock.
  void now;
  return 'active';
}

export function focusRemainingSeconds(
  endsAt: string | null,
  now: string,
): number | null {
  if (!endsAt) return null;
  const remaining = Date.parse(endsAt) - Date.parse(now);
  if (!Number.isFinite(remaining)) return null;
  return Math.max(0, Math.ceil(remaining / 1_000));
}

export function dailyLoopPhase(localTime: string): DailyLoopPhase {
  const minutes = minutesFromTime(localTime);
  if (minutes < 12 * 60) return 'morning';
  if (minutes < 18 * 60) return 'day';
  return 'evening';
}

export function buildDailyLoopState(input: {
  localTime: string;
  morningCompletedAt: string | null;
  eveningCompletedAt: string | null;
  focusSession?: FocusSessionClock | null;
  now: string;
}): DailyLoopState {
  const phase = dailyLoopPhase(input.localTime);
  const morningComplete = input.morningCompletedAt !== null;
  const eveningComplete = input.eveningCompletedAt !== null;
  const focus = input.focusSession
    ? focusSessionState(input.focusSession, input.now)
    : null;

  let nextPrompt: DailyLoopState['nextPrompt'];
  if (!morningComplete) nextPrompt = 'plan';
  else if (phase === 'evening' && !eveningComplete) nextPrompt = 'reflect';
  else if (eveningComplete) nextPrompt = 'return_tomorrow';
  else nextPrompt = 'focus';

  return { phase, morningComplete, eveningComplete, focus, nextPrompt };
}

export type NotificationDelivery =
  | { channel: 'none'; reason: 'disabled' | 'quiet_hours' }
  | { channel: 'system'; reason: 'permission_granted' }
  | { channel: 'in_app'; reason: 'permission_denied' | 'unsupported' | 'not_requested' };

export function notificationDelivery(input: {
  enabled: boolean;
  quiet: boolean;
  permission: 'granted' | 'denied' | 'default' | 'unsupported';
}): NotificationDelivery {
  if (!input.enabled) return { channel: 'none', reason: 'disabled' };
  if (input.quiet) return { channel: 'none', reason: 'quiet_hours' };
  if (input.permission === 'granted') {
    return { channel: 'system', reason: 'permission_granted' };
  }
  if (input.permission === 'denied') {
    return { channel: 'in_app', reason: 'permission_denied' };
  }
  if (input.permission === 'unsupported') {
    return { channel: 'in_app', reason: 'unsupported' };
  }
  return { channel: 'in_app', reason: 'not_requested' };
}
