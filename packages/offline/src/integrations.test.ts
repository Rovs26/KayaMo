import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getOfflineDb, resetOfflineDb } from './db';
import {
  createLocalBusyBlock,
  getLocalActionGrants,
  listLocalBusyBlocks,
  saveLocalActionGrant,
  tombstoneLocalBusyBlock,
} from './integrations';

describe('local commitments and action grants', () => {
  beforeEach(resetOfflineDb);
  afterEach(resetOfflineDb);

  it('stores a manual busy block on this device without queueing calendar sync', async () => {
    const row = await createLocalBusyBlock({
      userId: 'user-a',
      title: 'Thesis class',
      logicalDate: '2026-08-25',
      startsAt: '09:00',
      endsAt: '12:00',
    });
    expect((await listLocalBusyBlocks('user-a', '2026-08-25')).map((item) => item.title)).toEqual([
      'Thesis class',
    ]);
    expect(await getOfflineDb().sync_queue.count()).toBe(0);
    await tombstoneLocalBusyBlock({ id: row.id, userId: 'user-a' });
    expect(await listLocalBusyBlocks('user-a', '2026-08-25')).toEqual([]);
  });

  it('keeps Mus action grants on-device and never infers auto-manage', async () => {
    await saveLocalActionGrant({
      userId: 'user-a',
      integrationId: 'calendar',
      level: 'suggest',
    });
    expect(await getLocalActionGrants('user-a')).toEqual({ calendar: 'suggest' });
    expect(await getOfflineDb().sync_queue.count()).toBe(0);
  });
});
