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
import {
  DAILY_ACTION_KINDS,
  DAY_CAPACITIES,
  DAY_INTENTS,
  FOCUS_SESSION_STATUSES,
  PLAN_MODES,
  sqlIn,
} from './constants';

export const dailyPlans = pgTable(
  'daily_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull(),
    logical_date: date('logical_date', { mode: 'string' }).notNull(),
    selected_action_kind: text('selected_action_kind'),
    selected_record_id: uuid('selected_record_id'),
    selected_label_snapshot: text('selected_label_snapshot'),
    morning_completed_at: timestamp('morning_completed_at', {
      withTimezone: true,
      mode: 'string',
    }),
    evening_completed_at: timestamp('evening_completed_at', {
      withTimezone: true,
      mode: 'string',
    }),
    capacity: text('capacity'),
    day_intent: text('day_intent'),
    plan_mode: text('plan_mode'),
    tomorrow_note: text('tomorrow_note'),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
    server_seq: serverSeq,
    deleted_at: deletedAt,
  },
  (table) => [
    index('daily_plans_user_date_idx').on(table.user_id, table.logical_date),
    index('daily_plans_server_updated_at_idx').on(table.server_updated_at),
    uniqueIndex('daily_plans_owner_server_seq_uidx').on(table.user_id, table.server_seq),
    uniqueIndex('daily_plans_live_day_uidx')
      .on(table.user_id, table.logical_date)
      .where(sql`${table.deleted_at} is null`),
    check(
      'daily_plans_action_kind_check',
      sql`${table.selected_action_kind} is null or ${table.selected_action_kind} in (${sql.raw(sqlIn(DAILY_ACTION_KINDS))})`,
    ),
    check(
      'daily_plans_action_shape_check',
      sql`(${table.selected_action_kind} is null and ${table.selected_record_id} is null and ${table.selected_label_snapshot} is null)
        or (${table.selected_action_kind} = 'custom' and ${table.selected_record_id} is null and char_length(trim(${table.selected_label_snapshot})) between 1 and 160)
        or (${table.selected_action_kind} in ('task', 'routine') and ${table.selected_record_id} is not null and char_length(trim(${table.selected_label_snapshot})) between 1 and 160)`,
    ),
    check(
      'daily_plans_capacity_check',
      sql`${table.capacity} is null or ${table.capacity} in (${sql.raw(sqlIn(DAY_CAPACITIES))})`,
    ),
    check(
      'daily_plans_intent_check',
      sql`${table.day_intent} is null or ${table.day_intent} in (${sql.raw(sqlIn(DAY_INTENTS))})`,
    ),
    check(
      'daily_plans_mode_check',
      sql`${table.plan_mode} is null or ${table.plan_mode} in (${sql.raw(sqlIn(PLAN_MODES))})`,
    ),
    check(
      'daily_plans_tomorrow_note_len',
      sql`${table.tomorrow_note} is null or char_length(trim(${table.tomorrow_note})) between 1 and 500`,
    ),
  ],
);

