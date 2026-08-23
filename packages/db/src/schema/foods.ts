import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  jsonb,
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
import { FOOD_SOURCES, sqlIn, type FoodSource, type ResolvedVia } from './constants';
import { confidence, nutrient, numericAmount } from './types';

const loggedAt = timestamp('logged_at', { withTimezone: true, mode: 'string' }).notNull();

export const foods = pgTable(
  'foods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: text('source').notNull(),
    source_id: text('source_id'),
    name: text('name').notNull(),
    name_tl: text('name_tl').array().notNull().default(emptyTextArray),
    brand: text('brand'),
    barcode: text('barcode'),
    kcal: nutrient('kcal'),
    protein_g: nutrient('protein_g'),
    carbs_g: nutrient('carbs_g'),
    fat_g: nutrient('fat_g'),
    fiber_g: nutrient('fiber_g'),
    sugar_g: nutrient('sugar_g'),
    sodium_mg: nutrient('sodium_mg'),
    confidence: confidence(),
    verified_by_user: boolean('verified_by_user').notNull().default(false),
    created_by: uuid('created_by'),
    shared: boolean('shared').notNull().default(false),
    attribution: text('attribution'),
    source_note: text('source_note'),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
    deleted_at: deletedAt,
  },
  (table) => [
    unique('foods_source_source_id_key').on(table.source, table.source_id),
    index('foods_barcode_idx').on(table.barcode),
    index('foods_name_trgm_idx').using('gin', sql`${table.name} extensions.gin_trgm_ops`),
    index('foods_name_tl_gin_idx').using('gin', table.name_tl),
    index('foods_server_updated_at_idx').on(table.server_updated_at),
    check(
      'foods_source_check',
      sql`${table.source} in (${sql.raw(sqlIn(FOOD_SOURCES))})`,
    ),
    check(
      'foods_source_id_required',
      sql`${table.source} = 'user' or ${table.source_id} is not null`,
    ),
    check(
      'foods_confidence_check',
      sql`${table.confidence} >= 0 and ${table.confidence} <= 1`,
    ),
    check(
      'foods_nutrients_nonnegative',
      sql`${table.kcal} >= 0 and ${table.protein_g} >= 0 and ${table.carbs_g} >= 0 and ${table.fat_g} >= 0 and ${table.fiber_g} >= 0 and ${table.sugar_g} >= 0 and ${table.sodium_mg} >= 0`,
    ),
    check(
      'foods_user_created_by',
      sql`${table.source} <> 'user' or ${table.created_by} is not null`,
    ),
  ],
);

export const servings = pgTable(
  'servings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    food_id: uuid('food_id')
      .notNull()
      .references(() => foods.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    grams_equivalent: numericAmount('grams_equivalent').notNull(),
    is_default: boolean('is_default').notNull().default(false),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
  },
  (table) => [
    index('servings_food_id_idx').on(table.food_id),
    uniqueIndex('servings_one_default_uidx')
      .on(table.food_id)
      .where(sql`${table.is_default} = true`),
    unique('servings_food_id_label_key').on(table.food_id, table.label),
    check('servings_grams_positive', sql`${table.grams_equivalent} > 0`),
  ],
);

export const foodAliases = pgTable(
  'food_aliases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    food_id: uuid('food_id')
      .notNull()
      .references(() => foods.id, { onDelete: 'cascade' }),
    alias: text('alias').notNull(),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
  },
  (table) => [
    uniqueIndex('food_aliases_food_alias_uidx').on(
      table.food_id,
      sql`lower(${table.alias})`,
    ),
    index('food_aliases_alias_trgm_idx').using(
      'gin',
      sql`${table.alias} extensions.gin_trgm_ops`,
    ),
  ],
);

export const recipes = pgTable(
  'recipes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id'),
    name: text('name').notNull(),
    name_tl: text('name_tl').array().notNull().default(emptyTextArray),
    shared: boolean('shared').notNull().default(false),
    promoted_food_id: uuid('promoted_food_id').references(() => foods.id, {
      onDelete: 'set null',
    }),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
  },
  (table) => [
    index('recipes_user_id_idx').on(table.user_id),
    uniqueIndex('recipes_system_name_uidx')
      .on(table.name)
      .where(sql`${table.user_id} is null`),
  ],
);

export const recipeIngredients = pgTable(
  'recipe_ingredients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recipe_id: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    food_id: uuid('food_id')
      .notNull()
      .references(() => foods.id, { onDelete: 'restrict' }),
    quantity: numericAmount('quantity').notNull(),
    serving_id: uuid('serving_id').references(() => servings.id, {
      onDelete: 'set null',
    }),
    prep_note: text('prep_note'),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
  },
  (table) => [
    index('recipe_ingredients_recipe_id_idx').on(table.recipe_id),
    check('recipe_ingredients_quantity_positive', sql`${table.quantity} > 0`),
  ],
);

