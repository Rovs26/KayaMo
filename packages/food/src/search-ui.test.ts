import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { memoryResolveCatalog, phCoreToCatalog } from './catalog';
import { yamlPhCoreCatalog } from './catalog-yaml';
import { resolveFood } from './resolve';
import {
  candidateDedupeKey,
  frequentLoggedFoods,
  isEstimateResult,
  mergeCandidatesById,
  persistableFoodId,
  recentLoggedFoods,
  remoteOnlyCandidates,
  servingKcal,
  showsVerifiedCheck,
  sourceBadge,
  type FoodCandidate,
  type SearchHistoryEntry,
} from './search-ui';

const USER = 'user-ch11';

function candidate(overrides: Partial<FoodCandidate> & Pick<FoodCandidate, 'foodId' | 'name' | 'source'>): FoodCandidate {
  return {
    sourceId: overrides.sourceId,
    confidence: 0.9,
    rankScore: 0.9,
    matchScore: 1,
    timesLogged: 0,
    whyMatched: 'test',
    per100g: {
      kcal: 130,
      protein_g: 2.7,
      carbs_g: 28.2,
      fat_g: 0.3,
      fiber_g: 0.4,
      sugar_g: 0.1,
      sodium_mg: 1,
    },
    servings: [{ label: '1 tasa', grams: 200, isDefault: true }],
    portion: {
      amount: 1,
      unit: '1 tasa',
      grams: 200,
      servingLabel: '1 tasa',
      kcal: 260,
    },
    ...overrides,
  };
}

function history(
  overrides: Partial<SearchHistoryEntry> & Pick<SearchHistoryEntry, 'foodId' | 'name' | 'loggedAtMs'>,
): SearchHistoryEntry {
  return {
    quantity: '1',
    grams: '200',
    servingId: 's1',
    servingLabel: '1 tasa',
    kcal: '260',
    protein_g: '5',
    carbs_g: '56',
    fat_g: '0.6',
    fiber_g: '0.8',
    sugar_g: '0.2',
    sodium_mg: '2',
    source: 'ph_core',
    resolvedVia: 'ph_core',
    confidence: '0.90',
    ...overrides,
  };
}

describe('source badges and confidence tags', () => {
  it('maps cascade sources onto PH / Brand / USDA / Yours', () => {
    expect(sourceBadge('ph_core')).toBe('PH');
    expect(sourceBadge('off')).toBe('Brand');
    expect(sourceBadge('usda_fdc')).toBe('USDA');
    expect(sourceBadge('user')).toBe('Yours');
    expect(sourceBadge('llm')).toBeNull();
  });

  it('checks verified foods and labels LLM rows as estimates', () => {
    expect(showsVerifiedCheck(candidate({ foodId: 'a', name: 'Kanin', source: 'ph_core', verified: true }))).toBe(
      true,
    );
    expect(showsVerifiedCheck(candidate({ foodId: 'b', name: 'Kanin', source: 'ph_core' }))).toBe(false);
    expect(isEstimateResult(candidate({ foodId: 'c', name: 'Mystery ulam', source: 'llm', estimate: true }))).toBe(
      true,
    );
    expect(
      showsVerifiedCheck(
        candidate({ foodId: 'd', name: 'Mystery ulam', source: 'llm', estimate: true, verified: true }),
      ),
    ).toBe(false);
  });
});

describe('local-then-remote merge', () => {
  it('keeps local hits first and streams new remotes below', () => {
    const local = [
      candidate({ foodId: 'ph-1', name: 'Kanin', source: 'ph_core', sourceId: 'kanin-white-cooked' }),
    ];
    const full = [
      candidate({ foodId: 'ph-1', name: 'Kanin', source: 'ph_core', sourceId: 'kanin-white-cooked' }),
      candidate({ foodId: 'usda-1', name: 'Rice, white, cooked', source: 'usda_fdc', sourceId: '168878' }),
    ];
    const merged = mergeCandidatesById(local, full);
    expect(merged.map((row) => row.foodId)).toEqual(['ph-1', 'usda-1']);
    expect(remoteOnlyCandidates(local, full).map((row) => row.foodId)).toEqual(['usda-1']);
    expect(candidateDedupeKey(local[0]!)).toBe('ph_core:kanin-white-cooked');
  });
});

