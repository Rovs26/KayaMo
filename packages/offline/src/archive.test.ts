import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getOfflineDb, resetOfflineDb } from './db';
import {
  closeLocalGroveChapter,
  createLocalLifeStoryEntry,
  listLocalGroveChapters,
  listLocalLifeStory,
} from './archive';

describe('local life story and chapter close', () => {
  beforeEach(resetOfflineDb);
  afterEach(resetOfflineDb);

  it('stores a confirmed story beat without queueing sync or health fields', async () => {
    await createLocalLifeStoryEntry({
      userId: 'user-a',
      draft: {
        title: 'Thesis chapter reached',
        summary: 'Reached, after you confirmed it.',
        happenedOn: '2026-08-25',
        kind: 'goal_completed',
        professional: true,
        sourceId: 'goal-1',
      },
    });
    const rows = await listLocalLifeStory('user-a');
    expect(rows.map((row) => row.title)).toEqual(['Thesis chapter reached']);
    expect(await getOfflineDb().sync_queue.count()).toBe(0);
  });

  it('closes a grove chapter without lowering points', async () => {
    const chapter = await closeLocalGroveChapter({
      userId: 'user-a',
      closedOn: '2026-08-25',
      fields: {
        changed: 'I keep Sunday rest',
        accomplished: 'One chapter drafted',
        letGo: '',
        learned: '',
        carries: 'Sleep before midnight',
      },
    });
    expect(chapter.summary).toMatch(/Sunday rest/);
    expect((await listLocalGroveChapters('user-a')).map((row) => row.id)).toEqual([chapter.id]);
    expect(await getOfflineDb().sync_queue.count()).toBe(0);
  });
});
