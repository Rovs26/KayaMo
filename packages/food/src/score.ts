export type ResolveSource = 'user' | 'ph_core' | 'usda_fdc' | 'off' | 'llm';

/**
 * rankScore = sourcePriority × matchScore × affinityBoost, clamped to [0, 1]
 *
 * sourcePriority
 *   user (My Foods)     1.00
 *   ph_core             0.95
 *   off + barcode hit   0.90
 *   local cache         0.82   (usda_fdc / off already in our DB, text query)
 *   usda_fdc (network)  0.78
 *   off (network text)  0.72
 *   llm                 0.40   (confidence also hard-capped at 0.50)
 *
 * matchScore — see aliasMatchScore(); exact alias = 1, misspellings via trigram.
 *
 * affinityBoost = 1 + 0.20 × ln(1 + timesLogged) / ln(21)
 *   never logged → 1.00; 20+ logs → 1.20 max.
 *
 * Ties: higher rankScore, then matchScore, then sourcePriority, then
 * timesLogged, then name A–Z.
 *
 * Auto-pick / skip network when top rankScore ≥ 0.85 and
 * (no runner-up or top ≥ 2 × runner-up).
 */
export const SOURCE_PRIORITY: Record<ResolveSource | 'cache' | 'off_barcode', number> = {
  user: 1,
  ph_core: 0.95,
  off_barcode: 0.9,
  cache: 0.82,
  usda_fdc: 0.78,
  off: 0.72,
  llm: 0.4,
};

export const LLM_CONFIDENCE_CAP = 0.5;
export const AUTO_PICK_MIN = 0.85;
export const AUTO_PICK_RATIO = 2;
export const AFFINITY_MAX_BONUS = 0.2;

export function affinityBoost(timesLogged: number): number {
  const n = Math.max(0, timesLogged);
  if (n <= 0) return 1;
  return 1 + AFFINITY_MAX_BONUS * Math.min(1, Math.log(1 + n) / Math.log(21));
}

export function sourcePriorityFor(
  source: ResolveSource,
  opts: { fromCache?: boolean; barcode?: boolean; isMyFood?: boolean } = {},
): number {
  if (source === 'llm') return SOURCE_PRIORITY.llm;
  if (source === 'user') return opts.isMyFood === false ? SOURCE_PRIORITY.cache : SOURCE_PRIORITY.user;
  if (source === 'ph_core') return SOURCE_PRIORITY.ph_core;
  if (source === 'off' && opts.barcode) return SOURCE_PRIORITY.off_barcode;
  if (opts.fromCache && (source === 'usda_fdc' || source === 'off')) return SOURCE_PRIORITY.cache;
  if (source === 'usda_fdc') return SOURCE_PRIORITY.usda_fdc;
  return SOURCE_PRIORITY.off;
}

export function rankScore(input: {
  source: ResolveSource;
  matchScore: number;
  timesLogged: number;
  fromCache?: boolean;
  barcode?: boolean;
  isMyFood?: boolean;
}): number {
  const priority = sourcePriorityFor(input.source, {
    fromCache: input.fromCache,
    barcode: input.barcode,
    isMyFood: input.isMyFood,
  });
  const score = priority * input.matchScore * affinityBoost(input.timesLogged);
  return Math.min(1, Math.max(0, score));
}

export type ScoredCandidate = {
  rankScore: number;
  matchScore: number;
  sourcePriority: number;
  timesLogged: number;
  name: string;
};

export function compareScored(a: ScoredCandidate, b: ScoredCandidate): number {
  if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
  if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
  if (b.sourcePriority !== a.sourcePriority) return b.sourcePriority - a.sourcePriority;
  if (b.timesLogged !== a.timesLogged) return b.timesLogged - a.timesLogged;
  return a.name.localeCompare(b.name);
}

export function shouldAutoPick(candidates: Array<{ rankScore: number }>): boolean {
  const top = candidates[0];
  if (!top || top.rankScore < AUTO_PICK_MIN) return false;
  const runner = candidates[1];
  if (!runner) return true;
  return top.rankScore >= AUTO_PICK_RATIO * runner.rankScore;
}