describe('search result kcal', () => {
  it('uses the default serving from resolveFood, not per 100g', async () => {
    const results = await resolveFood({ text: 'kanin' }, USER, { catalog: yamlPhCoreCatalog() });
    const top = results[0];
    expect(top).toBeDefined();
    expect(top?.source).toBe('ph_core');
    expect(top?.portion.servingLabel.toLowerCase()).toContain('tasa');
    expect(servingKcal(top!)).toBe(260);
    expect(top!.per100g.kcal).toBe(130);
    expect(top!.portion.kcal).toBeCloseTo((top!.per100g.kcal * top!.portion.grams) / 100, 5);
  });

  it('passes verified through to the candidate', async () => {
    const results = await resolveFood({ text: 'kanin' }, USER, {
      catalog: memoryResolveCatalog({
        foods: [
          {
            ...phCoreToCatalog({
              id: 'kanin-white-cooked',
              name: 'Kanin (white rice, cooked)',
              name_tl: ['kanin'],
              category: 'staple',
              per100g: {
                kcal: 130,
                protein: 2.7,
                carbs: 28.2,
                fat: 0.3,
                fiber: 0.4,
                sugar: 0.1,
                sodium_mg: 1,
              },
              servings: [{ label: '1 tasa', grams: 200, is_default: true }],
              typical_prep: 'Plain steamed',
              source_note: 'USDA',
              confidence: 0.8,
              verified: true,
            }),
          },
        ],
      }),
    });
    expect(results[0]?.verified).toBe(true);
    expect(showsVerifiedCheck(results[0]!)).toBe(true);
  });
});

describe('recent and frequent lists', () => {
  const now = Date.parse('2026-08-17T00:00:00.000Z');
  const entries = [
    history({ foodId: 'rice', name: 'Kanin', loggedAtMs: now - 86_400_000 }),
    history({ foodId: 'egg', name: 'Itlog', loggedAtMs: now - 3_600_000 }),
    history({ foodId: 'rice', name: 'Kanin', loggedAtMs: now - 1_800_000 }),
    history({ foodId: 'egg', name: 'Itlog', loggedAtMs: now - 7_200_000 }),
    history({ foodId: 'egg', name: 'Itlog', loggedAtMs: now - 10_800_000 }),
    history({ foodId: 'adobo', name: 'Adobo', loggedAtMs: now - 172_800_000 }),
  ];

  it('recent is unique foods by last log time', () => {
    expect(recentLoggedFoods(entries).map((row) => row.foodId)).toEqual(['rice', 'egg', 'adobo']);
  });

  it('frequent ranks by log count then recency', () => {
    expect(frequentLoggedFoods(entries).map((row) => row.foodId)).toEqual(['egg', 'rice', 'adobo']);
  });
});

describe('persistableFoodId', () => {
  it('keeps canonical UUIDs and drops resolver placeholders', () => {
    expect(persistableFoodId('3b241101-e2bb-4255-8caf-4136c566a964')).toBe(
      '3b241101-e2bb-4255-8caf-4136c566a964',
    );
    expect(persistableFoodId('ext:llm:kanin')).toBeNull();
    expect(persistableFoodId('kanin-white-cooked')).toBeNull();
  });
});

describe('client-safe search-ui barrel', () => {
  it('does not import yaml, fs, or the PH core file loader', () => {
    const src = readFileSync(new URL('./search-ui.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch('catalog-yaml');
    expect(src).not.toMatch('ph-core/io');
    expect(src).not.toMatch('node:fs');
    expect(src).not.toMatch("from 'yaml'");
    expect(src).not.toMatch('loadPhCoreYaml');
  });

  it('keeps yaml out of the browser catalog module', () => {
    const src = readFileSync(new URL('./catalog.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch('ph-core/io');
    expect(src).not.toMatch('loadPhCoreYaml');
    expect(src).not.toMatch('yamlPhCoreCatalog');
  });
});
