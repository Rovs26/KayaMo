import { and, eq, isNull } from 'drizzle-orm';
import { createDrizzle, requireDatabaseUrl } from './drizzle';
import { foodAliases, foods, recipeIngredients, recipes, servings } from './schema/foods';

const now = () => new Date().toISOString();

const IDS = {
  kanin: 'a1000000-0000-4000-8000-000000000001',
  adobo: 'a1000000-0000-4000-8000-000000000002',
  sinangag: 'a1000000-0000-4000-8000-000000000003',
  itlog: 'a1000000-0000-4000-8000-000000000004',
  pandesal: 'a1000000-0000-4000-8000-000000000005',
  recipe: 'a1000000-0000-4000-8000-000000000010',
} as const;

type SeedFood = {
  id: string;
  source_id: string;
  name: string;
  name_tl: string[];
  kcal: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  fiber_g: string;
  sugar_g: string;
  sodium_mg: string;
  confidence: string;
  source_note: string;
  servings: { label: string; grams: string; is_default?: boolean }[];
  aliases?: string[];
};

const SEED_FOODS: SeedFood[] = [
  {
    id: IDS.kanin,
    source_id: 'kanin-white-cooked',
    name: 'Kanin (white rice, cooked)',
    name_tl: ['kanin', 'rice', 'sinaing', 'bigas na luto'],
    kcal: '130',
    protein_g: '2.7',
    carbs_g: '28.2',
    fat_g: '0.3',
    fiber_g: '0.4',
    sugar_g: '0.1',
    sodium_mg: '1',
    confidence: '0.80',
    source_note: 'USDA FDC "Rice, white, long-grain, regular, cooked, unenriched".',
    servings: [
      { label: '1 tasa', grams: '200', is_default: true },
      { label: '1/2 tasa', grams: '100' },
    ],
    aliases: ['rice', 'sinaing'],
  },
  {
    id: IDS.adobo,
    source_id: 'adobong-manok',
    name: 'Chicken adobo',
    name_tl: ['adobong manok', 'adobo', 'chicken adobo'],
    kcal: '190',
    protein_g: '17.0',
    carbs_g: '2.1',
    fat_g: '12.4',
    fiber_g: '0.1',
    sugar_g: '1.0',
    sodium_mg: '620',
    confidence: '0.60',
    source_note:
      'Ingredient decomposition from USDA FDC (chicken thigh with skin, cooked; soy sauce; vegetable oil).',
    servings: [
      { label: '1 serving (1 hita + sauce)', grams: '150', is_default: true },
      { label: '1 piraso (thigh)', grams: '110' },
    ],
  },
  {
    id: IDS.sinangag,
    source_id: 'sinangag',
    name: 'Sinangag (garlic fried rice)',
    name_tl: ['sinangag', 'garlic rice', 'fried rice'],
    kcal: '168',
    protein_g: '3.0',
    carbs_g: '31.0',
    fat_g: '3.4',
    fiber_g: '0.5',
    sugar_g: '0.2',
    sodium_mg: '240',
    confidence: '0.55',
    source_note:
      'Cooked white rice + garlic + oil. Assumed 15ml oil per 400g cooked rice. USDA FDC rice + vegetable oil.',
    servings: [{ label: '1 tasa', grams: '180', is_default: true }],
  },
  {
    id: IDS.itlog,
    source_id: 'itlog-prito',
    name: 'Fried egg',
    name_tl: ['itlog prito', 'prito na itlog', 'sunny side up'],
    kcal: '196',
    protein_g: '13.6',
    carbs_g: '0.9',
    fat_g: '14.8',
    fiber_g: '0',
    sugar_g: '0.4',
    sodium_mg: '207',
    confidence: '0.70',
    source_note: 'USDA FDC "Egg, whole, cooked, fried" (approximate, oil amount varies).',
    servings: [{ label: '1 piraso', grams: '46', is_default: true }],
  },
  {
    id: IDS.pandesal,
    source_id: 'pandesal',
    name: 'Pandesal',
    name_tl: ['pandesal', 'bread', 'tinapay'],
    kcal: '300',
    protein_g: '9.0',
    carbs_g: '55.0',
    fat_g: '5.0',
    fiber_g: '2.0',
    sugar_g: '6.0',
    sodium_mg: '420',
    confidence: '0.50',
    source_note:
      'Approximate bakery roll from USDA FDC "Rolls, hamburger or hot dog, plain" scaled to a typical 40g piece. Confirm against a specific bakery.',
    servings: [{ label: '1 piraso', grams: '40', is_default: true }],
  },
];

