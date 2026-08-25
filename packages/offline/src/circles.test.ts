import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getOfflineDb, resetOfflineDb } from './db';
import {
  createLocalCircle,
  getLocalSocialPrefs,
  listLocalCircles,
  saveLocalSocialPrefs,
  updateLocalCircle,
} from './circles';

describe('local circles', () => {
  beforeEach(resetOfflineDb);
  afterEach(resetOfflineDb);

  it('stays off by default and never queues a social sync', async () => {
    expect((await getLocalSocialPrefs('user-a')).enabled).toBe(false);
    const circle = await createLocalCircle({
      userId: 'user-a',
      name: 'Gym friends',
      kind: 'gym',
    });
    expect(circle.facets).toEqual(['workout_count']);
    expect((await listLocalCircles('user-a')).map((row) => row.name)).toEqual(['Gym friends']);
    expect(await getOfflineDb().sync_queue.count()).toBe(0);
  });

  it('drops forbidden share fields when saving visibility', async () => {
    const circle = await createLocalCircle({
      userId: 'user-a',
      name: 'Church group',
      kind: 'church',
    });
    const next = await updateLocalCircle({
      id: circle.id,
      userId: 'user-a',
      facets: ['selected_goals', 'kcal', 'weight', 'faith'],
      selectedGoalIds: ['goal-1'],
    });
    expect(next?.facets).toEqual(['selected_goals']);
    expect(next?.selected_goal_ids).toEqual(['goal-1']);
    await saveLocalSocialPrefs({ userId: 'user-a', enabled: true });
    expect((await getLocalSocialPrefs('user-a')).enabled).toBe(true);
    expect(await getOfflineDb().sync_queue.count()).toBe(0);
  });
});
