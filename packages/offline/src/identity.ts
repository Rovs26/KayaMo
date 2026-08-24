import type {
  CompassWrite,
  FutureSelfWrite,
  InboxItemWrite,
  PersonalRuleWrite,
} from '@kayamo/db';
import { incomingWins, omitServerCursor } from '@kayamo/db';
import {
  getOfflineDb,
  type LocalCompass,
  type LocalFutureSelf,
  type LocalInboxItem,
  type LocalPersonalRule,
} from './db';
import { enqueueUpsert } from './queue';
import { drainQueue } from './sync';

const newId = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

const futureSelfPayload = (row: LocalFutureSelf): FutureSelfWrite => omitServerCursor(row);
const compassPayload = (row: LocalCompass): CompassWrite => omitServerCursor(row);
const inboxPayload = (row: LocalInboxItem): InboxItemWrite => omitServerCursor(row);
const rulePayload = (row: LocalPersonalRule): PersonalRuleWrite => omitServerCursor(row);

const identityDefaults = (readDefault: boolean, privacyDefault: LocalInboxItem['privacy_level']) => ({
  privacy_level: privacyDefault,
  mus_may_read: readDefault,
  mus_may_remember: false,
  provenance: 'user' as const,
});

export async function saveLocalFutureSelf(input: {
  userId: string;
  statement: string;
  musMayRead?: boolean;
  musMayRemember?: boolean;
  privacyLevel?: LocalFutureSelf['privacy_level'];
}): Promise<LocalFutureSelf> {
  const db = getOfflineDb();
  const existing = await db.future_selves.get(input.userId);
  const at = nowIso();
  const defaults = identityDefaults(true, 'standard');
  const row: LocalFutureSelf = {
    user_id: input.userId,
    statement: input.statement.trim(),
    privacy_level: input.privacyLevel ?? existing?.privacy_level ?? defaults.privacy_level,
    mus_may_read: input.musMayRead ?? existing?.mus_may_read ?? defaults.mus_may_read,
    mus_may_remember: input.musMayRemember ?? existing?.mus_may_remember ?? defaults.mus_may_remember,
    provenance: existing?.provenance ?? defaults.provenance,
    created_at: existing?.created_at ?? at,
    updated_at: at,
    server_updated_at: existing?.server_updated_at ?? at,
    deleted_at: null,
  };
  await db.future_selves.put(row);
  await enqueueUpsert('future_selves', row.user_id, futureSelfPayload(row));
  void drainQueue();
  return row;
}

export async function getLocalFutureSelf(userId: string): Promise<LocalFutureSelf | null> {
  const row = await getOfflineDb().future_selves.get(userId);
  return row && !row.deleted_at ? row : null;
}

export async function saveLocalCompass(input: {
  userId: string;
  mattersNow?: string | null;
  protect?: string | null;
  strugglingWith?: string | null;
  doNotBecome?: string | null;
  activeAreas?: LocalCompass['active_areas'];
  musMayRead?: boolean;
}): Promise<LocalCompass> {
  const db = getOfflineDb();
  const existing = await db.compasses.get(input.userId);
  const at = nowIso();
  const defaults = identityDefaults(true, 'standard');
  const row: LocalCompass = {
    user_id: input.userId,
    matters_now: input.mattersNow ?? existing?.matters_now ?? null,
    protect: input.protect ?? existing?.protect ?? null,
    struggling_with: input.strugglingWith ?? existing?.struggling_with ?? null,
    do_not_become: input.doNotBecome ?? existing?.do_not_become ?? null,
    active_areas: input.activeAreas ?? existing?.active_areas ?? [],
    privacy_level: existing?.privacy_level ?? defaults.privacy_level,
    mus_may_read: input.musMayRead ?? existing?.mus_may_read ?? defaults.mus_may_read,
    mus_may_remember: existing?.mus_may_remember ?? defaults.mus_may_remember,
    provenance: existing?.provenance ?? defaults.provenance,
    created_at: existing?.created_at ?? at,
    updated_at: at,
    server_updated_at: existing?.server_updated_at ?? at,
    deleted_at: null,
  };
  await db.compasses.put(row);
  await enqueueUpsert('compasses', row.user_id, compassPayload(row));
  void drainQueue();
  return row;
}

export async function getLocalCompass(userId: string): Promise<LocalCompass | null> {
  const row = await getOfflineDb().compasses.get(userId);
  if (!row || row.deleted_at) return null;
  return { ...row, active_areas: row.active_areas ?? [] };
}