export async function seed(): Promise<{ foods: number; recipes: number }> {
  const { db, client } = createDrizzle(requireDatabaseUrl());
  const updatedAt = now();

  try {
    for (const food of SEED_FOODS) {
      await db
        .insert(foods)
        .values({
          id: food.id,
          source: 'ph_core',
          source_id: food.source_id,
          name: food.name,
          name_tl: food.name_tl,
          kcal: food.kcal,
          protein_g: food.protein_g,
          carbs_g: food.carbs_g,
          fat_g: food.fat_g,
          fiber_g: food.fiber_g,
          sugar_g: food.sugar_g,
          sodium_mg: food.sodium_mg,
          confidence: food.confidence,
          source_note: food.source_note,
          verified_by_user: false,
          shared: false,
          updated_at: updatedAt,
        })
        .onConflictDoUpdate({
          target: [foods.source, foods.source_id],
          set: {
            name: food.name,
            name_tl: food.name_tl,
            kcal: food.kcal,
            protein_g: food.protein_g,
            carbs_g: food.carbs_g,
            fat_g: food.fat_g,
            fiber_g: food.fiber_g,
            sugar_g: food.sugar_g,
            sodium_mg: food.sodium_mg,
            confidence: food.confidence,
            source_note: food.source_note,
            updated_at: updatedAt,
          },
        });

      for (const serving of food.servings) {
        await db
          .insert(servings)
          .values({
            food_id: food.id,
            label: serving.label,
            grams_equivalent: serving.grams,
            is_default: serving.is_default ?? false,
            updated_at: updatedAt,
          })
          .onConflictDoUpdate({
            target: [servings.food_id, servings.label],
            set: {
              grams_equivalent: serving.grams,
              is_default: serving.is_default ?? false,
              updated_at: updatedAt,
            },
          });
      }

      for (const alias of food.aliases ?? []) {
        await db
          .insert(foodAliases)
          .values({
            food_id: food.id,
            alias,
            updated_at: updatedAt,
          })
          .onConflictDoNothing();
      }
    }

    const existingRecipe = await db
      .select({ id: recipes.id })
      .from(recipes)
      .where(and(isNull(recipes.user_id), eq(recipes.name, 'Adobo with rice')))
      .limit(1);

    const recipeId = existingRecipe[0]?.id ?? IDS.recipe;
    if (!existingRecipe[0]) {
      await db.insert(recipes).values({
        id: recipeId,
        user_id: null,
        name: 'Adobo with rice',
        name_tl: ['adobo at kanin', 'chicken adobo with rice'],
        shared: true,
        updated_at: updatedAt,
      });
    }

    await db.delete(recipeIngredients).where(eq(recipeIngredients.recipe_id, recipeId));

    const kaninDefault = await db
      .select({ id: servings.id })
      .from(servings)
      .where(and(eq(servings.food_id, IDS.kanin), eq(servings.is_default, true)))
      .limit(1);
    const adoboDefault = await db
      .select({ id: servings.id })
      .from(servings)
      .where(and(eq(servings.food_id, IDS.adobo), eq(servings.is_default, true)))
      .limit(1);

    await db.insert(recipeIngredients).values([
      {
        recipe_id: recipeId,
        food_id: IDS.kanin,
        quantity: '1',
        serving_id: kaninDefault[0]?.id,
        prep_note: 'Steamed, plated beside the ulam',
        updated_at: updatedAt,
      },
      {
        recipe_id: recipeId,
        food_id: IDS.adobo,
        quantity: '1',
        serving_id: adoboDefault[0]?.id,
        prep_note: '1 hita with reduced sauce',
        updated_at: updatedAt,
      },
    ]);

    return { foods: SEED_FOODS.length, recipes: 1 };
  } finally {
    await client.end({ timeout: 5 });
  }
}
