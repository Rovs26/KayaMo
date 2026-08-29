import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, deletedAt, serverSeq, serverUpdatedAt, updatedAt } from './columns';
import { TASK_ORIGINS, sqlIn } from './constants';

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull(),
    title: text('title').notNull(),
    notes: text('notes'),
    scheduled_for: date('scheduled_for', { mode: 'string' }),
    due_at: timestamp('due_at', { withTimezone: true, mode: 'string' }),
    completed_at: timestamp('completed_at', { withTimezone: true, mode: 'string' }),
    sort_order: integer('sort_order').notNull().default(0),
    origin: text('origin').notNull().default('user'),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
    server_seq: serverSeq,
    deleted_at: deletedAt,
  },
  (table) => [
    index('tasks_user_scheduled_for_idx').on(table.user_id, table.scheduled_for),
    index('tasks_server_updated_at_idx').on(table.server_updated_at),
    uniqueIndex('tasks_owner_server_seq_uidx').on(table.user_id, table.server_seq),
    check('tasks_title_len', sql`char_length(trim(${table.title})) between 1 and 160`),
    check('tasks_sort_order_nonneg', sql`${table.sort_order} >= 0`),
    check(
      'tasks_origin_check',
      sql`${table.origin} in (${sql.raw(sqlIn(TASK_ORIGINS))})`,
    ),
  ],
);

export const routines = pgTable(
  'routines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull(),
    title: text('title').notNull(),
    notes: text('notes'),
    schedule_days: integer('schedule_days')
      .array()
      .notNull()
      .default(sql`array[0,1,2,3,4,5,6]::integer[]`),
    preferred_time: time('preferred_time', { withTimezone: false, precision: 0 }),
    active: boolean('active').notNull().default(true),
    sort_order: integer('sort_order').notNull().default(0),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
    server_seq: serverSeq,
    deleted_at: deletedAt,
  },
  (table) => [
    index('routines_user_active_idx').on(table.user_id, table.active),
    index('routines_server_updated_at_idx').on(table.server_updated_at),
    uniqueIndex('routines_owner_server_seq_uidx').on(table.user_id, table.server_seq),
    check('routines_title_len', sql`char_length(trim(${table.title})) between 1 and 120`),
    check(
      'routines_schedule_days_nonempty',
      sql`cardinality(${table.schedule_days}) >= 1`,
    ),
    check(
      'routines_schedule_days_range',
      sql`${table.schedule_days} <@ array[0,1,2,3,4,5,6]::integer[]`,
    ),
    check('routines_sort_order_nonneg', sql`${table.sort_order} >= 0`),
  ],
);

export const routineCompletions = pgTable(
  'routine_completions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull(),
    routine_id: uuid('routine_id')
      .notNull()
      .references(() => routines.id, { onDelete: 'restrict' }),
    logical_date: date('logical_date', { mode: 'string' }).notNull(),
    completed_at: timestamp('completed_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
    server_seq: serverSeq,
    deleted_at: deletedAt,
  },
  (table) => [
    index('routine_completions_user_logical_date_idx').on(
      table.user_id,
      table.logical_date,
    ),
    index('routine_completions_server_updated_at_idx').on(table.server_updated_at),
    uniqueIndex('routine_completions_owner_server_seq_uidx').on(
      table.user_id,
      table.server_seq,
    ),
    uniqueIndex('routine_completions_live_day_uidx')
      .on(table.routine_id, table.logical_date)
      .where(sql`${table.deleted_at} is null`),
  ],
);
