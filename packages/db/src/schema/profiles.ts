import { sql } from 'drizzle-orm';
import { check, integer, pgTable, text, time, uuid } from 'drizzle-orm/pg-core';
import { createdAt, serverUpdatedAt, updatedAt } from './columns';
import { GOALS, LOCALES, SEXES, sqlIn } from './constants';
import { numericAmount } from './types';

export const profiles = pgTable(
  'profiles',
  {
    user_id: uuid('user_id').primaryKey(),
    sex: text('sex'),
    birth_year: integer('birth_year'),
    height_cm: numericAmount('height_cm'),
    activity_baseline: numericAmount('activity_baseline'),
    goal: text('goal'),
    timezone: text('timezone').notNull().default('Asia/Manila'),
    locale: text('locale').notNull().default('taglish'),
    day_starts_at: time('day_starts_at', { precision: 0 }).notNull().default('00:00:00'),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
  },
  (table) => [
    check(
      'profiles_sex_check',
      sql`${table.sex} is null or ${table.sex} in (${sql.raw(sqlIn(SEXES))})`,
    ),
    check('profiles_locale_check', sql`${table.locale} in (${sql.raw(sqlIn(LOCALES))})`),
    check(
      'profiles_goal_check',
      sql`${table.goal} is null or ${table.goal} in (${sql.raw(sqlIn(GOALS))})`,
    ),
    check(
      'profiles_birth_year_check',
      sql`${table.birth_year} is null or ${table.birth_year} between 1900 and 2100`,
    ),
    check(
      'profiles_height_check',
      sql`${table.height_cm} is null or ${table.height_cm} > 0`,
    ),
    check(
      'profiles_activity_baseline_check',
      sql`${table.activity_baseline} is null or ${table.activity_baseline} between 1.2 and 2`,
    ),
  ],
);
