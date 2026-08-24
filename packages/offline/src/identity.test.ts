import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getOfflineDb, resetOfflineDb, type LocalCompass } from './db';
import {
  createLocalInboxItem,
  createLocalPersonalRule,
  getLocalCompass,
  getLocalFutureSelf,
  listLocalInboxItems,
  listLocalPersonalRules,
  mergeRemoteInboxItems,
  processLocalInboxItem,
  saveLocalCompass,
  saveLocalFutureSelf,
  tombstoneLocalInboxItem,
} from './identity';

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

describe('offline identity and inbox', () => {
  beforeEach(resetOfflineDb);
  afterEach(resetOfflineDb);

  it('saves a future-self statement for later becoming-loop work', async () => {
    const row = await saveLocalFutureSelf({
      userId: 'user-a',
      statement: 'I am becoming someone who keeps promises to myself.',
    });
    expect(row.mus_may_read).toBe(true);
    expect(await getLocalFutureSelf('user-a')).toMatchObject({
      statement: 'I am becoming someone who keeps promises to myself.',
    });
    const queued = await getOfflineDb().sync_queue.get(`future_selves:${row.user_id}`);
    expect(queued?.table).toBe('future_selves');
  });

  it('keeps Life Inbox private from Mus unless the user opts in', async () => {
    const item = await createLocalInboxItem({
      userId: 'user-a',
      content: 'Call Ate Rina about Sunday.',
    });
    expect(item.privacy_level).toBe('private');
    expect(item.mus_may_read).toBe(false);
    expect(item.mus_may_remember).toBe(false);
    expect((await listLocalInboxItems('user-a')).map((row) => row.content)).toEqual([
      'Call Ate Rina about Sunday.',
    ]);
  });

  it('does not resurrect a tombstoned inbox item from a stale sync', async () => {
    const live = await createLocalInboxItem({
      id: 'a1000000-0000-4000-8000-000000000001',
      userId: 'user-a',
      content: 'Private obligation',
    });
    await tombstoneLocalInboxItem({ id: live.id, userId: 'user-a' });
    await mergeRemoteInboxItems([{ ...live, updated_at: '2000-01-01T00:00:00.000Z' }]);
    expect(await listLocalInboxItems('user-a')).toEqual([]);
    expect((await getOfflineDb().inbox_items.get(live.id))?.deleted_at).toBeTruthy();
  });

  it('stores compass fields and personal rules without inventing Mus access', async () => {
    const compass = await saveLocalCompass({
      userId: 'user-a',
      mattersNow: 'Finish the thesis chapter',
      protect: 'Sunday rest',
    });
    const rule = await createLocalPersonalRule({
      userId: 'user-a',
      title: 'No training through pain',
      musMayRead: false,
    });
    expect(compass.matters_now).toBe('Finish the thesis chapter');
    expect(compass.active_areas).toEqual([]);
    expect(compass.mus_may_read).toBe(true);
    expect(rule.mus_may_read).toBe(false);
    expect((await listLocalPersonalRules('user-a')).map((row) => row.title)).toEqual([
      'No training through pain',
    ]);
  });

  it('treats a pre-migration compass without active_areas as an empty list', async () => {
    const at = new Date().toISOString();
    await getOfflineDb().compasses.put({
      user_id: 'user-a',
      matters_now: 'Sleep',
      protect: null,
      struggling_with: null,
      do_not_become: null,
      privacy_level: 'standard',
      mus_may_read: true,
      mus_may_remember: false,
      provenance: 'user',
      created_at: at,
      updated_at: at,
      server_updated_at: at,
      deleted_at: null,
    } as unknown as LocalCompass);
    expect((await getLocalCompass('user-a'))?.active_areas).toEqual([]);
  });

  it('marks an inbox item processed without granting Mus read access', async () => {
    const item = await createLocalInboxItem({
      userId: 'user-a',
      content: 'Pay the electric bill',
    });
    const processed = await processLocalInboxItem({ id: item.id, userId: 'user-a' });
    expect(processed?.processed_at).toBeTruthy();
    expect(processed?.mus_may_read).toBe(false);
    expect(await listLocalInboxItems('user-a')).toEqual([]);
  });
});
