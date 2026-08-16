import { describe, expect, it } from 'vitest';
import { aliasMatchScore, trigramSimilarity } from './trigram';

describe('trigram similarity', () => {
  it('is 1 for identical names', () => {
    expect(trigramSimilarity('kanin', 'kanin')).toBe(1);
  });

  it('scores a close misspelling above the match floor', () => {
    expect(aliasMatchScore('kannin', 'kanin')).toBeGreaterThan(0.35);
  });

  it('treats an alias token inside a longer name as a strong hit', () => {
    expect(aliasMatchScore('kanin', 'Kanin (white rice, cooked)')).toBeGreaterThanOrEqual(0.97);
  });
});
