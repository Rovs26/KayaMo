import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, deletedAt, serverUpdatedAt, updatedAt } from './columns';

export const cocoConversations = pgTable(
  'coco_conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull(),
    title: text('title'),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
    deleted_at: deletedAt,
  },
  (table) => [
    index('coco_conversations_user_updated_at_idx').on(
      table.user_id,
      table.updated_at.desc(),
    ),
    index('coco_conversations_server_updated_at_idx').on(table.server_updated_at),
    check(
      'coco_conversations_title_len',
      sql`${table.title} is null or char_length(trim(${table.title})) between 1 and 120`,
    ),
  ],
);

export const cocoMessages = pgTable(
  'coco_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull(),
    conversation_id: uuid('conversation_id')
      .notNull()
      .references(() => cocoConversations.id, { onDelete: 'restrict' }),
    role: text('role').notNull(),
    content: text('content').notNull(),
    response_source: text('response_source'),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
    deleted_at: deletedAt,
  },
  (table) => [
    index('coco_messages_conversation_created_at_idx').on(
      table.conversation_id,
      table.created_at,
    ),
    index('coco_messages_server_updated_at_idx').on(table.server_updated_at),
    check('coco_messages_role_check', sql`${table.role} in ('user', 'assistant')`),
    check(
      'coco_messages_content_len',
      sql`char_length(${table.content}) between 1 and 5000`,
    ),
    check(
      'coco_messages_response_source_check',
      sql`${table.response_source} is null or ${table.response_source} in ('model', 'fallback', 'safety', 'budget')`,
    ),
  ],
);
