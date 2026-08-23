import { describe, expect, it } from 'vitest';
import { buildDailyContext, PACKAGE } from './index';

describe('@kayamo/core', () => {
  it('loads', () => {
    expect(PACKAGE).toBe('@kayamo/core');
  });
});

describe('buildDailyContext', () => {
  it('uses confirmed activity and recommends one overdue task deterministically', () => {
    const summary = buildDailyContext({
      logicalDate: '2026-08-22',
      now: '2026-08-22T08:00:00.000Z',
      tasks: [
        {
          id: 'later',
          title: 'Plan tomorrow',
          completedAt: null,
          dueAt: null,
          sortOrder: 0,
        },
        {
          id: 'overdue',
          title: 'Drink water',
          completedAt: null,
          dueAt: '2026-08-22T07:00:00.000Z',
          sortOrder: 10,
        },
        {
          id: 'done',
          title: 'Make the bed',
          completedAt: '2026-08-22T06:30:00.000Z',
          dueAt: null,
          sortOrder: 1,
        },
      ],
      routines: [
        { id: 'routine', title: 'Morning prayer', completed: true, sortOrder: 0 },
      ],
      foodEntries: 2,
      workouts: 1,
    });

    expect(summary.nextAction).toEqual({
      kind: 'task',
      recordId: 'overdue',
      title: 'Drink water',
      reason: 'overdue',
    });
    expect(summary.confirmedActions).toBe(5);
    expect(summary.acknowledgement).toContain('1 task');
    expect(summary.acknowledgement).toContain('2 meals');
  });

  it('falls back to food logging without inventing completed activity', () => {
    const summary = buildDailyContext({
      logicalDate: '2026-08-22',
      now: '2026-08-22T08:00:00.000Z',
      tasks: [],
      routines: [],
      foodEntries: 0,
      workouts: 0,
    });

    expect(summary.nextAction.kind).toBe('food');
    expect(summary.confirmedActions).toBe(0);
    expect(summary.acknowledgement).toBe(
      'Nothing is logged yet. We can start with one small step.',
    );
  });
});
