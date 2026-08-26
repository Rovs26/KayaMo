import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  completeLocalEveningReflection,
  createLocalFocusSession,
  finishLocalFocusSession,
  getLocalDailyPlan,
  listLocalDailyPlans,
  listLocalFocusHistory,
  listLocalScripture,
  mergeRemoteDailyPlans,
  saveLocalDailyPlan,
  startLocalFocusSession,
  mergeRemoteFocusSessions,
  tombstoneLocalFocusSession,
  tombstoneLocalDailyPlan,
} from './daily-loop';
import { getOfflineDb, resetOfflineDb } from './db';

vi.mock('./sync', async () => {
  const status = await import('./status');
  return {
    drainQueue: vi.fn(async () => undefined), startSync: vi.fn(),
    getSyncStatusSnapshot: vi.fn(() => ({ kind: 'synced' })),
    bindStatusStore: status.subscribeSyncStatus, resumeSync: vi.fn(),
  };
});

describe('offline daily loop', () => {
  beforeEach(async () => resetOfflineDb());
  afterEach(async () => resetOfflineDb());

  it('persists a running focus timer from timestamps', async () => {
    const plan = await saveLocalDailyPlan({
      userId: 'user-a', logicalDate: '2026-08-22', actionKind: 'custom',
      label: 'Write one paragraph', completeMorning: true,
    });
    const session = await createLocalFocusSession({
      userId: 'user-a', logicalDate: '2026-08-22', dailyPlanId: plan.id,
      targetKind: 'custom', targetLabel: 'Write one paragraph', plannedMinutes: 25,
    });
    const active = await startLocalFocusSession({
      id: session.id, userId: 'user-a', startedAt: '2026-08-22T08:00:00.000Z',
    });
    expect(active?.ends_at).toBe('2026-08-22T08:25:00.000Z');
    expect((await getOfflineDb().focus_sessions.get(session.id))?.status).toBe('active');
  });

  it('keeps a daily plan tombstoned after a stale sync round-trip', async () => {
    const live = await saveLocalDailyPlan({
      id: 'f1000000-0000-4000-8000-000000000001', userId: 'user-a',
      logicalDate: '2026-08-22', actionKind: 'custom', label: 'Take one step',
    });
    await tombstoneLocalDailyPlan({ id: live.id, userId: 'user-a' });
    await mergeRemoteDailyPlans([{ ...live, updated_at: '2000-01-01T00:00:00.000Z' }]);
    expect(await getLocalDailyPlan('user-a', '2026-08-22')).toBeNull();
    expect((await getOfflineDb().daily_plans.get(live.id))?.deleted_at).toBeTruthy();
  });

  it('keeps a focus session tombstoned after a stale sync round-trip', async () => {
    const live = await createLocalFocusSession({
      id: 'f2000000-0000-4000-8000-000000000001', userId: 'user-a',
      logicalDate: '2026-08-22', targetKind: 'custom', targetLabel: 'Read one page',
    });
    await tombstoneLocalFocusSession({ id: live.id, userId: 'user-a' });
    await mergeRemoteFocusSessions([{ ...live, updated_at: '2000-01-01T00:00:00.000Z' }]);
    expect((await getOfflineDb().focus_sessions.get(live.id))?.deleted_at).toBeTruthy();
  });

  it('keeps reflection and gratitude local-only', async () => {
    const privateReflection = 'KAYAMO_PRIVATE_REFLECTION_SENTINEL_94721';
    const privateGratitude = 'KAYAMO_PRIVATE_GRATITUDE_SENTINEL_94721';
    await saveLocalDailyPlan({
      userId: 'user-a', logicalDate: '2026-08-22',
      tomorrowNote: 'Review the plan after breakfast.',
    });
    await completeLocalEveningReflection({
      userId: 'user-a', logicalDate: '2026-08-22',
      reflection: privateReflection, gratitude: privateGratitude,
    });
    const entries = await getOfflineDb().local_journal_entries.toArray();
    expect(entries.map((row) => row.kind).sort()).toEqual(['gratitude', 'reflection']);
    expect(entries.find((row) => row.kind === 'reflection')?.content).toBe(privateReflection);
    expect(entries.find((row) => row.kind === 'gratitude')?.content).toBe(privateGratitude);

    const plan = await getLocalDailyPlan('user-a', '2026-08-22');
    expect(plan?.tomorrow_note).toBe('Review the plan after breakfast.');
    expect(JSON.stringify(plan)).not.toContain(privateReflection);
    expect(JSON.stringify(plan)).not.toContain(privateGratitude);

    const queue = await getOfflineDb().sync_queue.toArray();
    expect(queue.every((item) => item.table !== ('local_journal_entries' as never))).toBe(true);
    expect(JSON.stringify(queue)).not.toContain(privateReflection);
    expect(JSON.stringify(queue)).not.toContain(privateGratitude);
  });

  it('lists focus history across days for duration learning', async () => {
    const plan = await saveLocalDailyPlan({
      userId: 'user-a', logicalDate: '2026-08-22', actionKind: 'custom',
      label: 'Write one paragraph', completeMorning: true,
    });
    const session = await createLocalFocusSession({
      userId: 'user-a', logicalDate: '2026-08-22', dailyPlanId: plan.id,
      targetKind: 'custom', targetLabel: 'Write one paragraph', plannedMinutes: 25,
    });
    await startLocalFocusSession({
      id: session.id, userId: 'user-a', startedAt: '2026-08-22T08:00:00.000Z',
    });
    await finishLocalFocusSession({
      id: session.id, userId: 'user-a', outcome: 'completed', at: '2026-08-22T08:18:00.000Z',
    });
    expect((await listLocalDailyPlans('user-a')).map((row) => row.logical_date)).toEqual(['2026-08-22']);
    expect((await listLocalFocusHistory('user-a')).map((row) => row.id)).toEqual([session.id]);
  });

  it('does not expose Scripture until faith mode is enabled', async () => {
    expect(await listLocalScripture({ faithEnabled: false })).toEqual([]);
    expect((await listLocalScripture({ faithEnabled: true, tag: 'hope' })).length).toBeGreaterThan(0);
  });
});
