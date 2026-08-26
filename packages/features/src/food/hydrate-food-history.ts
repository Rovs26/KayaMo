import type { DbClient } from '@kayamo/db';
import { getProfile, listFoodEntriesSince, listMealTemplates } from '@kayamo/db';
import { shiftLogicalDate } from '@kayamo/food/quick-log';
import {
  logicalDateFromInstant,
  mergeRemoteFoodEntries,
  mergeRemoteMealTemplates,
} from '@kayamo/offline';

export const DEFAULT_FOOD_HISTORY_DAYS = 30;

/** Pull food entries (and templates) from Supabase into Dexie. Sync itself only pushes. */
export async function hydrateFoodHistory(params: {
  client: DbClient;
  userId: string;
  historyDays?: number;
}): Promise<{ timeZone: string; dayStartsAt: string }> {
  const profile = await getProfile(params.client, params.userId);
  const timeZone = profile?.timezone ?? 'Asia/Manila';
  const dayStartsAt = profile?.day_starts_at ?? '00:00:00';
  const days = params.historyDays ?? DEFAULT_FOOD_HISTORY_DAYS;
  const since = shiftLogicalDate(
    logicalDateFromInstant(new Date().toISOString(), timeZone, dayStartsAt),
    -days,
  );
  const [remoteEntries, remoteTemplates] = await Promise.all([
    listFoodEntriesSince(params.client, { userId: params.userId, sinceLogicalDate: since }),
    listMealTemplates(params.client, params.userId),
  ]);
  await mergeRemoteFoodEntries(remoteEntries);
  await mergeRemoteMealTemplates(remoteTemplates);
  return { timeZone, dayStartsAt };
}
