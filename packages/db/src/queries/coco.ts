import type {
  AgentMemory,
  AgentMemoryInsert,
  CocoConversation,
  CocoConversationInsert,
  CocoMessage,
  CocoMessageInsert,
} from '../database';
import type { DbClient } from './client';
import { DbQueryError, throwIfError } from './errors';
import { clampUpdatedAtIso, omitServerCursor } from './lww';

export type AgentMemoryWrite = Omit<AgentMemoryInsert, 'created_at' | 'id'> & {
  id: string;
  created_at?: string;
};
export type CocoConversationWrite = Omit<CocoConversationInsert, 'created_at' | 'id'> & {
  id: string;
  created_at?: string;
};
export type CocoMessageWrite = Omit<CocoMessageInsert, 'created_at' | 'id'> & {
  id: string;
  created_at?: string;
};

export type CocoUpsertResult<T> =
  | { applied: true; reason: 'inserted' | 'updated'; row: T }
  | { applied: false; reason: 'stale_or_tombstoned'; row: T | null };

function memoryInsert(row: AgentMemoryWrite): AgentMemoryInsert {
  return {
    ...omitServerCursor(row),
    content: row.content.trim(),
    explicit: true,
    updated_at: clampUpdatedAtIso(row.updated_at),
  };
}

function conversationInsert(row: CocoConversationWrite): CocoConversationInsert {
  return {
    ...omitServerCursor(row),
    title: row.title?.trim() || null,
    updated_at: clampUpdatedAtIso(row.updated_at),
  };
}

function messageInsert(row: CocoMessageWrite): CocoMessageInsert {
  return {
    ...omitServerCursor(row),
    content: row.content.trim(),
    updated_at: clampUpdatedAtIso(row.updated_at),
  };
}

export async function listAgentMemories(
  client: DbClient,
  userId: string,
): Promise<AgentMemory[]> {
  const { data, error } = await client
    .from('agent_memory')
    .select('*')
    .eq('user_id', userId)
    .eq('explicit', true)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });
  throwIfError(error);
  return data ?? [];
}

export async function listCocoConversations(
  client: DbClient,
  userId: string,
): Promise<CocoConversation[]> {
  const { data, error } = await client
    .from('coco_conversations')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });
  throwIfError(error);
  return data ?? [];
}

