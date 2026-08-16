import { normalizeName } from './normalize';

function trigrams(value: string): Set<string> {
  const padded = `  ${value} `;
  const grams = new Set<string>();
  for (let i = 0; i < padded.length - 2; i += 1) {
    grams.add(padded.slice(i, i + 3));
  }
  return grams;
}

/** Dice coefficient over character trigrams, same idea as pg_trgm. */
export function trigramSimilarity(a: string, b: string): number {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const A = trigrams(left);
  const B = trigrams(right);
  if (A.size === 0 || B.size === 0) return 0;
  let overlap = 0;
  for (const gram of A) {
    if (B.has(gram)) overlap += 1;
  }
  return (2 * overlap) / (A.size + B.size);
}

export const MATCH_FLOOR = 0.35;

/**
 * How well `query` matches a name or alias.
 * 1.00 exact, ~0.97 token/alias hit, then trigram. Below MATCH_FLOOR → 0.
 */
export function aliasMatchScore(query: string, candidate: string): number {
  const q = normalizeName(query);
  const n = normalizeName(candidate);
  if (!q || !n) return 0;
  if (q === n) return 1;
  const qTokens = q.split(' ').filter(Boolean);
  const nTokens = n.split(' ').filter((token) => token.length >= 2);
  if (qTokens.length === 1) {
    const only = qTokens[0] ?? '';
    if (nTokens.includes(only)) return 0.97;
    const tokenBest = nTokens.reduce((best, token) => Math.max(best, trigramSimilarity(only, token)), 0);
    const full = trigramSimilarity(q, n);
    const score = Math.max(full, tokenBest);
    return score >= MATCH_FLOOR ? score : 0;
  }
  const covered = qTokens.filter((token) =>
    nTokens.some((word) => word === token || trigramSimilarity(token, word) >= 0.8),
  ).length;
  const coverage = covered / qTokens.length;
  const full = trigramSimilarity(q, n);
  if (coverage < 0.5 && full < 0.55) return 0;
  const score = 0.7 * coverage + 0.3 * full;
  return score >= MATCH_FLOOR ? score : 0;
}

export function bestAliasMatch(
  query: string,
  names: string[],
): { alias: string; matchScore: number } | null {
  let best: { alias: string; matchScore: number } | null = null;
  for (const name of names) {
    const matchScore = aliasMatchScore(query, name);
    if (matchScore <= 0) continue;
    if (!best || matchScore > best.matchScore) best = { alias: name, matchScore };
  }
  return best;
}

export function describeMatch(query: string, alias: string, score: number): string {
  if (score >= 1) return `exact alias "${alias}"`;
  if (score >= 0.97) return `alias "${alias}"`;
  return `similar to "${alias}" (${score.toFixed(2)})`;
}
