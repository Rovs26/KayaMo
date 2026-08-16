import { eq } from 'drizzle-orm';
import { createDrizzle, requireDatabaseUrl } from './drizzle';
import { foodAliases, foods, servings } from './schema/foods';

export type PhCoreFoodRow = {
  sourceId: string;
  name: string;
  nameTl: string[];
  kcal: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  fiber_g: string;
  sugar_g: string;
  sodium_mg: string;
  confidence: string;
  sourceNote: string;
  verified: boolean;
  servings: Array<{ label: string; grams: string; isDefault: boolean }>;
};

export async function upsertPhCoreFoods(
  rows: PhCoreFoodRow[],
): Promise<{ foods: number; servings: number }> {
  const { db, client } = createDrizzle(requireDatabaseUrl());
  const updatedAt = new Date().toISOString();
  let servingCount = 0;

  try {
    for (const row of rows) {
      const inserted = await db
        .insert(foods)
        .values({
          source: 'ph_core',
          source_id: row.sourceId,
          name: row.name,
          name_tl: row.nameTl,
          kcal: row.kcal,
          protein_g: row.protein_g,
          carbs_g: row.carbs_g,
          fat_g: row.fat_g,
          fiber_g: row.fiber_g,
          sugar_g: row.sugar_g,
          sodium_mg: row.sodium_mg,
          confidence: row.confidence,
          source_note: row.sourceNote,
          verified_by_user: row.verified,
          shared: false,
          updated_at: updatedAt,
        })
        .onConflictDoUpdate({
          target: [foods.source, foods.source_id],
          set: {
            name: row.name,
            name_tl: row.nameTl,
            kcal: row.kcal,
            protein_g: row.protein_g,
            carbs_g: row.carbs_g,
            fat_g: row.fat_g,
            fiber_g: row.fiber_g,
            sugar_g: row.sugar_g,
            sodium_mg: row.sodium_mg,
            confidence: row.confidence,
            source_note: row.sourceNote,
            verified_by_user: row.verified,
            updated_at: updatedAt,
          },
        })
        .returning({ id: foods.id });

      const foodId = inserted[0]?.id;
      if (!foodId) continue;

      await db
        .update(servings)
        .set({ is_default: false, updated_at: updatedAt })
        .where(eq(servings.food_id, foodId));

      for (const serving of row.servings) {
        await db
          .insert(servings)
          .values({
            food_id: foodId,
            label: serving.label,
            grams_equivalent: serving.grams,
            is_default: serving.isDefault,
            updated_at: updatedAt,
          })
          .onConflictDoUpdate({
            target: [servings.food_id, servings.label],
            set: {
              grams_equivalent: serving.grams,
              is_default: serving.isDefault,
              updated_at: updatedAt,
            },
          });
        servingCount += 1;
      }

      for (const alias of row.nameTl) {
        await db
          .insert(foodAliases)
          .values({
            food_id: foodId,
            alias,
            updated_at: updatedAt,
          })
          .onConflictDoNothing();
      }
    }

    return { foods: rows.length, servings: servingCount };
  } finally {
    await client.end({ timeout: 5 });
  }
}