export async function listCocoMessages(
  client: DbClient,
  params: { userId: string; conversationId: string },
): Promise<CocoMessage[]> {
  const { data, error } = await client
    .from('coco_messages')
    .select('*')
    .eq('user_id', params.userId)
    .eq('conversation_id', params.conversationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  throwIfError(error);
  return data ?? [];
}

async function getMemory(
  client: DbClient,
  id: string,
  userId: string,
): Promise<AgentMemory | null> {
  const { data, error } = await client
    .from('agent_memory')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  throwIfError(error);
  return data;
}

async function getConversation(
  client: DbClient,
  id: string,
  userId: string,
): Promise<CocoConversation | null> {
  const { data, error } = await client
    .from('coco_conversations')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  throwIfError(error);
  return data;
}

async function getMessage(
  client: DbClient,
  id: string,
  userId: string,
): Promise<CocoMessage | null> {
  const { data, error } = await client
    .from('coco_messages')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  throwIfError(error);
  return data;
}

export async function upsertAgentMemory(
  client: DbClient,
  row: AgentMemoryWrite,
): Promise<CocoUpsertResult<AgentMemory>> {
  const payload = memoryInsert(row);
  const { data: updated, error: updateError } = await client
    .from('agent_memory')
    .update(payload)
    .eq('id', row.id)
    .eq('user_id', row.user_id)
    .is('deleted_at', null)
    .lt('updated_at', payload.updated_at)
    .select('*');
  throwIfError(updateError);
  if (updated?.[0]) return { applied: true, reason: 'updated', row: updated[0] };
  const { data: inserted, error } = await client
    .from('agent_memory')
    .insert(payload)
    .select('*')
    .maybeSingle();
  if (error?.code === '23505') {
    return {
      applied: false,
      reason: 'stale_or_tombstoned',
      row: await getMemory(client, row.id, row.user_id),
    };
  }
  throwIfError(error);
  if (inserted) return { applied: true, reason: 'inserted', row: inserted };
  return {
    applied: false,
    reason: 'stale_or_tombstoned',
    row: await getMemory(client, row.id, row.user_id),
  };
}

export async function upsertCocoConversation(
  client: DbClient,
  row: CocoConversationWrite,
): Promise<CocoUpsertResult<CocoConversation>> {
  const payload = conversationInsert(row);
  const { data: updated, error: updateError } = await client
    .from('coco_conversations')
    .update(payload)
    .eq('id', row.id)
    .eq('user_id', row.user_id)
    .is('deleted_at', null)
    .lt('updated_at', payload.updated_at)
    .select('*');
  throwIfError(updateError);
  if (updated?.[0]) return { applied: true, reason: 'updated', row: updated[0] };
  const { data: inserted, error } = await client
    .from('coco_conversations')
    .insert(payload)
    .select('*')
    .maybeSingle();
  if (error?.code === '23505') {
    return {
      applied: false,
      reason: 'stale_or_tombstoned',
      row: await getConversation(client, row.id, row.user_id),
    };
  }
  throwIfError(error);
  if (inserted) return { applied: true, reason: 'inserted', row: inserted };
  return {
    applied: false,
    reason: 'stale_or_tombstoned',
    row: await getConversation(client, row.id, row.user_id),
  };
}

export async function upsertCocoMessage(
  client: DbClient,
  row: CocoMessageWrite,
): Promise<CocoUpsertResult<CocoMessage>> {
  const payload = messageInsert(row);
  const { data: updated, error: updateError } = await client
    .from('coco_messages')
    .update(payload)
    .eq('id', row.id)
    .eq('user_id', row.user_id)
    .is('deleted_at', null)
    .lt('updated_at', payload.updated_at)
    .select('*');
  throwIfError(updateError);
  if (updated?.[0]) return { applied: true, reason: 'updated', row: updated[0] };
  const { data: inserted, error } = await client
    .from('coco_messages')
    .insert(payload)
    .select('*')
    .maybeSingle();
  if (error?.code === '23505') {
    return {
      applied: false,
      reason: 'stale_or_tombstoned',
      row: await getMessage(client, row.id, row.user_id),
    };
  }
  throwIfError(error);
  if (inserted) return { applied: true, reason: 'inserted', row: inserted };
  return {
    applied: false,
    reason: 'stale_or_tombstoned',
    row: await getMessage(client, row.id, row.user_id),
  };
}

async function tombstoneCocoRow(
  client: DbClient,
  table: 'agent_memory' | 'coco_conversations' | 'coco_messages',
  params: { id: string; userId: string; updatedAt: string },
): Promise<void> {
  const updatedAt = clampUpdatedAtIso(params.updatedAt);
  const { count, error } = await client
    .from(table)
    .update({ deleted_at: updatedAt, updated_at: updatedAt }, { count: 'exact' })
    .eq('id', params.id)
    .eq('user_id', params.userId)
    .is('deleted_at', null);
  throwIfError(error);
  if (!count) throw new DbQueryError(`tombstone ${table} matched no live row`);
}

export async function tombstoneAgentMemory(
  client: DbClient,
  params: { id: string; userId: string; updatedAt: string },
): Promise<void> {
  return tombstoneCocoRow(client, 'agent_memory', params);
}

export async function tombstoneCocoConversation(
  client: DbClient,
  params: { id: string; userId: string; updatedAt: string },
): Promise<void> {
  return tombstoneCocoRow(client, 'coco_conversations', params);
}

export async function tombstoneCocoMessage(
  client: DbClient,
  params: { id: string; userId: string; updatedAt: string },
): Promise<void> {
  return tombstoneCocoRow(client, 'coco_messages', params);
}
