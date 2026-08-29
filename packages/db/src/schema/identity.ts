import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, deletedAt, serverSeq, serverUpdatedAt, updatedAt } from './columns';
import {
  INBOX_KINDS,
  LIFE_AREAS,
  PRIVACY_LEVELS,
  RECORD_PROVENANCE,
  sqlIn,
} from './constants';

const privacyColumns = (
  readDefault: boolean,
  privacyDefault: 'private' | 'standard' = 'standard',
) => ({
  privacy_level: text('privacy_level').notNull().default(privacyDefault),
  mus_may_read: boolean('mus_may_read').notNull().default(readDefault),
  mus_may_remember: boolean('mus_may_remember').notNull().default(false),
  provenance: text('provenance').notNull().default('user'),
});

export const futureSelves = pgTable(
  'future_selves',
  {
    user_id: uuid('user_id').primaryKey(),
    statement: text('statement').notNull(),
    ...privacyColumns(true),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
    server_seq: serverSeq,
    deleted_at: deletedAt,
  },
  (table) => [
    index('future_selves_server_updated_at_idx').on(table.server_updated_at),
    uniqueIndex('future_selves_owner_server_seq_uidx').on(
      table.user_id,
      table.server_seq,
    ),
    check(
      'future_selves_statement_len',
      sql`char_length(trim(${table.statement})) between 1 and 2000`,
    ),
    check(
      'future_selves_privacy_check',
      sql`${table.privacy_level} in (${sql.raw(sqlIn(PRIVACY_LEVELS))})`,
    ),
    check(
      'future_selves_provenance_check',
      sql`${table.provenance} in (${sql.raw(sqlIn(RECORD_PROVENANCE))})`,
    ),
  ],
);

export const compasses = pgTable(
  'compasses',
  {
    user_id: uuid('user_id').primaryKey(),
    matters_now: text('matters_now'),
    protect: text('protect'),
    struggling_with: text('struggling_with'),
    do_not_become: text('do_not_become'),
    active_areas: text('active_areas')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    ...privacyColumns(true),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
    server_seq: serverSeq,
    deleted_at: deletedAt,
  },
  (table) => [
    index('compasses_server_updated_at_idx').on(table.server_updated_at),
    uniqueIndex('compasses_owner_server_seq_uidx').on(table.user_id, table.server_seq),
    check(
      'compasses_privacy_check',
      sql`${table.privacy_level} in (${sql.raw(sqlIn(PRIVACY_LEVELS))})`,
    ),
    check(
      'compasses_provenance_check',
      sql`${table.provenance} in (${sql.raw(sqlIn(RECORD_PROVENANCE))})`,
    ),
    check(
      'compasses_active_areas_check',
      sql`${table.active_areas} <@ array[${sql.raw(sqlIn(LIFE_AREAS))}]::text[]`,
    ),
  ],
);

export const inboxItems = pgTable(
  'inbox_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull(),
    kind: text('kind').notNull().default('note'),
    content: text('content').notNull(),
    life_area: text('life_area'),
    processed_at: timestamp('processed_at', { withTimezone: true, mode: 'string' }),
    ...privacyColumns(false, 'private'),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
    server_seq: serverSeq,
    deleted_at: deletedAt,
  },
  (table) => [
    index('inbox_items_user_updated_idx').on(table.user_id, table.updated_at),
    index('inbox_items_server_updated_at_idx').on(table.server_updated_at),
    uniqueIndex('inbox_items_owner_server_seq_uidx').on(table.user_id, table.server_seq),
    check(
      'inbox_items_content_len',
      sql`char_length(trim(${table.content})) between 1 and 4000`,
    ),
    check(
      'inbox_items_kind_check',
      sql`${table.kind} in (${sql.raw(sqlIn(INBOX_KINDS))})`,
    ),
    check(
      'inbox_items_area_check',
      sql`${table.life_area} is null or ${table.life_area} in (${sql.raw(sqlIn(LIFE_AREAS))})`,
    ),
    check(
      'inbox_items_privacy_check',
      sql`${table.privacy_level} in (${sql.raw(sqlIn(PRIVACY_LEVELS))})`,
    ),
    check(
      'inbox_items_provenance_check',
      sql`${table.provenance} in (${sql.raw(sqlIn(RECORD_PROVENANCE))})`,
    ),
  ],
);

export const personalRules = pgTable(
  'personal_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull(),
    title: text('title').notNull(),
    active: boolean('active').notNull().default(true),
    ...privacyColumns(true),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
    server_seq: serverSeq,
    deleted_at: deletedAt,
  },
  (table) => [
    index('personal_rules_user_active_idx').on(table.user_id, table.active),
    index('personal_rules_server_updated_at_idx').on(table.server_updated_at),
    uniqueIndex('personal_rules_owner_server_seq_uidx').on(
      table.user_id,
      table.server_seq,
    ),
    check(
      'personal_rules_title_len',
      sql`char_length(trim(${table.title})) between 1 and 200`,
    ),
    check(
      'personal_rules_privacy_check',
      sql`${table.privacy_level} in (${sql.raw(sqlIn(PRIVACY_LEVELS))})`,
    ),
    check(
      'personal_rules_provenance_check',
      sql`${table.provenance} in (${sql.raw(sqlIn(RECORD_PROVENANCE))})`,
    ),
  ],
);
