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
import {
  createdAt,
  deletedAt,
  emptyTextArray,
  serverUpdatedAt,
  updatedAt,
} from './columns';
import {
  EXERCISE_MEDIA_TYPES,
  EXERCISE_SOURCES,
  WORKOUT_SET_TYPES,
  WORKOUT_STATUSES,
  sqlIn,
} from './constants';
import { numericAmount } from './types';

export const exercises = pgTable(
  'exercises',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: text('source').notNull(),
    name: text('name').notNull(),
    name_tl: text('name_tl').array().notNull().default(emptyTextArray),
    muscles: text('muscles').array().notNull().default(emptyTextArray),
    secondary_muscles: text('secondary_muscles')
      .array()
      .notNull()
      .default(emptyTextArray),
    equipment: text('equipment'),
    pattern: text('pattern'),
    unilateral: boolean('unilateral').notNull().default(false),
    default_rep_min: integer('default_rep_min'),
    default_rep_max: integer('default_rep_max'),
    created_by: uuid('created_by'),
    shared: boolean('shared').notNull().default(false),
    form_cues: text('form_cues').array().notNull().default(emptyTextArray),
    common_mistakes: text('common_mistakes').array().notNull().default(emptyTextArray),
    media_url: text('media_url'),
    media_type: text('media_type'),
    media_license: text('media_license'),
    media_attribution: text('media_attribution'),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
    deleted_at: deletedAt,
  },
  (table) => [
    check(
      'exercises_source_check',
      sql`${table.source} in (${sql.raw(sqlIn(EXERCISE_SOURCES))})`,
    ),
    check(
      'exercises_user_created_by',
      sql`${table.source} <> 'user' or ${table.created_by} is not null`,
    ),
    check(
      'exercises_rep_range_check',
      sql`${table.default_rep_min} is null or ${table.default_rep_max} is null or ${table.default_rep_min} <= ${table.default_rep_max}`,
    ),
    check(
      'exercises_media_type_check',
      sql`${table.media_type} is null or ${table.media_type} in (${sql.raw(sqlIn(EXERCISE_MEDIA_TYPES))})`,
    ),
    index('exercises_name_trgm_idx').using(
      'gin',
      sql`${table.name} extensions.gin_trgm_ops`,
    ),
    index('exercises_name_tl_gin_idx').using('gin', table.name_tl),
  ],
);

export const workoutPlans = pgTable(
  'workout_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    active: boolean('active').notNull().default(true),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
    deleted_at: deletedAt,
  },
  (table) => [
    index('workout_plans_user_active_idx').on(table.user_id, table.active),
    index('workout_plans_server_updated_at_idx').on(table.server_updated_at),
    check(
      'workout_plans_title_len',
      sql`char_length(trim(${table.title})) between 1 and 120`,
    ),
  ],
);

export const workoutPlanExercises = pgTable(
  'workout_plan_exercises',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull(),
    plan_id: uuid('plan_id')
      .notNull()
      .references(() => workoutPlans.id, { onDelete: 'restrict' }),
    exercise_id: uuid('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'restrict' }),
    day_index: integer('day_index').notNull(),
    exercise_order: integer('exercise_order').notNull(),
    target_sets: integer('target_sets').notNull(),
    rep_min: integer('rep_min').notNull(),
    rep_max: integer('rep_max').notNull(),
    rest_seconds: integer('rest_seconds').notNull().default(120),
    superset_group: text('superset_group'),
    notes: text('notes'),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
    deleted_at: deletedAt,
  },
  (table) => [
    index('workout_plan_exercises_plan_day_idx').on(
      table.plan_id,
      table.day_index,
      table.exercise_order,
    ),
    index('workout_plan_exercises_server_updated_at_idx').on(table.server_updated_at),
    uniqueIndex('workout_plan_exercises_live_order_uidx')
      .on(table.plan_id, table.day_index, table.exercise_order)
      .where(sql`${table.deleted_at} is null`),
    check('workout_plan_exercises_day_check', sql`${table.day_index} between 0 and 6`),
    check('workout_plan_exercises_order_check', sql`${table.exercise_order} >= 0`),
    check('workout_plan_exercises_sets_check', sql`${table.target_sets} > 0`),
    check(
      'workout_plan_exercises_reps_check',
      sql`${table.rep_min} > 0 and ${table.rep_max} >= ${table.rep_min}`,
    ),
    check('workout_plan_exercises_rest_check', sql`${table.rest_seconds} >= 0`),
  ],
);

