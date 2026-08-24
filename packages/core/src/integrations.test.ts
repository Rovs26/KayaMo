import { describe, expect, it } from 'vitest';
import {
  ACTION_LEVEL_LABELS,
  adjustedPlanLimit,
  busyHoursFromBlocks,
  hoursBetweenClock,
  integrationStatuses,
  resolveActionLevel,
  voiceCaptureAvailability,
  type IntegrationDescriptor,
} from './integrations';

const calendar: IntegrationDescriptor = {
  id: 'calendar',
  title: 'Calendar',
  summary: '',
  availability: 'local_alternative',
  restriction: '',
  defaultLevel: 'act_with_permission',
};

describe('integration honesty', () => {
  it('never reports calendar or health as connected on a bare PWA', () => {
    const rows = integrationStatuses({}, { voiceAvailable: false, notificationsEnabled: false });
    expect(rows.find((row) => row.id === 'calendar')?.connected).toBe(false);
    expect(rows.find((row) => row.id === 'health')?.connected).toBe(false);
    expect(rows.find((row) => row.id === 'wearable')?.connected).toBe(false);
    expect(rows.find((row) => row.id === 'web_research')?.connected).toBe(false);
  });

  it('marks voice available only when the browser actually has speech recognition', () => {
    expect(voiceCaptureAvailability(false)).toBe('unsupported');
    expect(voiceCaptureAvailability(true)).toBe('available');
    const rows = integrationStatuses({}, { voiceAvailable: true, notificationsEnabled: false });
    expect(rows.find((row) => row.id === 'voice')?.connected).toBe(true);
  });

  it('refuses to default into auto-manage', () => {
    expect(resolveActionLevel(null, calendar)).toBe('act_with_permission');
    expect(resolveActionLevel('auto_manage', calendar)).toBe('act_with_permission');
    expect(ACTION_LEVEL_LABELS.act_with_permission).toMatch(/permission/i);
  });
});

describe('busy hours', () => {
  it('counts named commitments and reduces the plan cap by a slot per three hours', () => {
    expect(hoursBetweenClock('09:00', '12:00')).toBe(3);
    expect(
      busyHoursFromBlocks([
        { startsAt: '09:00', endsAt: '12:00' },
        { startsAt: null, endsAt: null },
      ]),
    ).toBe(5);
    expect(adjustedPlanLimit(3, 5)).toBe(2);
    expect(adjustedPlanLimit(3, 9)).toBe(1);
  });
});
