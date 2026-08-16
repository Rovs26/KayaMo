import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { phCoreFileSchema, type PhCoreFood } from './schema';
import { parsePhCoreDocument, type PhCoreValidation } from './validate';

const HEADER = `# KayaMo — Philippine core food dataset (Chapter 7)
#
# THIS IS YOUR MOAT. Hand-curated, personally verified.
#
# Rules:
#  - Never scrape FNRI PhilFCT. Derive values by decomposing dishes into
#    ingredients priced against CC0 USDA FoodData Central data.
#  - Record the assumed recipe in source_note for every entry.
#  - confidence stays <= 0.8 until you have personally verified the entry.
#  - macros must reconcile with kcal within 5% using the 4/4/9 rule.
`;

export function findPhCoreYamlPath(cwd = process.cwd()): string {
  const fromEnv = process.env.PH_CORE_YAML_PATH?.trim();
  if (fromEnv) return fromEnv;
  const candidates = [
    resolve(cwd, 'data/ph-core/foods.yaml'),
    resolve(cwd, '../../data/ph-core/foods.yaml'),
    resolve(cwd, '../../../data/ph-core/foods.yaml'),
  ];
  for (const filePath of candidates) {
    if (existsSync(filePath)) return filePath;
  }
  throw new Error('Could not find data/ph-core/foods.yaml. Set PH_CORE_YAML_PATH.');
}

export function loadPhCoreYaml(filePath = findPhCoreYamlPath()): PhCoreValidation {
  const text = readFileSync(filePath, 'utf8');
  const raw: unknown = parseYaml(text);
  return parsePhCoreDocument(raw);
}

export function serializePhCoreYaml(foods: PhCoreFood[]): string {
  const body = stringifyYaml(
    { foods: foods.map(toYamlFood) },
    { lineWidth: 88, indent: 2, sortMapEntries: false },
  );
  return `${HEADER}\n${body}`;
}

export function writePhCoreYaml(foods: PhCoreFood[], filePath = findPhCoreYamlPath()): void {
  phCoreFileSchema.parse({ foods });
  writeFileSync(filePath, serializePhCoreYaml(foods), 'utf8');
}

export function replacePhCoreFood(foods: PhCoreFood[], next: PhCoreFood): PhCoreFood[] {
  const index = foods.findIndex((food) => food.id === next.id);
  if (index < 0) {
    return [...foods, next];
  }
  return foods.map((food, i) => (i === index ? next : food));
}

function toYamlFood(food: PhCoreFood): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: food.id,
    name: food.name,
    name_tl: food.name_tl,
    category: food.category,
    per100g: food.per100g,
    servings: food.servings,
    typical_prep: food.typical_prep,
    source_note: food.source_note,
    confidence: food.confidence,
  };
  if (food.verified) row.verified = true;
  return row;
}
