import {
  ATWATER_CARBS,
  ATWATER_FAT,
  ATWATER_PROTEIN,
  ATWATER_TOLERANCE,
  UNVERIFIED_CONFIDENCE_MAX,
  phCoreFileSchema,
  type PhCoreFood,
} from './schema';

export type PhCoreIssue = {
  id: string;
  level: 'error' | 'warning';
  code: string;
  message: string;
};

export function atwaterKcal(food: PhCoreFood): number {
  const { protein, carbs, fat } = food.per100g;
  return ATWATER_PROTEIN * protein + ATWATER_CARBS * carbs + ATWATER_FAT * fat;
}

export function atwaterDelta(food: PhCoreFood): number {
  const expected = atwaterKcal(food);
  const actual = food.per100g.kcal;
  const denom = Math.max(actual, expected, 1);
  return Math.abs(actual - expected) / denom;
}

function defaultServingCount(food: PhCoreFood): number {
  return food.servings.filter((serving) => serving.is_default === true).length;
}

export function issuesForFood(food: PhCoreFood): PhCoreIssue[] {
  const issues: PhCoreIssue[] = [];
  const { id } = food;

  if (!food.verified && food.confidence > UNVERIFIED_CONFIDENCE_MAX) {
    issues.push({
      id,
      level: 'error',
      code: 'confidence_unverified',
      message: `confidence ${food.confidence} must be <= ${UNVERIFIED_CONFIDENCE_MAX} until verified`,
    });
  }

  if (food.verified && food.confidence < 1) {
    issues.push({
      id,
      level: 'warning',
      code: 'verified_confidence',
      message: 'verified entries should use confidence 1.0',
    });
  }

  const defaults = defaultServingCount(food);
  if (defaults !== 1) {
    issues.push({
      id,
      level: 'error',
      code: 'default_serving',
      message: `exactly one serving must be is_default (found ${defaults})`,
    });
  }

  const delta = atwaterDelta(food);
  if (delta > ATWATER_TOLERANCE) {
    issues.push({
      id,
      level: 'error',
      code: 'atwater',
      message: `kcal ${food.per100g.kcal} is ${(delta * 100).toFixed(1)}% off Atwater 4/4/9 (${atwaterKcal(food).toFixed(1)} kcal)`,
    });
  }

  const note = food.source_note.toLowerCase();
  if (note.includes('fnri') || note.includes('philfct')) {
    issues.push({
      id,
      level: 'error',
      code: 'fnri',
      message: 'Do not use FNRI PhilFCT as a source. Derive from USDA FDC and record the recipe.',
    });
  }
  if (!note.includes('usda')) {
    issues.push({
      id,
      level: 'error',
      code: 'usda_note',
      message: 'source_note must cite USDA FDC ingredients used in the decomposition',
    });
  }

  if (food.per100g.sodium_mg > 1000) {
    issues.push({
      id,
      level: 'warning',
      code: 'high_sodium',
      message: `sodium ${food.per100g.sodium_mg} mg/100g is high — check the assumed sawsawan`,
    });
  }
  if (food.per100g.kcal > 400) {
    issues.push({
      id,
      level: 'warning',
      code: 'high_kcal',
      message: `kcal ${food.per100g.kcal}/100g is energy-dense (expected for fried pork; still review)`,
    });
  }

  return issues;
}

export type PhCoreValidation = {
  foods: PhCoreFood[];
  issues: PhCoreIssue[];
  errors: PhCoreIssue[];
  warnings: PhCoreIssue[];
};

export function validatePhCoreFoods(foods: PhCoreFood[]): PhCoreValidation {
  const issues: PhCoreIssue[] = [];
  const seen = new Set<string>();
  for (const food of foods) {
    if (seen.has(food.id)) {
      issues.push({
        id: food.id,
        level: 'error',
        code: 'duplicate_id',
        message: `duplicate id ${food.id}`,
      });
    }
    seen.add(food.id);
    issues.push(...issuesForFood(food));
  }
  return {
    foods,
    issues,
    errors: issues.filter((issue) => issue.level === 'error'),
    warnings: issues.filter((issue) => issue.level === 'warning'),
  };
}

export function parsePhCoreDocument(raw: unknown): PhCoreValidation {
  const parsed = phCoreFileSchema.parse(raw);
  return validatePhCoreFoods(parsed.foods);
}
