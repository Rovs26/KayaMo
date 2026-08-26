import { describe, expect, it } from 'vitest';
import { extractCopyChunks, findBannedCopy } from './banned-copy';

describe('banned-copy scanner', () => {
  it('ignores identifiers and catches quoted UI copy', () => {
    expect(findBannedCopy('const earned = row.id;')).toEqual([]);
    expect(findBannedCopy('earned_at: timestamp()')).toEqual([]);
    expect(findBannedCopy('function earnedAchievementKeys() {}')).toEqual([]);
    expect(findBannedCopy('"Grove points it already earned stay."')).toEqual([
      { id: 'earned', excerpt: 'Grove points it already earned stay.' },
    ]);
  });

  it('reads JSX text nodes', () => {
    const source = '<small>Never a cheat meal.</small>';
    expect(extractCopyChunks(source)).toContain('Never a cheat meal.');
    expect(findBannedCopy(source).map((hit) => hit.id)).toContain('cheat');
  });
});
