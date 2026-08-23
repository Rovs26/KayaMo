import { z } from 'zod';
import type { MealTemplate } from '../database';
import { FOOD_SOURCES, RESOLVED_VIA } from '../schema/constants';
import type { DbClient } from './client';
import { DbQueryError, throwIfError } from './errors';
import { clampUpdatedAtIso } from './lww';

const sourceSchema = z.enum(FOOD_SOURCES);
const resolvedViaSchema = z.enum(RESOLVED_VIA);

export const mealTemplateItemSchema = z.object({
  foodId: z.string().min(1),
  foodName: z.string().min(1).max(200),
  quantity: z.string().min(1),
  grams: z.string().min(1),
  servingId: z.string().min(1).nullable(),
  servingLabel: z.string().min(1).max(80).nullable(),
  kcal: z.string(),
  protein_g: z.string(),
  carbs_g: z.string(),
  fat_g: z.string(),
  fiber_g: z.string(),
  sugar_g: z.string(),
  sodium_mg: z.string(),
  source: sourceSchema,
  resolvedVia: resolvedViaSchema,
  confidence: z.string(),
});

export const mealTemplateWriteSchema = z.object({
  id: z.string().min(1),
  user_id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  items: z.array(mealTemplateItemSchema).min(1),
  updated_at: z.string().min(1),
  created_at: z.string().min(1).optional(),
  deleted_at: z.string().nullable().optional(),
});

export type MealTemplateWrite = z.infer<typeof mealTemplateWriteSchema>;

export type UpsertMealTemplateResult =
  | { applied: true; reason: 'inserted' | 'updated'; row: MealTemplate }
  | { applied: false; reason: 'stale_or_tombstoned'; row: MealTemplate | null };

async function getMealTemplateForSync(
  client: DbClient,
  params: { id: string; userId: string },
): Promise<MealTemplate | null> {
  const { data, error } = await client
    .from('meal_templates')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', params.userId)
    .maybeSingle();
  throwIfError(error);
  return data;
}

function toInsert(row: MealTemplateWrite) {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name.trim(),
    items: row.items,
    updated_at: clampUpdatedAtIso(row.updated_at),
    ...(row.created_at ? { created_at: row.created_at } : {}),
    deleted_at: row.deleted_at ?? null,
  };
}

export async function listMealTemplates(
  client: DbClient,
  userId: string,
): Promise<MealTemplate[]> {
  const { data, error } = await client
    .from('meal_templates')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });
  throwIfError(error);
  return data ?? [];
}

export async function upsertMealTemplate(
  client: DbClient,
  row: MealTemplateWrite,
): Promise<UpsertMealTemplateResult> {
  const parsed = mealTemplateWriteSchema.parse(row);
  const payload = toInsert(parsed);
  const { data: updated, error: updateError } = await client
    .from('meal_templates')
    .update(payload)
    .eq('id', parsed.id)
    .eq('user_id', parsed.user_id)
    .is('deleted_at', null)
    .lt('updated_at', payload.updated_at)
    .select('*');
  throwIfError(updateError);
  const updatedRow = updated?.[0];
  if (updatedRow) {
    return { applied: true, reason: 'updated', row: updatedRow };
  }

  const { data: inserted, error: insertError } = await client
    .from('meal_templates')
    .insert(payload)
    .select('*')
    .maybeSingle();
  if (insertError?.code === '23505') {
    const existing = await getMealTemplateForSync(client, {
      id: parsed.id,
      userId: parsed.user_id,
    });
    if (!existing) throwIfError(insertError);
    return {
      applied: false,
      reason: 'stale_or_tombstoned',
      row: existing,
    };
  }
  throwIfError(insertError);
  if (inserted) {
    return { applied: true, reason: 'inserted', row: inserted };
  }
  return {
    applied: false,
    reason: 'stale_or_tombstoned',
    row: await getMealTemplateForSync(client, { id: parsed.id, userId: parsed.user_id }),
  };
}

export async function tombstoneMealTemplate(
  client: DbClient,
  params: { id: string; userId: string; updatedAt: string },
): Promise<void> {
  const updatedAt = clampUpdatedAtIso(params.updatedAt);
  const { data, error } = await client
    .from('meal_templates')
    .update({
      deleted_at: updatedAt,
      updated_at: updatedAt,
    })
    .eq('id', params.id)
    .eq('user_id', params.userId)
    .is('deleted_at', null)
    .select('id');
  throwIfError(error);
  if (!data?.length) {
    throw new DbQueryError('tombstoneMealTemplate matched no live row');
  }
}
