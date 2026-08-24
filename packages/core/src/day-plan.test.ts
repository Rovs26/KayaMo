import { describe, expect, it } from 'vitest';
import {
  daysBetweenLogical,
  proposeDayPlan,
  proposedPlanMode,
  suggestedPlanLimit,
  weeklyResetDue,
  type DayPlanCandidate,
} from './day-plan';

const candidates: DayPlanCandidate[] = [
  { id: 't1', title: 'Email Ate Rina', source: 'task', sourceId: 't1' },
  { id: 'g1', title: 'List five workplaces', source: 'goal', sourceId: 'g1' },
  { id: 'i1', title: 'Buy rice', source: 'inbox', sourceId: 'i1' },
  { id: 't2', title: 'Read one page', source: 'task', sourceId: 't2' },
];

describe('day plan proposal', () => {
  it('caps a low-capacity day without emptying the candidate list', () => {
    const proposal = proposeDayPlan({ candidates, capacity: 'low' });
    expect(proposal.mode).toBe('minimum');
    expect(proposal.limit).toBe(2);
    expect(proposal.overload).toBe(true);
    expect(proposal.items.filter((item) => item.suggested).map((item) => item.id)).toEqual([
      't1',
      'g1',
    ]);
    expect(proposal.items).toHaveLength(4);
  });

  it('uses one item after a gap and does not dump the rest as overdue', () => {
    const proposal = proposeDayPlan({
      candidates,
      capacity: 'great',
      returningAfterDays: 5,
    });
    expect(proposal.welcomeBack).toBe(true);
    expect(suggestedPlanLimit('great', 5)).toBe(1);
    expect(proposal.items.filter((item) => item.suggested)).toHaveLength(1);
    expect(proposal.items[0]?.reason).toMatch(/nothing away/i);
  });

  it('keeps only what the user marks during Rescue', () => {
    const proposal = proposeDayPlan({
      candidates,
      capacity: 'overwhelmed',
      mode: 'rescue',
      keepIds: ['g1'],
    });
    expect(proposal.mode).toBe('rescue');
    expect(proposal.limit).toBe(1);
    expect(proposal.items.filter((item) => item.suggested).map((item) => item.id)).toEqual(['g1']);
  });

  it('lets an explicit keep list override the capacity cap', () => {
    const proposal = proposeDayPlan({
      candidates,
      capacity: 'great',
      keepIds: ['i1'],
    });
    expect(proposal.items.filter((item) => item.suggested).map((item) => item.id)).toEqual(['i1']);
  });

  it('treats sick and overwhelmed as a minimum unless Rescue is explicit', () => {
    expect(proposedPlanMode('sick')).toBe('minimum');
    expect(proposedPlanMode('overwhelmed', 'rescue')).toBe('rescue');
  });
});

describe('weekly reset', () => {
  it('is due after seven quiet days, and on Sunday if never reset', () => {
    expect(daysBetweenLogical('2026-08-16', '2026-08-24')).toBe(8);
    expect(weeklyResetDue('2026-08-16', '2026-08-24')).toBe(true);
    expect(weeklyResetDue('2026-08-20', '2026-08-24')).toBe(false);
    expect(weeklyResetDue(null, '2026-08-23')).toBe(true);
    expect(weeklyResetDue(null, '2026-08-24')).toBe(false);
  });
});
