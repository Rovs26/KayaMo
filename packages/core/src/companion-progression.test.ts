import { describe, expect, it } from 'vitest';
import {
  companionEventKey,
  companionStageForPoints,
  earnedAchievementKeys,
  reduceCompanionEvents,
  type CompanionLedgerEvent,
} from './companion-progression';

function event(
  eventType: CompanionLedgerEvent['eventType'],
  sourceId: string,
): CompanionLedgerEvent {
  const sourceTable = eventType === 'task_completed' ? 'tasks' : 'habit_completions';
  return {
    eventType,
    sourceTable,
    sourceId,
    eventKey: companionEventKey({ eventType, sourceTable, sourceId }),
    logicalDate: '2026-08-22',
  };
}

describe('companion progression', () => {
  it('deduplicates stable event keys and never awards twice', () => {
    const completed = event('task_completed', 'task-1');
    const result = reduceCompanionEvents([completed, completed]);
    expect(result.totalPoints).toBe(10);
    expect(result.acceptedEventKeys).toEqual([completed.eventKey]);
  });

  it('ignores malformed event keys instead of trusting claimed events', () => {
    const completed = event('habit_completed', 'completion-1');
    expect(
      reduceCompanionEvents([{ ...completed, eventKey: 'weight-loss:10kg' }]).totalPoints,
    ).toBe(0);
  });

  it('makes recovery positive without subtracting for the missed interval', () => {
    const result = reduceCompanionEvents([
      event('habit_completed', 'completion-1'),
      event('recovery_return', 'completion-2'),
    ]);
    expect(result.totalPoints).toBe(23);
    expect(result.eventCounts.recovery_return).toBe(1);
  });

  it('moves stages forward at deterministic thresholds', () => {
    expect(companionStageForPoints(0)).toBe('seed');
    expect(companionStageForPoints(100)).toBe('sprout');
    expect(companionStageForPoints(1_500)).toBe('flourishing_tree');
    expect(() => companionStageForPoints(-1)).toThrow();
  });

  it('evaluates traceable achievement rules from the accepted ledger', () => {
    const progression = reduceCompanionEvents([
      event('task_completed', 'task-1'),
      event('recovery_return', 'completion-2'),
    ]);
    expect(
      earnedAchievementKeys(progression, [
        { key: 'first_step', rule: { kind: 'event_count', threshold: 1 } },
        {
          key: 'welcome_back',
          rule: { kind: 'event_type_count', eventType: 'recovery_return', threshold: 1 },
        },
        { key: 'sprout', rule: { kind: 'total_points', threshold: 100 } },
      ]),
    ).toEqual(['first_step', 'welcome_back']);
  });
});
