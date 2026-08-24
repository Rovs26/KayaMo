import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getOfflineDb, resetOfflineDb } from './db';
import {
  completeLocalGoalMilestone,
  completeLocalHabit,
  createLocalCompanionEvent,
  createLocalGoal,
  createLocalGoalMilestone,
  createLocalHabit,
  getLocalCompanionProgression,
  listLocalGoalMilestones,
  listLocalGoals,
  listLocalHabitCompletions,
  listLocalHabits,
  mergeRemoteGoals,
  setLocalGoalStatus,
  tombstoneLocalGoal,
  updateLocalGoalMilestone,
} from './journey';

vi.mock('./sync', async () => {
  const status = await import('./status');
  return {
    drainQueue: vi.fn(async () => undefined),
    startSync: vi.fn(),
    getSyncStatusSnapshot: vi.fn(() => ({ kind: 'synced' })),
    bindStatusStore: status.subscribeSyncStatus,
    resumeSync: vi.fn(),
  };
});

describe('offline journey and companion growth', () => {
  beforeEach(resetOfflineDb);
  afterEach(resetOfflineDb);

  it('models goals, campaigns, chapters, milestones, and confirmed completion', async () => {
    const campaign = await createLocalGoal({
      userId: 'user-a',
      title: 'Four-week morning reset',
      kind: 'campaign',
      targetDate: '2026-09-19',
    });
    const chapter = await createLocalGoal({
      userId: 'user-a',
      title: 'Build a disciplined life',
      kind: 'chapter',
    });
    const milestone = await createLocalGoalMilestone({
      userId: 'user-a',
      goalId: chapter.id,
      title: 'Complete the first week',
    });
    await completeLocalGoalMilestone({ id: milestone.id, userId: 'user-a' });
    await setLocalGoalStatus({ id: campaign.id, userId: 'user-a', status: 'completed' });

    expect((await listLocalGoals('user-a')).map((goal) => goal.kind)).toEqual([
      'campaign',
      'chapter',
    ]);
    expect(
      (await listLocalGoalMilestones('user-a', chapter.id))[0]?.completed_at,
    ).toBeTruthy();
    const progression = await getLocalCompanionProgression('user-a');
    expect(progression.eventCounts.milestone_completed).toBe(1);
    expect(progression.eventCounts.goal_completed).toBe(1);
    expect(progression.totalPoints).toBe(70);
  });

  it('rewards a return after a gap without creating a negative missed-day event', async () => {
    const habit = await createLocalHabit({ userId: 'user-a', title: 'Morning prayer' });
    await completeLocalHabit({
      userId: 'user-a',
      habitId: habit.id,
      completedAt: '2026-08-18T07:00:00.000+08:00',
      timeZone: 'Asia/Manila',
    });
    const returned = await completeLocalHabit({
      userId: 'user-a',
      habitId: habit.id,
      completedAt: '2026-08-22T07:00:00.000+08:00',
      timeZone: 'Asia/Manila',
    });
    const duplicate = await completeLocalHabit({
      userId: 'user-a',
      habitId: habit.id,
      completedAt: '2026-08-22T09:00:00.000+08:00',
      timeZone: 'Asia/Manila',
    });

    expect(duplicate.id).toBe(returned.id);
    expect(await listLocalHabitCompletions('user-a')).toHaveLength(2);
    const progression = await getLocalCompanionProgression('user-a');
    expect(progression.eventCounts.habit_completed).toBe(2);
    expect(progression.eventCounts.recovery_return).toBe(1);
    expect(progression.totalPoints).toBe(31);
    expect(Object.keys(progression.eventCounts)).not.toContain('missed_day');
  });

  it('deduplicates the same stable reward event locally', async () => {
    const input = {
      userId: 'user-a',
      eventType: 'task_completed' as const,
      sourceTable: 'tasks',
      sourceId: '60000000-0000-4000-8000-000000000001',
      logicalDate: '2026-08-22',
    };
    const first = await createLocalCompanionEvent(input);
    const duplicate = await createLocalCompanionEvent(input);
    expect(duplicate.id).toBe(first.id);
    expect((await getLocalCompanionProgression('user-a')).totalPoints).toBe(10);
  });

  it('keeps a goal and its children deleted after a stale sync round-trip', async () => {
    const goal = await createLocalGoal({
      id: '70000000-0000-4000-8000-000000000001',
      userId: 'user-a',
      title: 'Private chapter',
      kind: 'chapter',
    });
    await createLocalGoalMilestone({
      userId: 'user-a',
      goalId: goal.id,
      title: 'First milestone',
    });
    await createLocalHabit({
      userId: 'user-a',
      goalId: goal.id,
      title: 'Daily step',
    });
    await tombstoneLocalGoal({ id: goal.id, userId: 'user-a' });
    await mergeRemoteGoals([{ ...goal, updated_at: '2000-01-01T00:00:00.000Z' }]);

    expect(await listLocalGoals('user-a')).toEqual([]);
    expect(await listLocalGoalMilestones('user-a', goal.id)).toEqual([]);
    expect(await listLocalHabits('user-a')).toEqual([]);
    expect((await getOfflineDb().goals.get(goal.id))?.deleted_at).toBeTruthy();
  });

  it('pauses a goal without awarding completion points, and renaming a milestone is not a completion', async () => {
    const goal = await createLocalGoal({ userId: 'user-a', title: 'Find better work' });
    const milestone = await createLocalGoalMilestone({
      userId: 'user-a',
      goalId: goal.id,
      title: 'List five places',
    });
    await updateLocalGoalMilestone({
      id: milestone.id,
      userId: 'user-a',
      title: 'Follow up with Ate Rina',
    });
    await setLocalGoalStatus({ id: goal.id, userId: 'user-a', status: 'paused' });

    const renamed = (await listLocalGoalMilestones('user-a', goal.id))[0];
    expect(renamed?.title).toBe('Follow up with Ate Rina');
    expect(renamed?.completed_at).toBeNull();
    expect((await listLocalGoals('user-a'))[0]?.status).toBe('paused');
    const progression = await getLocalCompanionProgression('user-a');
    expect(progression.eventCounts.goal_completed).toBe(0);
    expect(progression.eventCounts.milestone_completed).toBe(0);
    expect(progression.totalPoints).toBe(0);
  });

  it('releases a goal without awarding completion points', async () => {
    const goal = await createLocalGoal({ userId: 'user-a', title: 'A chapter I am setting down' });
    await setLocalGoalStatus({ id: goal.id, userId: 'user-a', status: 'released' });

    expect((await listLocalGoals('user-a'))[0]?.status).toBe('released');
    expect((await listLocalGoals('user-a'))[0]?.completed_at).toBeNull();
    const progression = await getLocalCompanionProgression('user-a');
    expect(progression.eventCounts.goal_completed).toBe(0);
    expect(progression.totalPoints).toBe(0);
  });
});