export async function createLocalInboxItem(input: {
  userId: string;
  content: string;
  kind?: LocalInboxItem['kind'];
  lifeArea?: LocalInboxItem['life_area'];
  musMayRead?: boolean;
  id?: string;
}): Promise<LocalInboxItem> {
  const at = nowIso();
  const row: LocalInboxItem = {
    id: input.id ?? newId(),
    user_id: input.userId,
    kind: input.kind ?? 'note',
    content: input.content.trim(),
    life_area: input.lifeArea ?? null,
    processed_at: null,
    ...identityDefaults(false, 'private'),
    mus_may_read: input.musMayRead ?? false,
    created_at: at,
    updated_at: at,
    server_updated_at: at,
    deleted_at: null,
  };
  await getOfflineDb().inbox_items.put(row);
  await enqueueUpsert('inbox_items', row.id, inboxPayload(row));
  void drainQueue();
  return row;
}

export async function listLocalInboxItems(
  userId: string,
  options?: { includeProcessed?: boolean },
): Promise<LocalInboxItem[]> {
  return (await getOfflineDb().inbox_items.where('user_id').equals(userId).toArray())
    .filter(
      (row) =>
        !row.deleted_at && (options?.includeProcessed || !row.processed_at),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function processLocalInboxItem(params: {
  id: string;
  userId: string;
}): Promise<LocalInboxItem | null> {
  const db = getOfflineDb();
  const existing = await db.inbox_items.get(params.id);
  if (!existing || existing.user_id !== params.userId || existing.deleted_at) return null;
  const at = nowIso();
  const row = { ...existing, processed_at: existing.processed_at ?? at, updated_at: at };
  await db.inbox_items.put(row);
  await enqueueUpsert('inbox_items', row.id, inboxPayload(row));
  void drainQueue();
  return row;
}

export async function tombstoneLocalInboxItem(params: {
  id: string;
  userId: string;
}): Promise<void> {
  const db = getOfflineDb();
  const existing = await db.inbox_items.get(params.id);
  if (!existing || existing.user_id !== params.userId || existing.deleted_at) return;
  const at = nowIso();
  const row = { ...existing, deleted_at: at, updated_at: at };
  await db.inbox_items.put(row);
  await enqueueUpsert('inbox_items', row.id, inboxPayload(row));
  void drainQueue();
}

export async function createLocalPersonalRule(input: {
  userId: string;
  title: string;
  musMayRead?: boolean;
  id?: string;
}): Promise<LocalPersonalRule> {
  const at = nowIso();
  const row: LocalPersonalRule = {
    id: input.id ?? newId(),
    user_id: input.userId,
    title: input.title.trim(),
    active: true,
    ...identityDefaults(true, 'standard'),
    mus_may_read: input.musMayRead ?? true,
    created_at: at,
    updated_at: at,
    server_updated_at: at,
    deleted_at: null,
  };
  await getOfflineDb().personal_rules.put(row);
  await enqueueUpsert('personal_rules', row.id, rulePayload(row));
  void drainQueue();
  return row;
}

export async function listLocalPersonalRules(userId: string): Promise<LocalPersonalRule[]> {
  return (await getOfflineDb().personal_rules.where('user_id').equals(userId).toArray()).filter(
    (row) => !row.deleted_at && row.active,
  );
}

async function mergeByKey<T extends { updated_at?: string }>(
  get: (key: string) => Promise<T | undefined>,
  put: (row: T) => Promise<unknown>,
  key: (row: T) => string,
  rows: T[],
): Promise<void> {
  for (const row of rows) {
    const existing = await get(key(row));
    if (
      !existing ||
      !existing.updated_at ||
      !row.updated_at ||
      incomingWins(existing.updated_at, row.updated_at)
    ) {
      await put(row);
    }
  }
}

export const mergeRemoteFutureSelves = (rows: LocalFutureSelf[]) =>
  mergeByKey(
    (id) => getOfflineDb().future_selves.get(id),
    (row) => getOfflineDb().future_selves.put(row),
    (row) => row.user_id,
    rows,
  );

export const mergeRemoteCompasses = (rows: LocalCompass[]) =>
  mergeByKey(
    (id) => getOfflineDb().compasses.get(id),
    (row) => getOfflineDb().compasses.put(row),
    (row) => row.user_id,
    rows,
  );

export const mergeRemoteInboxItems = (rows: LocalInboxItem[]) =>
  mergeByKey(
    (id) => getOfflineDb().inbox_items.get(id),
    (row) => getOfflineDb().inbox_items.put(row),
    (row) => row.id,
    rows,
  );

export const mergeRemotePersonalRules = (rows: LocalPersonalRule[]) =>
  mergeByKey(
    (id) => getOfflineDb().personal_rules.get(id),
    (row) => getOfflineDb().personal_rules.put(row),
    (row) => row.id,
    rows,
  );
