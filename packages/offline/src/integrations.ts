import type { ActionLevel, IntegrationId } from '@kayamo/core';
import { ACTION_LEVELS, INTEGRATION_IDS } from '@kayamo/core';
import { getOfflineDb, type LocalActionGrants, type LocalBusyBlock } from './db';

const newId = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

function isActionLevel(value: string): value is ActionLevel {
  return (ACTION_LEVELS as readonly string[]).includes(value);
}

function isIntegrationId(value: string): value is IntegrationId {
  return (INTEGRATION_IDS as readonly string[]).includes(value);
}

export async function createLocalBusyBlock(input: {
  userId: string;
  title: string;
  logicalDate: string;
  startsAt?: string | null;
  endsAt?: string | null;
  id?: string;
}): Promise<LocalBusyBlock> {
  const at = nowIso();
  const row: LocalBusyBlock = {
    id: input.id ?? newId(),
    user_id: input.userId,
    title: input.title.trim(),
    logical_date: input.logicalDate,
    starts_at: input.startsAt?.trim() || null,
    ends_at: input.endsAt?.trim() || null,
    created_at: at,
    updated_at: at,
    deleted_at: null,
  };
  await getOfflineDb().busy_blocks.put(row);
  return row;
}

export async function listLocalBusyBlocks(
  userId: string,
  logicalDate?: string,
): Promise<LocalBusyBlock[]> {
  return (await getOfflineDb().busy_blocks.where('user_id').equals(userId).toArray())
    .filter((row) => !row.deleted_at && (!logicalDate || row.logical_date === logicalDate))
    .sort((a, b) => (a.starts_at ?? '').localeCompare(b.starts_at ?? '') || a.created_at.localeCompare(b.created_at));
}

export async function tombstoneLocalBusyBlock(params: {
  id: string;
  userId: string;
}): Promise<void> {
  const db = getOfflineDb();
  const existing = await db.busy_blocks.get(params.id);
  if (!existing || existing.user_id !== params.userId || existing.deleted_at) return;
  const at = nowIso();
  await db.busy_blocks.put({ ...existing, deleted_at: at, updated_at: at });
}

export async function getLocalActionGrants(userId: string): Promise<Partial<Record<IntegrationId, ActionLevel>>> {
  const row = await getOfflineDb().action_grants.get(userId);
  if (!row) return {};
  const levels: Partial<Record<IntegrationId, ActionLevel>> = {};
  for (const [key, value] of Object.entries(row.levels)) {
    if (isIntegrationId(key) && isActionLevel(value)) levels[key] = value;
  }
  return levels;
}

export async function saveLocalActionGrant(input: {
  userId: string;
  integrationId: IntegrationId;
  level: ActionLevel;
}): Promise<LocalActionGrants> {
  const db = getOfflineDb();
  const existing = await db.action_grants.get(input.userId);
  const at = nowIso();
  const row: LocalActionGrants = {
    user_id: input.userId,
    levels: { ...(existing?.levels ?? {}), [input.integrationId]: input.level },
    updated_at: at,
  };
  await db.action_grants.put(row);
  return row;
}
