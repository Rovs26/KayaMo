import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, deletedAt, serverUpdatedAt, updatedAt } from './columns';
import {
  ACHIEVEMENT_METRICS,
  COMPANION_EVENT_TYPES,
  GOAL_KINDS,
  GOAL_STATUSES,
  HABIT_FREQUENCIES,
  LIFE_AREAS,
  TASK_ORIGINS,
  sqlIn,
} from './constants';

export const goals = pgTable(
  'goals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    kind: text('kind').notNull().default('goal'),
    status: text('status').notNull().default('active'),
    starts_on: date('starts_on', { mode: 'string' }),
    target_date: date('target_date', { mode: 'string' }),
    completed_at: timestamp('completed_at', { withTimezone: true, mode: 'string' }),
    origin: text('origin').notNull().default('user'),
    life_area: text('life_area'),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
    deleted_at: deletedAt,
  },
  (table) => [
    index('goals_user_status_idx').on(table.user_id, table.status),
    index('goals_server_updated_at_idx').on(table.server_updated_at),
    check('goals_title_len', sql`char_length(trim(${table.title})) between 1 and 180`),
    check('goals_kind_check', sql`${table.kind} in (${sql.raw(sqlIn(GOAL_KINDS))})`),
    check(
      'goals_status_check',
      sql`${table.status} in (${sql.raw(sqlIn(GOAL_STATUSES))})`,
    ),
    check(
      'goals_origin_check',
      sql`${table.origin} in (${sql.raw(sqlIn(TASK_ORIGINS))})`,
    ),
    check(
      'goals_life_area_check',
      sql`${table.life_area} is null or ${table.life_area} in (${sql.raw(sqlIn(LIFE_AREAS))})`,
    ),
    check(
      'goals_completed_state_check',
      sql`(${table.status} = 'completed') = (${table.completed_at} is not null)`,
    ),
  ],
);

export const goalMilestones = pgTable(
  'goal_milestones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull(),
    goal_id: uuid('goal_id')
      .notNull()
      .references(() => goals.id, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    sort_order: integer('sort_order').notNull().default(0),
    target_date: date('target_date', { mode: 'string' }),
    completed_at: timestamp('completed_at', { withTimezone: true, mode: 'string' }),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
    deleted_at: deletedAt,
  },
  (table) => [
    index('goal_milestones_goal_order_idx').on(table.goal_id, table.sort_order),
    index('goal_milestones_server_updated_at_idx').on(table.server_updated_at),
    uniqueIndex('goal_milestones_live_order_uidx')
      .on(table.goal_id, table.sort_order)
      .where(sql`${table.deleted_at} is null`),
    check(
      'goal_milestones_title_len',
      sql`char_length(trim(${table.title})) between 1 and 160`,
    ),
    check('goal_milestones_order_check', sql`${table.sort_order} >= 0`),
  ],
);

export const habits = pgTable(
  'habits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull(),
    goal_id: uuid('goal_id').references(() => goals.id, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    notes: text('notes'),
    frequency: text('frequency').notNull().default('daily'),
    target_per_period: integer('target_per_period').notNull().default(1),
    active: boolean('active').notNull().default(true),
    origin: text('origin').notNull().default('user'),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
    deleted_at: deletedAt,
  },
  (table) => [
    index('habits_user_active_idx').on(table.user_id, table.active),
    index('habits_server_updated_at_idx').on(table.server_updated_at),
    check('habits_title_len', sql`char_length(trim(${table.title})) between 1 and 120`),
    check(
      'habits_frequency_check',
      sql`${table.frequency} in (${sql.raw(sqlIn(HABIT_FREQUENCIES))})`,
    ),
    check(
      'habits_origin_check',
      sql`${table.origin} in (${sql.raw(sqlIn(TASK_ORIGINS))})`,
    ),
    check(
      'habits_target_per_period_check',
      sql`${table.target_per_period} between 1 and 50`,
    ),
  ],
);

export const habitCompletions = pgTable(
  'habit_completions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull(),
    habit_id: uuid('habit_id')
      .notNull()
      .references(() => habits.id, { onDelete: 'restrict' }),
    logical_date: date('logical_date', { mode: 'string' }).notNull(),
    completed_at: timestamp('completed_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
    deleted_at: deletedAt,
  },
  (table) => [
    index('habit_completions_user_date_idx').on(table.user_id, table.logical_date),
    index('habit_completions_server_updated_at_idx').on(table.server_updated_at),
    uniqueIndex('habit_completions_live_day_uidx')
      .on(table.habit_id, table.logical_date)
      .where(sql`${table.deleted_at} is null`),
  ],
);

