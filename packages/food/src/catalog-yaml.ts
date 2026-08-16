import { memoryResolveCatalog, phCoreToCatalog, type ResolveCatalog } from './catalog';
import { loadPhCoreYaml } from './ph-core/io';
import type { PhCoreFood } from './ph-core/schema';

/** Server/test helper. Do not import from `"use client"` files. */
export function yamlPhCoreCatalog(foods?: PhCoreFood[]): ResolveCatalog {
  const list = foods ?? loadPhCoreYaml().foods;
  return memoryResolveCatalog({ foods: list.map(phCoreToCatalog) });
}