export const foodEntries = pgTable(
  'food_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull(),
    logged_at: loggedAt,
    logical_date: date('logical_date', { mode: 'string' }).notNull(),
    meal_slot: text('meal_slot').notNull(),
    food_id: uuid('food_id').references(() => foods.id, { onDelete: 'restrict' }),
    recipe_id: uuid('recipe_id').references(() => recipes.id, { onDelete: 'restrict' }),
    quantity: numericAmount('quantity').notNull(),
    serving_id: uuid('serving_id').references(() => servings.id, {
      onDelete: 'set null',
    }),
    grams: numericAmount('grams').notNull(),
    kcal: nutrient('kcal'),
    protein_g: nutrient('protein_g'),
    carbs_g: nutrient('carbs_g'),
    fat_g: nutrient('fat_g'),
    fiber_g: nutrient('fiber_g'),
    sugar_g: nutrient('sugar_g'),
    sodium_mg: nutrient('sodium_mg'),
    source: text('source').notNull(),
    confidence: confidence(),
    input_method: text('input_method').notNull(),
    photo_url: text('photo_url'),
    raw_input: text('raw_input'),
    food_name_snapshot: text('food_name_snapshot').notNull(),
    serving_label_snapshot: text('serving_label_snapshot'),
    resolved_via: text('resolved_via').notNull(),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
    deleted_at: deletedAt,
  },
  (table) => [
    index('food_entries_user_logged_at_idx').on(table.user_id, table.logged_at.desc()),
    index('food_entries_user_logical_date_idx').on(table.user_id, table.logical_date),
    index('food_entries_server_updated_at_idx').on(table.server_updated_at),
    check(
      'food_entries_source_check',
      sql`${table.source} in (${sql.raw(sqlIn(FOOD_SOURCES))})`,
    ),
    check(
      'food_entries_meal_slot_check',
      sql`${table.meal_slot} in ('almusal', 'tanghalian', 'hapunan', 'meryenda')`,
    ),
    check(
      'food_entries_input_method_check',
      sql`${table.input_method} in ('search', 'chat', 'photo', 'barcode', 'quick')`,
    ),
    check(
      'food_entries_resolved_via_check',
      sql`${table.resolved_via} in ('ph_core', 'usda_fdc', 'off', 'user', 'llm', 'recipe')`,
    ),
    check(
      'food_entries_confidence_check',
      sql`${table.confidence} >= 0 and ${table.confidence} <= 1`,
    ),
    check(
      'food_entries_nutrients_nonnegative',
      sql`${table.kcal} >= 0 and ${table.protein_g} >= 0 and ${table.carbs_g} >= 0 and ${table.fat_g} >= 0 and ${table.fiber_g} >= 0 and ${table.sugar_g} >= 0 and ${table.sodium_mg} >= 0`,
    ),
    check(
      'food_entries_food_xor_recipe',
      sql`(${table.food_id} is not null and ${table.recipe_id} is null) or (${table.food_id} is null and ${table.recipe_id} is not null)`,
    ),
    check('food_entries_quantity_positive', sql`${table.quantity} > 0`),
    check('food_entries_grams_positive', sql`${table.grams} > 0`),
  ],
);

export const offContributeRequests = pgTable(
  'off_contribute_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    food_id: uuid('food_id')
      .notNull()
      .references(() => foods.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id').notNull(),
    status: text('status').notNull().default('queued'),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
  },
  (table) => [
    unique('off_contribute_requests_food_uidx').on(table.food_id),
    index('off_contribute_requests_user_idx').on(table.user_id),
    check(
      'off_contribute_status_check',
      sql`${table.status} in ('queued', 'sent', 'skipped')`,
    ),
  ],
);

export type MealTemplateItem = {
  foodId: string;
  foodName: string;
  quantity: string;
  grams: string;
  servingId: string | null;
  servingLabel: string | null;
  kcal: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  fiber_g: string;
  sugar_g: string;
  sodium_mg: string;
  source: FoodSource;
  resolvedVia: ResolvedVia;
  confidence: string;
};

export const mealTemplates = pgTable(
  'meal_templates',
  {
    id: uuid('id').primaryKey(),
    user_id: uuid('user_id').notNull(),
    name: text('name').notNull(),
    items: jsonb('items').$type<MealTemplateItem[]>().notNull(),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
    deleted_at: deletedAt,
  },
  (table) => [
    index('meal_templates_user_id_idx').on(table.user_id),
    index('meal_templates_server_updated_at_idx').on(table.server_updated_at),
    check('meal_templates_name_len', sql`char_length(${table.name}) between 1 and 80`),
    check('meal_templates_items_array', sql`jsonb_typeof(${table.items}) = 'array'`),
    check('meal_templates_items_min', sql`jsonb_array_length(${table.items}) >= 1`),
  ],
);