export const evolutionStages = pgTable(
  'evolution_stages',
  {
    key: text('key').primaryKey(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    minimum_points: integer('minimum_points').notNull().unique(),
    sort_order: integer('sort_order').notNull().unique(),
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
  },
  (table) => [
    check('evolution_stages_points_check', sql`${table.minimum_points} >= 0`),
    check('evolution_stages_order_check', sql`${table.sort_order} >= 0`),
  ],
);

export const achievementDefinitions = pgTable(
  'achievement_definitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull().unique(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    metric: text('metric').notNull(),
    event_type: text('event_type'),
    threshold: integer('threshold').notNull(),
    active: boolean('active').notNull().default(true),
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
  },
  (table) => [
    check(
      'achievement_definitions_metric_check',
      sql`${table.metric} in (${sql.raw(sqlIn(ACHIEVEMENT_METRICS))})`,
    ),
    check(
      'achievement_definitions_event_type_check',
      sql`${table.event_type} is null or ${table.event_type} in (${sql.raw(sqlIn(COMPANION_EVENT_TYPES))})`,
    ),
    check('achievement_definitions_threshold_check', sql`${table.threshold} > 0`),
    check(
      'achievement_definitions_rule_shape',
      sql`(${table.metric} = 'event_type_count' and ${table.event_type} is not null) or (${table.metric} <> 'event_type_count' and ${table.event_type} is null)`,
    ),
  ],
);

export const cosmeticDefinitions = pgTable('cosmetic_definitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  required_stage_key: text('required_stage_key')
    .notNull()
    .references(() => evolutionStages.key, { onDelete: 'restrict' }),
  asset_key: text('asset_key').notNull(),
  active: boolean('active').notNull().default(true),
  updated_at: updatedAt,
  server_updated_at: serverUpdatedAt,
});

export const companionEvents = pgTable(
  'companion_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull(),
    event_key: text('event_key').notNull(),
    event_type: text('event_type').notNull(),
    source_table: text('source_table').notNull(),
    source_id: uuid('source_id').notNull(),
    logical_date: date('logical_date', { mode: 'string' }).notNull(),
    points: integer('points').notNull().default(0),
    created_at: createdAt,
    server_updated_at: serverUpdatedAt,
  },
  (table) => [
    uniqueIndex('companion_events_user_key_uidx').on(table.user_id, table.event_key),
    index('companion_events_user_date_idx').on(table.user_id, table.logical_date),
    index('companion_events_server_updated_at_idx').on(table.server_updated_at),
    check(
      'companion_events_type_check',
      sql`${table.event_type} in (${sql.raw(sqlIn(COMPANION_EVENT_TYPES))})`,
    ),
    check('companion_events_points_check', sql`${table.points} >= 0`),
  ],
);

export const companionState = pgTable(
  'companion_state',
  {
    user_id: uuid('user_id').primaryKey(),
    total_points: integer('total_points').notNull().default(0),
    stage_key: text('stage_key')
      .notNull()
      .default('seed')
      .references(() => evolutionStages.key, { onDelete: 'restrict' }),
    selected_cosmetic_id: uuid('selected_cosmetic_id').references(
      () => cosmeticDefinitions.id,
      { onDelete: 'restrict' },
    ),
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
  },
  (table) => [check('companion_state_points_check', sql`${table.total_points} >= 0`)],
);

export const userAchievements = pgTable(
  'user_achievements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull(),
    achievement_id: uuid('achievement_id')
      .notNull()
      .references(() => achievementDefinitions.id, { onDelete: 'restrict' }),
    source_event_id: uuid('source_event_id')
      .notNull()
      .references(() => companionEvents.id, { onDelete: 'restrict' }),
    earned_at: timestamp('earned_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    server_updated_at: serverUpdatedAt,
  },
  (table) => [
    uniqueIndex('user_achievements_user_definition_uidx').on(
      table.user_id,
      table.achievement_id,
    ),
    index('user_achievements_server_updated_at_idx').on(table.server_updated_at),
  ],
);

export const cosmeticUnlocks = pgTable(
  'cosmetic_unlocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull(),
    cosmetic_id: uuid('cosmetic_id')
      .notNull()
      .references(() => cosmeticDefinitions.id, { onDelete: 'restrict' }),
    source_event_id: uuid('source_event_id')
      .notNull()
      .references(() => companionEvents.id, { onDelete: 'restrict' }),
    unlocked_at: timestamp('unlocked_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    server_updated_at: serverUpdatedAt,
  },
  (table) => [
    uniqueIndex('cosmetic_unlocks_user_cosmetic_uidx').on(
      table.user_id,
      table.cosmetic_id,
    ),
    index('cosmetic_unlocks_server_updated_at_idx').on(table.server_updated_at),
  ],
);
