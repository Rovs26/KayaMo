import { describe, expect, it } from 'vitest';
import {
  actualMinutesBetween,
  busiestWeekday,
  deadlineRisk,
  estimateCapacityFromHistory,
  forgottenItems,
  goalPlausibility,
  learnedFocusMinutes,
  proposeAdaptivePatterns,
} from './adaptive';

describe('learned focus duration', () => {
  it('needs three real samples and prefers the median', () => {
    expect(learnedFocusMinutes([])).toBeNull();
    expect(
      learnedFocusMinutes([
        { plannedMinutes: 25, actualMinutes: 12 },
        { plannedMinutes: 25, actualMinutes: 14 },
        { plannedMinutes: 25, actualMinutes: 40 },
      ]),
    ).toEqual({ minutes: 14, sampleCount: 3, typical: 'shorter' });
  });

  it('counts elapsed minutes from timestamps', () => {
    expect(actualMinutesBetween('2026-08-24T08:00:00.000Z', '2026-08-24T08:18:00.000Z')).toBe(18);
  });
});

describe('capacity estimate', () => {
  it('steps down when great days usually finish less than half the cap', () => {
    const days = [
      { capacity: 'great' as const, planned: 3, completed: 1 },
      { capacity: 'great' as const, planned: 3, completed: 0 },
      { capacity: 'great' as const, planned: 3, completed: 1 },
      { capacity: 'normal' as const, planned: 3, completed: 1 },
    ];
    expect(estimateCapacityFromHistory(days)).toBe('normal');
  });

  it('keeps the recent capacity when the record is still thin', () => {
    expect(
      estimateCapacityFromHistory([{ capacity: 'low', planned: 1, completed: 1 }]),
    ).toBe('low');
  });
});

describe('deadline and forgotten work', () => {
  it('flags more remaining steps than days without calling the goal failed', () => {
    const risk = deadlineRisk({ today: '2026-08-24', targetDate: '2026-08-26', remainingSteps: 4 });
    expect(risk.level).toBe('tight');
    expect(risk.reason).toMatch(/smaller next step/i);
    expect(goalPlausibility({ remainingSteps: 10, daysLeft: 3 }).ok).toBe(false);
  });

  it('lists idle inbox and unscheduled tasks without putting them on today', () => {
    const items = forgottenItems({
      today: '2026-08-24',
      inbox: [{ id: 'i1', content: 'Call Ate Rina', createdAt: '2026-08-10T02:00:00.000Z' }],
      openTasks: [
        {
          id: 't1',
          title: 'Email the landlord',
          createdAt: '2026-08-18T02:00:00.000Z',
          scheduledFor: null,
        },
      ],
    });
    expect(items.map((row) => row.kind)).toEqual(['inbox', 'task']);
  });
});

describe('adaptive patterns', () => {
  it('proposes confirmable notes and honors skip keys', () => {
    const patterns = proposeAdaptivePatterns({
      learned: { minutes: 12, sampleCount: 4, typical: 'shorter' },
      estimatedCapacity: 'low',
      forgotten: [{ kind: 'inbox', id: 'i1', title: 'x', idleDays: 10 }],
      deadline: null,
      busiest: busiestWeekday([
        '2026-08-01',
        '2026-08-08',
        '2026-08-15',
        '2026-08-22',
        '2026-08-02',
        '2026-08-03',
        '2026-08-04',
        '2026-08-05',
      ]),
      skipKeys: ['duration:shorter'],
    });
    expect(patterns.some((row) => row.key === 'duration:shorter')).toBe(false);
    expect(patterns.some((row) => row.key === 'capacity:overstated')).toBe(true);
    expect(patterns.some((row) => row.key === 'forgotten:inbox')).toBe(true);
  });
});