export const focusSessions = pgTable(
  'focus_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull(),
    daily_plan_id: uuid('daily_plan_id').references(() => dailyPlans.id, {
      onDelete: 'restrict',
    }),
    logical_date: date('logical_date', { mode: 'string' }).notNull(),
    target_kind: text('target_kind').notNull(),
    target_record_id: uuid('target_record_id'),
    target_label_snapshot: text('target_label_snapshot').notNull(),
    planned_minutes: integer('planned_minutes').notNull().default(25),
    status: text('status').notNull().default('scheduled'),
    started_at: timestamp('started_at', { withTimezone: true, mode: 'string' }),
    ends_at: timestamp('ends_at', { withTimezone: true, mode: 'string' }),
    completed_at: timestamp('completed_at', { withTimezone: true, mode: 'string' }),
    cancelled_at: timestamp('cancelled_at', { withTimezone: true, mode: 'string' }),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
    server_seq: serverSeq,
    deleted_at: deletedAt,
  },
  (table) => [
    index('focus_sessions_user_date_idx').on(table.user_id, table.logical_date),
    index('focus_sessions_server_updated_at_idx').on(table.server_updated_at),
    uniqueIndex('focus_sessions_owner_server_seq_uidx').on(
      table.user_id,
      table.server_seq,
    ),
    check(
      'focus_sessions_target_kind_check',
      sql`${table.target_kind} in (${sql.raw(sqlIn(DAILY_ACTION_KINDS))})`,
    ),
    check(
      'focus_sessions_status_check',
      sql`${table.status} in (${sql.raw(sqlIn(FOCUS_SESSION_STATUSES))})`,
    ),
    check(
      'focus_sessions_target_shape_check',
      sql`(${table.target_kind} = 'custom' and ${table.target_record_id} is null)
        or (${table.target_kind} in ('task', 'routine') and ${table.target_record_id} is not null)`,
    ),
    check(
      'focus_sessions_label_len',
      sql`char_length(trim(${table.target_label_snapshot})) between 1 and 160`,
    ),
    check(
      'focus_sessions_duration_check',
      sql`${table.planned_minutes} between 1 and 180`,
    ),
    check(
      'focus_sessions_state_shape_check',
      sql`(${table.status} = 'scheduled' and ${table.started_at} is null and ${table.ends_at} is null and ${table.completed_at} is null and ${table.cancelled_at} is null)
        or (${table.status} = 'active' and ${table.started_at} is not null and ${table.ends_at} is not null and ${table.completed_at} is null and ${table.cancelled_at} is null)
        or (${table.status} = 'completed' and ${table.started_at} is not null and ${table.ends_at} is not null and ${table.completed_at} is not null and ${table.cancelled_at} is null)
        or (${table.status} = 'cancelled' and ${table.completed_at} is null and ${table.cancelled_at} is not null)`,
    ),
  ],
);

export const dailyLoopPreferences = pgTable(
  'daily_loop_preferences',
  {
    user_id: uuid('user_id').primaryKey(),
    notifications_enabled: boolean('notifications_enabled').notNull().default(false),
    morning_reminder_at: time('morning_reminder_at', {
      withTimezone: false,
      precision: 0,
    })
      .notNull()
      .default('08:00:00'),
    evening_reminder_at: time('evening_reminder_at', {
      withTimezone: false,
      precision: 0,
    })
      .notNull()
      .default('20:00:00'),
    quiet_starts_at: time('quiet_starts_at', {
      withTimezone: false,
      precision: 0,
    })
      .notNull()
      .default('22:00:00'),
    quiet_ends_at: time('quiet_ends_at', {
      withTimezone: false,
      precision: 0,
    })
      .notNull()
      .default('07:00:00'),
    faith_enabled: boolean('faith_enabled').notNull().default(false),
    last_weekly_reset_on: date('last_weekly_reset_on', { mode: 'string' }),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
    server_seq: serverSeq,
    deleted_at: deletedAt,
  },
  (table) => [
    index('daily_loop_preferences_server_updated_at_idx').on(table.server_updated_at),
    uniqueIndex('daily_loop_preferences_owner_server_seq_uidx').on(
      table.user_id,
      table.server_seq,
    ),
  ],
);

export const scripturePassages = pgTable(
  'scripture_passages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull().unique(),
    reference: text('reference').notNull(),
    text: text('text').notNull(),
    translation_key: text('translation_key').notNull(),
    license: text('license').notNull(),
    source_url: text('source_url').notNull(),
    tags: text('tags')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    reviewed_at: timestamp('reviewed_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    active: boolean('active').notNull().default(true),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
  },
  (table) => [
    index('scripture_passages_tags_idx').using('gin', table.tags),
    check(
      'scripture_passages_text_len',
      sql`char_length(${table.text}) between 1 and 1200`,
    ),
    check(
      'scripture_passages_translation_check',
      sql`${table.translation_key} = 'engwebp'`,
    ),
  ],
);

/** Browser transport registration; not part of the offline LWW domain queue. */
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull(),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    expires_at: timestamp('expires_at', { withTimezone: true, mode: 'string' }),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
  },
  (table) => [
    uniqueIndex('push_subscriptions_user_endpoint_uidx').on(
      table.user_id,
      table.endpoint,
    ),
    index('push_subscriptions_user_idx').on(table.user_id),
    check(
      'push_subscriptions_endpoint_len',
      sql`char_length(${table.endpoint}) between 10 and 4000`,
    ),
  ],
);
