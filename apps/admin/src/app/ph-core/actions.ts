'use server';

import { loadRootEnv, upsertPhCoreFoods } from '@kayamo/db';
import {
  loadPhCoreYaml,
  phCoreFoodSchema,
  replacePhCoreFood,
  toPhCoreFoodRow,
  validatePhCoreFoods,
  writePhCoreYaml,
  type PhCoreFood,
} from '@kayamo/food';
import { assertPhCoreEditor } from '@/lib/ph-core-dev';

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Unknown error';
}

function parseFood(input: unknown): PhCoreFood {
  return phCoreFoodSchema.parse(input);
}

export async function savePhCoreFood(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    assertPhCoreEditor();
    const food = parseFood(input);
    const current = loadPhCoreYaml();
    const foods = replacePhCoreFood(current.foods, food);
    const next = validatePhCoreFoods(foods);
    if (next.errors.length > 0) {
      return { ok: false, error: next.errors.map((issue) => `${issue.id}: ${issue.message}`).join(' ') };
    }
    writePhCoreYaml(next.foods);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function confirmPhCoreFood(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const food = parseFood(input);
    return saveAndUpsert({ ...food, verified: true, confidence: 1 });
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function applyPhCoreFood(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    assertPhCoreEditor();
    loadRootEnv();
    const current = loadPhCoreYaml();
    if (current.errors.length > 0) {
      return { ok: false, error: current.errors.map((issue) => issue.message).join(' ') };
    }
    const food = current.foods.find((row) => row.id === id);
    if (!food) return { ok: false, error: `Unknown food ${id}` };
    await upsertPhCoreFoods([toPhCoreFoodRow(food)]);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function applyAllPhCoreFoods(): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  try {
    assertPhCoreEditor();
    loadRootEnv();
    const current = loadPhCoreYaml();
    if (current.errors.length > 0) {
      return { ok: false, error: current.errors.map((issue) => issue.message).join(' ') };
    }
    await upsertPhCoreFoods(current.foods.map(toPhCoreFoodRow));
    return { ok: true, count: current.foods.length };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

async function saveAndUpsert(food: PhCoreFood): Promise<{ ok: true } | { ok: false; error: string }> {
  const saved = await savePhCoreFood(food);
  if (!saved.ok) return saved;
  return applyPhCoreFood(food.id);
}
