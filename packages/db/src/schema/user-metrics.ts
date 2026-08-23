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
  unique,
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
import { DAY_TYPES, WEIGHT_SOURCES, sqlIn } from './constants';
import { confidence, nutrient, numericAmount } from './types';

export const weightLogs = pgTable(
  'weight_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull(),
    logged_at: timestamp('logged_at', { withTimezone: true, mode: 'string' }).notNull(),
    measured_on: date('measured_on', { mode: 'string' }).notNull(),
    logical_date: date('logical_date', { mode: 'string' }).notNull(),
    weight_kg: numericAmount('weight_kg').notNull(),
    source: text('source').notNull(),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
    deleted_at: deletedAt,
  },
  (table) => [
    uniqueIndex('weight_logs_user_measured_source_live_uidx')
      .on(table.user_id, table.measured_on, table.source)
      .where(sql`${table.deleted_at} is null`),
    index('weight_logs_user_logical_date_idx').on(table.user_id, table.logical_date),
    index('weight_logs_server_updated_at_idx').on(table.server_updated_at),
    check(
      'weight_logs_source_check',
      sql`${table.source} in (${sql.raw(sqlIn(WEIGHT_SOURCES))})`,
    ),
    check('weight_logs_weight_positive', sql`${table.weight_kg} > 0`),
  ],
);

export const expenditureEstimates = pgTable(
  'expenditure_estimates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    revision: integer('revision').notNull().default(1),
    tdee_kcal: numericAmount('tdee_kcal').notNull(),
    ci_low: numericAmount('ci_low'),
    ci_high: numericAmount('ci_high'),
    method: text('method').notNull(),
    source: text('source').notNull().default('expenditure_engine'),
    confidence: confidence().default('0.25'),
    completeness: numericAmount('completeness'),
    days_of_data: integer('days_of_data'),
    inputs_hash: text('inputs_hash').notNull(),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
  },
  (table) => [
    unique('expenditure_estimates_user_date_revision_key').on(
      table.user_id,
      table.date,
      table.revision,
    ),
    index('expenditure_estimates_user_date_idx').on(table.user_id, table.date),
    check('expenditure_estimates_revision_positive', sql`${table.revision} >= 1`),
    check(
      'expenditure_estimates_source_check',
      sql`${table.source} = 'expenditure_engine'`,
    ),
    check(
      'expenditure_estimates_confidence_check',
      sql`${table.confidence} >= 0 and ${table.confidence} <= 1`,
    ),
    check(
      'expenditure_estimates_values_check',
      sql`${table.tdee_kcal} > 0 and (${table.ci_low} is null or ${table.ci_low} > 0) and (${table.ci_high} is null or ${table.ci_high} > 0)`,
    ),
  ],
);

export const targets = pgTable(
  'targets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull(),
    effective_from: date('effective_from', { mode: 'string' }).notNull(),
    kcal: nutrient('kcal'),
    protein_g: nutrient('protein_g'),
    carbs_g: nutrient('carbs_g'),
    fat_g: nutrient('fat_g'),
    day_type: text('day_type').notNull(),
    clamped: boolean('clamped').notNull().default(false),
    weekly_rate_percent: numericAmount('weekly_rate_percent').notNull().default('0'),
    clamp_reasons: text('clamp_reasons').array().notNull().default(emptyTextArray),
    source: text('source').notNull().default('target_engine'),
    confidence: confidence().default('0.25'),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
  },
  (table) => [
    unique('targets_user_day_type_effective_from_key').on(
      table.user_id,
      table.day_type,
      table.effective_from,
    ),
    check(
      'targets_day_type_check',
      sql`${table.day_type} in (${sql.raw(sqlIn(DAY_TYPES))})`,
    ),
    check('targets_source_check', sql`${table.source} = 'target_engine'`),
    check(
      'targets_confidence_check',
      sql`${table.confidence} >= 0 and ${table.confidence} <= 1`,
    ),
    check(
      'targets_nutrients_nonnegative',
      sql`${table.kcal} >= 0 and ${table.protein_g} >= 0 and ${table.carbs_g} >= 0 and ${table.fat_g} >= 0`,
    ),
    check(
      'targets_weekly_rate_check',
      sql`${table.weekly_rate_percent} >= 0 and ${table.weekly_rate_percent} <= 1`,
    ),
  ],
);