export const workouts = pgTable(
  'workouts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull(),
    started_at: timestamp('started_at', { withTimezone: true, mode: 'string' }).notNull(),
    ended_at: timestamp('ended_at', { withTimezone: true, mode: 'string' }),
    logical_date: date('logical_date', { mode: 'string' }).notNull(),
    notes: text('notes'),
    routine_id: uuid('routine_id'),
    plan_id: uuid('plan_id').references(() => workoutPlans.id, {
      onDelete: 'restrict',
    }),
    plan_day_index: integer('plan_day_index'),
    status: text('status').notNull().default('active'),
    is_deload: boolean('is_deload').notNull().default(false),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
    deleted_at: deletedAt,
  },
  (table) => [
    index('workouts_user_started_at_idx').on(table.user_id, table.started_at.desc()),
    index('workouts_user_logical_date_idx').on(table.user_id, table.logical_date),
    index('workouts_server_updated_at_idx').on(table.server_updated_at),
    check(
      'workouts_status_check',
      sql`${table.status} in (${sql.raw(sqlIn(WORKOUT_STATUSES))})`,
    ),
    check(
      'workouts_plan_day_check',
      sql`${table.plan_day_index} is null or ${table.plan_day_index} between 0 and 6`,
    ),
  ],
);

export const workoutSets = pgTable(
  'workout_sets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull(),
    workout_id: uuid('workout_id')
      .notNull()
      .references(() => workouts.id, { onDelete: 'restrict' }),
    exercise_id: uuid('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'restrict' }),
    set_index: integer('set_index').notNull(),
    exercise_order: integer('exercise_order').notNull().default(0),
    exercise_name_snapshot: text('exercise_name_snapshot').notNull(),
    set_type: text('set_type').notNull().default('normal'),
    superset_group: text('superset_group'),
    weight_kg: numericAmount('weight_kg').notNull(),
    reps: integer('reps').notNull(),
    rpe: numericAmount('rpe'),
    rir: numericAmount('rir'),
    is_warmup: boolean('is_warmup').notNull().default(false),
    completed_at: timestamp('completed_at', { withTimezone: true, mode: 'string' }),
    rest_seconds: integer('rest_seconds'),
    e1rm_epley_kg: numericAmount('e1rm_epley_kg'),
    e1rm_brzycki_kg: numericAmount('e1rm_brzycki_kg'),
    e1rm_low_confidence: boolean('e1rm_low_confidence').notNull().default(false),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
    deleted_at: deletedAt,
  },
  (table) => [
    index('workout_sets_workout_id_idx').on(
      table.workout_id,
      table.exercise_order,
      table.set_index,
    ),
    index('workout_sets_user_id_idx').on(table.user_id),
    index('workout_sets_server_updated_at_idx').on(table.server_updated_at),
    uniqueIndex('workout_sets_live_index_uidx')
      .on(table.workout_id, table.exercise_id, table.set_index)
      .where(sql`${table.deleted_at} is null`),
    check('workout_sets_set_index_positive', sql`${table.set_index} >= 0`),
    check('workout_sets_reps_nonneg', sql`${table.reps} >= 0`),
    check('workout_sets_weight_nonneg', sql`${table.weight_kg} >= 0`),
    check(
      'workout_sets_rpe_range',
      sql`${table.rpe} is null or ${table.rpe} between 1 and 10`,
    ),
    check(
      'workout_sets_rir_range',
      sql`${table.rir} is null or ${table.rir} between 0 and 10`,
    ),
    check(
      'workout_sets_type_check',
      sql`${table.set_type} in (${sql.raw(sqlIn(WORKOUT_SET_TYPES))})`,
    ),
    check(
      'workout_sets_rest_check',
      sql`${table.rest_seconds} is null or ${table.rest_seconds} >= 0`,
    ),
  ],
);
