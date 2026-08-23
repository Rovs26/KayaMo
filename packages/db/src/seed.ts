import { and, eq, isNull } from 'drizzle-orm';
import { createDrizzle, requireDatabaseUrl } from './drizzle';
import { foodAliases, foods, recipeIngredients, recipes, servings } from './schema/foods';
import { routines, tasks } from './schema/planning';
import { exercises } from './schema/training';
import {
  achievementDefinitions,
  cosmeticDefinitions,
  evolutionStages,
} from './schema/journey';
import { scripturePassages } from './schema/daily-loop';
import { REVIEWED_SCRIPTURE_PASSAGES } from './scripture-data';

const now = () => new Date().toISOString();

const IDS = {
  kanin: 'a1000000-0000-4000-8000-000000000001',
  adobo: 'a1000000-0000-4000-8000-000000000002',
  sinangag: 'a1000000-0000-4000-8000-000000000003',
  itlog: 'a1000000-0000-4000-8000-000000000004',
  pandesal: 'a1000000-0000-4000-8000-000000000005',
  recipe: 'a1000000-0000-4000-8000-000000000010',
  task: 'a1000000-0000-4000-8000-000000000020',
  routine: 'a1000000-0000-4000-8000-000000000021',
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

type SeedExercise = {
  id: string;
  name: string;
  aliases: string[];
  muscles: string[];
  secondary: string[];
  equipment: string;
  pattern: string;
  unilateral?: boolean;
  reps: [number, number];
  cues: string[];
  mistakes: string[];
};

const EXERCISE_NAMES: Omit<SeedExercise, 'id'>[] = [
  {
    name: 'Back Squat',
    aliases: ['barbell squat'],
    muscles: ['quadriceps', 'glutes'],
    secondary: ['hamstrings', 'core'],
    equipment: 'barbell',
    pattern: 'squat',
    reps: [5, 10],
    cues: ['Brace before descending', 'Keep the whole foot planted'],
    mistakes: ['Knees collapsing inward', 'Losing torso tension'],
  },
  {
    name: 'Front Squat',
    aliases: [],
    muscles: ['quadriceps'],
    secondary: ['glutes', 'core'],
    equipment: 'barbell',
    pattern: 'squat',
    reps: [4, 8],
    cues: ['Keep elbows high', 'Sit between the hips'],
    mistakes: ['Elbows dropping', 'Heels lifting'],
  },
  {
    name: 'Goblet Squat',
    aliases: [],
    muscles: ['quadriceps', 'glutes'],
    secondary: ['core'],
    equipment: 'dumbbell',
    pattern: 'squat',
    reps: [8, 15],
    cues: ['Hold the load close', 'Track knees over toes'],
    mistakes: ['Rounding the back', 'Weight shifting to toes'],
  },
  {
    name: 'Romanian Deadlift',
    aliases: ['RDL'],
    muscles: ['hamstrings', 'glutes'],
    secondary: ['erectors'],
    equipment: 'barbell',
    pattern: 'hinge',
    reps: [6, 12],
    cues: ['Push hips back', 'Keep the bar close'],
    mistakes: ['Turning it into a squat', 'Rounding the lower back'],
  },
  {
    name: 'Conventional Deadlift',
    aliases: ['deadlift'],
    muscles: ['glutes', 'hamstrings'],
    secondary: ['quadriceps', 'erectors', 'upper back'],
    equipment: 'barbell',
    pattern: 'hinge',
    reps: [3, 6],
    cues: ['Brace and remove bar slack', 'Push the floor away'],
    mistakes: ['Jerking the bar', 'Hyperextending at lockout'],
  },
  {
    name: 'Hip Thrust',
    aliases: ['barbell hip thrust'],
    muscles: ['glutes'],
    secondary: ['hamstrings'],
    equipment: 'barbell',
    pattern: 'hinge',
    reps: [8, 15],
    cues: ['Tuck the pelvis at lockout', 'Keep ribs down'],
    mistakes: ['Overarching the back', 'Feet too far away'],
  },
  {
    name: 'Bulgarian Split Squat',
    aliases: ['rear-foot elevated split squat'],
    muscles: ['quadriceps', 'glutes'],
    secondary: ['adductors'],
    equipment: 'dumbbell',
    pattern: 'lunge',
    unilateral: true,
    reps: [8, 12],
    cues: ['Control the descent', 'Drive through the front foot'],
    mistakes: ['Pushing off the rear foot', 'Front knee collapsing inward'],
  },
  {
    name: 'Walking Lunge',
    aliases: [],
    muscles: ['quadriceps', 'glutes'],
    secondary: ['hamstrings'],
    equipment: 'dumbbell',
    pattern: 'lunge',
    unilateral: true,
    reps: [8, 16],
    cues: ['Step to a stable base', 'Lower under control'],
    mistakes: ['Feet landing in one line', 'Bouncing off the rear knee'],
  },
  {
    name: 'Standing Calf Raise',
    aliases: [],
    muscles: ['calves'],
    secondary: [],
    equipment: 'machine',
    pattern: 'calf_raise',
    reps: [10, 20],
    cues: ['Pause at the top', 'Use a full stretch'],
    mistakes: ['Bouncing', 'Rolling onto the outer foot'],
  },
  {
    name: 'Bench Press',
    aliases: ['barbell bench press'],
    muscles: ['chest'],
    secondary: ['triceps', 'front delts'],
    equipment: 'barbell',
    pattern: 'horizontal_push',
    reps: [5, 10],
    cues: ['Set shoulder blades', 'Touch consistently on the lower chest'],
    mistakes: ['Elbows flaring excessively', 'Losing foot pressure'],
  },
  {
    name: 'Incline Dumbbell Press',
    aliases: [],
    muscles: ['chest'],
    secondary: ['front delts', 'triceps'],
    equipment: 'dumbbell',
    pattern: 'horizontal_push',
    reps: [8, 12],
    cues: ['Keep wrists stacked', 'Lower with control'],
    mistakes: ['Bench angle too steep', 'Shoulders rolling forward'],
  },
  {
    name: 'Push-Up',
    aliases: ['push up'],
    muscles: ['chest'],
    secondary: ['triceps', 'core'],
    equipment: 'bodyweight',
    pattern: 'horizontal_push',
    reps: [8, 20],
    cues: ['Keep a straight body line', 'Reach the floor with the chest'],
    mistakes: ['Hips sagging', 'Elbows flaring'],
  },
  {
    name: 'Overhead Press',
    aliases: ['military press'],
    muscles: ['shoulders'],
    secondary: ['triceps', 'core'],
    equipment: 'barbell',
    pattern: 'vertical_push',
    reps: [5, 10],
    cues: ['Brace glutes and ribs', 'Finish with the bar over midfoot'],
    mistakes: ['Leaning back excessively', 'Pressing around the face'],
  },
  {
    name: 'Dumbbell Lateral Raise',
    aliases: ['lateral raise'],
    muscles: ['side delts'],
    secondary: [],
    equipment: 'dumbbell',
    pattern: 'shoulder_abduction',
    reps: [10, 20],
    cues: ['Lead with the elbows', 'Use a controlled arc'],
    mistakes: ['Shrugging', 'Swinging the torso'],
  },
  {
    name: 'Pull-Up',
    aliases: ['pull up'],
    muscles: ['lats'],
    secondary: ['biceps', 'upper back'],
    equipment: 'pull-up bar',
    pattern: 'vertical_pull',
    reps: [4, 10],
    cues: ['Start from a controlled hang', 'Drive elbows toward the ribs'],
    mistakes: ['Kipping unintentionally', 'Craning the neck'],
  },
  {
    name: 'Lat Pulldown',
    aliases: [],
    muscles: ['lats'],
    secondary: ['biceps', 'upper back'],
    equipment: 'cable',
    pattern: 'vertical_pull',
    reps: [8, 15],
    cues: ['Keep ribs controlled', 'Pull elbows down'],
    mistakes: ['Leaning far back', 'Pulling behind the neck'],
  },
  {
    name: 'Barbell Row',
    aliases: ['bent-over row'],
    muscles: ['upper back', 'lats'],
    secondary: ['biceps', 'erectors'],
    equipment: 'barbell',
    pattern: 'horizontal_pull',
    reps: [6, 12],
    cues: ['Hold a stable hinge', 'Pull toward the lower ribs'],
    mistakes: ['Jerking with the hips', 'Rounding the back'],
  },
  {
    name: 'Seated Cable Row',
    aliases: [],
    muscles: ['upper back'],
    secondary: ['lats', 'biceps'],
    equipment: 'cable',
    pattern: 'horizontal_pull',
    reps: [8, 15],
    cues: ['Stay tall', 'Reach then drive elbows back'],
    mistakes: ['Excessive torso swing', 'Shrugging'],
  },
  {
    name: 'Face Pull',
    aliases: [],
    muscles: ['rear delts', 'upper back'],
    secondary: ['rotator cuff'],
    equipment: 'cable',
    pattern: 'horizontal_pull',
    reps: [12, 20],
    cues: ['Pull toward eye level', 'Rotate thumbs behind you'],
    mistakes: ['Using too much load', 'Arching the lower back'],
  },
  {
    name: 'Barbell Curl',
    aliases: [],
    muscles: ['biceps'],
    secondary: ['forearms'],
    equipment: 'barbell',
    pattern: 'elbow_flexion',
    reps: [8, 15],
    cues: ['Keep elbows still', 'Lower fully under control'],
    mistakes: ['Swinging the hips', 'Letting elbows drift forward'],
  },
  {
    name: 'Triceps Pushdown',
    aliases: ['cable pushdown'],
    muscles: ['triceps'],
    secondary: [],
    equipment: 'cable',
    pattern: 'elbow_extension',
    reps: [8, 15],
    cues: ['Pin elbows to the sides', 'Reach full extension'],
    mistakes: ['Shoulders rolling forward', 'Using torso momentum'],
  },
  {
    name: 'Plank',
    aliases: ['forearm plank'],
    muscles: ['core'],
    secondary: ['glutes'],
    equipment: 'bodyweight',
    pattern: 'anti_extension',
    reps: [20, 60],
    cues: ['Squeeze glutes', 'Keep ribs pulled down'],
    mistakes: ['Hips sagging', 'Holding the breath'],
  },
  {
    name: 'Dead Bug',
    aliases: [],
    muscles: ['core'],
    secondary: ['hip flexors'],
    equipment: 'bodyweight',
    pattern: 'anti_extension',
    unilateral: true,
    reps: [6, 12],
    cues: ['Keep the lower back gently down', 'Move slowly'],
    mistakes: ['Ribs flaring', 'Rushing the limbs'],
  },
  {
    name: 'Farmer Carry',
    aliases: ["farmer's walk"],
    muscles: ['grip', 'upper back'],
    secondary: ['core', 'glutes'],
    equipment: 'dumbbell',
    pattern: 'carry',
    reps: [20, 60],
    cues: ['Walk tall', 'Keep loads quiet'],
    mistakes: ['Leaning to one side', 'Taking uncontrolled steps'],
  },
];

const SEED_EXERCISES: SeedExercise[] = EXERCISE_NAMES.map((exercise, index) => ({
  ...exercise,
  id: `b1000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
}));

const SEED_STAGES = [
  ['seed', 'Seed', 'Coco is carrying the possibility of new growth.', 0],
  ['sprout', 'Sprout', 'Small confirmed actions have begun to take root.', 100],
  ['sapling', 'Sapling', 'Consistency is becoming a living practice.', 300],
  ['young_tree', 'Young tree', 'Coco reflects a resilient pattern of returning.', 700],
  [
    'flourishing_tree',
    'Flourishing tree',
    'Long-term care has become visible growth.',
    1500,
  ],
] as const;

const SEED_ACHIEVEMENTS = [
  [
    'c1000000-0000-4000-8000-000000000001',
    'first_step',
    'First step',
    'Complete one confirmed action.',
    'event_count',
    null,
    1,
  ],
  [
    'c1000000-0000-4000-8000-000000000002',
    'ten_true_steps',
    'Ten true steps',
    'Complete ten confirmed actions.',
    'event_count',
    null,
    10,
  ],
  [
    'c1000000-0000-4000-8000-000000000003',
    'welcome_back',
    'Welcome back',
    'Return to a routine or habit after time away.',
    'event_type_count',
    'recovery_return',
    1,
  ],
  [
    'c1000000-0000-4000-8000-000000000004',
    'milestone_maker',
    'Milestone maker',
    'Complete a confirmed goal milestone.',
    'event_type_count',
    'milestone_completed',
    1,
  ],
  [
    'c1000000-0000-4000-8000-000000000005',
    'goal_keeper',
    'Goal keeper',
    'Complete a goal you chose.',
    'event_type_count',
    'goal_completed',
    1,
  ],
  [
    'c1000000-0000-4000-8000-000000000006',
    'sprout_stage',
    'New growth',
    'Help Coco reach the sprout stage.',
    'total_points',
    null,
    100,
  ],
] as const;

const SEED_COSMETICS = [
  [
    'd1000000-0000-4000-8000-000000000001',
    'morning_dew',
    'Morning dew',
    'A quiet accent for a new beginning.',
    'seed',
    'coco.morning_dew',
  ],
  [
    'd1000000-0000-4000-8000-000000000002',
    'hope_ribbon',
    'Hope ribbon',
    'A blue-white ribbon unlocked through steady action.',
    'sprout',
    'coco.hope_ribbon',
  ],
  [
    'd1000000-0000-4000-8000-000000000003',
    'steadfast_glow',
    'Steadfast glow',
    'A warm glow that reflects resilient return.',
    'young_tree',
    'coco.steadfast_glow',
  ],
] as const;

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

export async function seed(): Promise<{
  foods: number;
  exercises: number;
  stages: number;
  achievements: number;
  cosmetics: number;
  recipes: number;
  tasks: number;
  routines: number;
  scripturePassages: number;
}> {
  const { db, client } = createDrizzle(requireDatabaseUrl());
  const updatedAt = now();

  try {
    for (const passage of REVIEWED_SCRIPTURE_PASSAGES) {
      await db
        .insert(scripturePassages)
        .values({
          ...passage,
          tags: [...passage.tags],
          updated_at: updatedAt,
        })
        .onConflictDoUpdate({
          target: scripturePassages.key,
          set: {
            reference: passage.reference,
            text: passage.text,
            translation_key: passage.translation_key,
            license: passage.license,
            source_url: passage.source_url,
            tags: [...passage.tags],
            reviewed_at: passage.reviewed_at,
            active: true,
            updated_at: updatedAt,
          },
        });
    }
    for (const [key, name, description, minimumPoints] of SEED_STAGES) {
      const sortOrder = SEED_STAGES.findIndex((stage) => stage[0] === key);
      await db
        .insert(evolutionStages)
        .values({
          key,
          name,
          description,
          minimum_points: minimumPoints,
          sort_order: sortOrder,
          updated_at: updatedAt,
        })
        .onConflictDoUpdate({
          target: evolutionStages.key,
          set: {
            name,
            description,
            minimum_points: minimumPoints,
            sort_order: sortOrder,
            updated_at: updatedAt,
          },
        });
    }
    for (const [
      id,
      key,
      title,
      description,
      metric,
      eventType,
      threshold,
    ] of SEED_ACHIEVEMENTS) {
      await db
        .insert(achievementDefinitions)
        .values({
          id,
          key,
          title,
          description,
          metric,
          event_type: eventType,
          threshold,
          updated_at: updatedAt,
        })
        .onConflictDoUpdate({
          target: achievementDefinitions.key,
          set: {
            title,
            description,
            metric,
            event_type: eventType,
            threshold,
            active: true,
            updated_at: updatedAt,
          },
        });
    }
    for (const [
      id,
      key,
      title,
      description,
      requiredStageKey,
      assetKey,
    ] of SEED_COSMETICS) {
      await db
        .insert(cosmeticDefinitions)
        .values({
          id,
          key,
          title,
          description,
          required_stage_key: requiredStageKey,
          asset_key: assetKey,
          updated_at: updatedAt,
        })
        .onConflictDoUpdate({
          target: cosmeticDefinitions.key,
          set: {
            title,
            description,
            required_stage_key: requiredStageKey,
            asset_key: assetKey,
            active: true,
            updated_at: updatedAt,
          },
        });
    }

    for (const exercise of SEED_EXERCISES) {
      await db
        .insert(exercises)
        .values({
          id: exercise.id,
          source: 'canonical',
          name: exercise.name,
          name_tl: exercise.aliases,
          muscles: exercise.muscles,
          secondary_muscles: exercise.secondary,
          equipment: exercise.equipment,
          pattern: exercise.pattern,
          unilateral: exercise.unilateral ?? false,
          default_rep_min: exercise.reps[0],
          default_rep_max: exercise.reps[1],
          form_cues: exercise.cues,
          common_mistakes: exercise.mistakes,
          shared: true,
          updated_at: updatedAt,
        })
        .onConflictDoUpdate({
          target: exercises.id,
          set: {
            name: exercise.name,
            name_tl: exercise.aliases,
            muscles: exercise.muscles,
            secondary_muscles: exercise.secondary,
            equipment: exercise.equipment,
            pattern: exercise.pattern,
            unilateral: exercise.unilateral ?? false,
            default_rep_min: exercise.reps[0],
            default_rep_max: exercise.reps[1],
            form_cues: exercise.cues,
            common_mistakes: exercise.mistakes,
            updated_at: updatedAt,
            deleted_at: null,
          },
        });
    }

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

    const seedUserId = process.env.KAYAMO_SEED_USER_ID;
    if (seedUserId) {
      const logicalDate = updatedAt.slice(0, 10);
      await db
        .insert(tasks)
        .values({
          id: IDS.task,
          user_id: seedUserId,
          title: "Choose today's one realistic action",
          notes: 'A demo record for the Coco-first daily context.',
          scheduled_for: logicalDate,
          sort_order: 0,
          origin: 'user',
          updated_at: updatedAt,
        })
        .onConflictDoUpdate({
          target: tasks.id,
          set: {
            title: "Choose today's one realistic action",
            scheduled_for: logicalDate,
            updated_at: updatedAt,
            deleted_at: null,
          },
        });
      await db
        .insert(routines)
        .values({
          id: IDS.routine,
          user_id: seedUserId,
          title: 'Morning check-in',
          notes: 'Notice what would make today feel meaningful.',
          schedule_days: [0, 1, 2, 3, 4, 5, 6],
          preferred_time: '07:00:00',
          sort_order: 0,
          updated_at: updatedAt,
        })
        .onConflictDoUpdate({
          target: routines.id,
          set: {
            title: 'Morning check-in',
            active: true,
            updated_at: updatedAt,
            deleted_at: null,
          },
        });
    }

    return {
      foods: SEED_FOODS.length,
      exercises: SEED_EXERCISES.length,
      stages: SEED_STAGES.length,
      achievements: SEED_ACHIEVEMENTS.length,
      cosmetics: SEED_COSMETICS.length,
      recipes: 1,
      tasks: seedUserId ? 1 : 0,
      routines: seedUserId ? 1 : 0,
      scripturePassages: REVIEWED_SCRIPTURE_PASSAGES.length,
    };
  } finally {
    await client.end({ timeout: 5 });
  }
}
