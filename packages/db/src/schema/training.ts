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
import { createdAt, deletedAt, emptyTextArray, serverUpdatedAt, updatedAt } from './columns';
import { EXERCISE_SOURCES, sqlIn } from './constants';
import { numericAmount } from './types';

export const exercises = pgTable(
  'exercises',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: text('source').notNull(),
    name: text('name').notNull(),
    name_tl: text('name_tl').array().notNull().default(emptyTextArray),
    muscles: text('muscles').array().notNull().default(emptyTextArray),
    equipment: text('equipment'),
    pattern: text('pattern'),
    unilateral: boolean('unilateral').notNull().default(false),
    default_rep_min: integer('default_rep_min'),
    default_rep_max: integer('default_rep_max'),
    created_by: uuid('created_by'),
    shared: boolean('shared').notNull().default(false),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
  },
  (table) => [
    check('exercises_source_check', sql`${table.source} in (${sql.raw(sqlIn(EXERCISE_SOURCES))})`),
    check(
      'exercises_user_created_by',
      sql`${table.source} <> 'user' or ${table.created_by} is not null`,
    ),
    index('exercises_name_trgm_idx').using('gin', sql`${table.name} extensions.gin_trgm_ops`),
    index('exercises_name_tl_gin_idx').using('gin', table.name_tl),
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
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
    deleted_at: deletedAt,
  },
  (table) => [
    index('workouts_user_started_at_idx').on(table.user_id, table.started_at.desc()),
    index('workouts_user_logical_date_idx').on(table.user_id, table.logical_date),
    index('workouts_server_updated_at_idx').on(table.server_updated_at),
  ],
);

export const workoutSets = pgTable(
  'workout_sets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workout_id: uuid('workout_id')
      .notNull()
      .references(() => workouts.id, { onDelete: 'restrict' }),
    exercise_id: uuid('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'restrict' }),
    set_index: integer('set_index').notNull(),
    weight_kg: numericAmount('weight_kg').notNull(),
    reps: integer('reps').notNull(),
    rpe: numericAmount('rpe'),
    rir: numericAmount('rir'),
    is_warmup: boolean('is_warmup').notNull().default(false),
    e1rm_epley_kg: numericAmount('e1rm_epley_kg'),
    e1rm_brzycki_kg: numericAmount('e1rm_brzycki_kg'),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
    deleted_at: deletedAt,
  },
  (table) => [
    index('workout_sets_workout_id_idx').on(table.workout_id, table.set_index),
    uniqueIndex('workout_sets_live_index_uidx')
      .on(table.workout_id, table.set_index)
      .where(sql`${table.deleted_at} is null`),
    check('workout_sets_set_index_positive', sql`${table.set_index} >= 0`),
    check('workout_sets_reps_nonneg', sql`${table.reps} >= 0`),
  ],
);
