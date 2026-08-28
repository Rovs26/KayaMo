import type { DbClient } from '@kayamo/db';
import { getProfile } from '@kayamo/db';

export const DEFAULT_FOOD_HISTORY_DAYS = 30;

/** Resolve diary settings; the generic bidirectional sync owns history ingestion. */
export async function hydrateFoodHistory(params: {
  client: DbClient;
  userId: string;
  historyDays?: number;
}): Promise<{ timeZone: string; dayStartsAt: string }> {
  const profile = await getProfile(params.client, params.userId);
  const timeZone = profile?.timezone ?? 'Asia/Manila';
  const dayStartsAt = profile?.day_starts_at ?? '00:00:00';
  void params.historyDays;
  return { timeZone, dayStartsAt };
}
