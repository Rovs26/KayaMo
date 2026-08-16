import { NextResponse } from 'next/server';
import {
  insertFoodAliases,
  insertServings,
  insertUserFood,
  queueOffContribute,
} from '@kayamo/db';
import { toNutrientString, userFoodConfirmSchema, userFoodToRows } from '@kayamo/food';
import { createServerSupabase } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in to save a food.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const parsed = userFoodConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Check the highlighted fields before saving.' }, { status: 400 });
  }

  const rows = userFoodToRows(parsed.data, user.id);
  try {
    const food = await insertUserFood(supabase, rows.food);
    const servings = await insertServings(
      supabase,
      rows.servings.map((serving) => ({
        food_id: food.id,
        label: serving.label,
        grams_equivalent: toNutrientString(serving.grams),
        is_default: serving.isDefault === true,
        updated_at: rows.food.updated_at,
      })),
    );
    await insertFoodAliases(
      supabase,
      rows.aliases.map((alias) => ({
        food_id: food.id,
        alias,
        updated_at: rows.food.updated_at,
      })),
    );
    if (rows.contributeToOff) {
      await queueOffContribute(supabase, {
        foodId: food.id,
        userId: user.id,
        updatedAt: rows.food.updated_at,
      });
    }
    return NextResponse.json({ food, servings });
  } catch {
    return NextResponse.json({ error: 'Could not save that food. Try again.' }, { status: 502 });
  }
}
