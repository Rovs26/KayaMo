import type {
  Compass,
  CompassInsert,
  FutureSelf,
  FutureSelfInsert,
  InboxItem,
  InboxItemInsert,
  PersonalRule,
  PersonalRuleInsert,
} from '../database';
import type { DbClient } from './client';
import { throwIfError } from './errors';
import { clampUpdatedAtIso, omitServerCursor } from './lww';

export type FutureSelfWrite = FutureSelfInsert;
export type CompassWrite = CompassInsert;
export type InboxItemWrite = Omit<InboxItemInsert, 'id' | 'created_at'> & {
  id: string;
  created_at?: string;
};
export type PersonalRuleWrite = Omit<PersonalRuleInsert, 'id' | 'created_at'> & {
  id: string;
  created_at?: string;
};

export type IdentityUpsertResult<T> =
  | { applied: true; reason: 'inserted' | 'updated'; row: T }
  | { applied: false; reason: 'stale_or_tombstoned'; row: T | null };

async function upsertByUserId<T>(
  client: DbClient,
  table: 'future_selves' | 'compasses',
  row: { user_id: string; updated_at: string },
): Promise<IdentityUpsertResult<T>> {
  const payload = {
    ...omitServerCursor(row),
    updated_at: clampUpdatedAtIso(row.updated_at),
  };
  const updated = await client
    .from(table)
    .update(payload as never)
    .eq('user_id', row.user_id)
    .is('deleted_at', null)
    .lt('updated_at', payload.updated_at)
    .select('*');
  throwIfError(updated.error);
  if (updated.data?.[0]) return { applied: true, reason: 'updated', row: updated.data[0] as T };
  const inserted = await client
    .from(table)
    .insert(payload as never)
    .select('*')
    .maybeSingle();
  if (inserted.error?.code === '23505') {
    const existing = await client
      .from(table)
      .select('*')
      .eq('user_id', row.user_id)
      .maybeSingle();
    throwIfError(existing.error);
    return { applied: false, reason: 'stale_or_tombstoned', row: (existing.data as T) ?? null };
  }
  throwIfError(inserted.error);
  if (inserted.data) return { applied: true, reason: 'inserted', row: inserted.data as T };
  return { applied: false, reason: 'stale_or_tombstoned', row: null };
}

async function upsertById<T>(
  client: DbClient,
  table: 'inbox_items' | 'personal_rules',
  row: { id: string; user_id: string; updated_at: string },
): Promise<IdentityUpsertResult<T>> {
  const payload = {
    ...omitServerCursor(row),
    updated_at: clampUpdatedAtIso(row.updated_at),
  };
  const updated = await client
    .from(table)
    .update(payload as never)
    .eq('id', row.id)
    .eq('user_id', row.user_id)
    .is('deleted_at', null)
    .lt('updated_at', payload.updated_at)
    .select('*');
  throwIfError(updated.error);
  if (updated.data?.[0]) return { applied: true, reason: 'updated', row: updated.data[0] as T };
  const inserted = await client
    .from(table)
    .insert(payload as never)
    .select('*')
    .maybeSingle();
  if (inserted.error?.code !== '23505') throwIfError(inserted.error);
  if (inserted.data) return { applied: true, reason: 'inserted', row: inserted.data as T };
  const existing = await client
    .from(table)
    .select('*')
    .eq('id', row.id)
    .eq('user_id', row.user_id)
    .maybeSingle();
  throwIfError(existing.error);
  return { applied: false, reason: 'stale_or_tombstoned', row: (existing.data as T) ?? null };
}

export const upsertFutureSelf = (client: DbClient, row: FutureSelfWrite) =>
  upsertByUserId<FutureSelf>(client, 'future_selves', row);

export const upsertCompass = (client: DbClient, row: CompassWrite) =>
  upsertByUserId<Compass>(client, 'compasses', row);

export const upsertInboxItem = (client: DbClient, row: InboxItemWrite) =>
  upsertById<InboxItem>(client, 'inbox_items', row);

export const upsertPersonalRule = (client: DbClient, row: PersonalRuleWrite) =>
  upsertById<PersonalRule>(client, 'personal_rules', row);
