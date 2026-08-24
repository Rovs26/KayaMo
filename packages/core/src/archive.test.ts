import { describe, expect, it } from 'vitest';
import {
  buildPersonalArchive,
  chapterCloseReady,
  chapterCloseSummary,
  evidenceBankEntries,
  isMusLite,
  professionalForArea,
  proposeStoryFromGoal,
  renderArchiveMarkdown,
  renderEvidenceMarkdown,
} from './archive';

describe('life story and chapter close', () => {
  it('keeps a released goal in the story without calling it failed', () => {
    const draft = proposeStoryFromGoal({
      id: 'g1',
      title: 'Finish the thesis chapter',
      status: 'released',
      happenedOn: '2026-08-25',
      lifeArea: 'work',
    });
    expect(draft.kind).toBe('goal_released');
    expect(draft.professional).toBe(true);
    expect(draft.summary).toMatch(/set down/i);
    expect(draft.summary).not.toMatch(/fail/i);
    expect(professionalForArea('physical')).toBe(false);
  });

  it('needs at least one honest sentence to close a chapter', () => {
    expect(
      chapterCloseReady({
        changed: '',
        accomplished: '',
        letGo: '',
        learned: '',
        carries: '',
      }),
    ).toBe(false);
    expect(
      chapterCloseSummary({
        changed: 'I sleep before midnight.',
        accomplished: '',
        letGo: 'The extra side project',
        learned: '',
        carries: '',
      }),
    ).toMatch(/what changed/i);
  });
});

describe('archive export', () => {
  it('writes markdown without inventing a résumé or health numbers', () => {
    const archive = buildPersonalArchive({
      exportedAt: '2026-08-25T00:00:00.000Z',
      futureSelf: 'Someone who keeps Sunday rest',
      compass: { mattersNow: 'The thesis', protect: 'Sunday' },
      grove: { totalPoints: 120, stageKey: 'sprout' },
      story: [
        {
          title: 'Shipped the chapter draft',
          summary: 'Reached, after you confirmed it.',
          happenedOn: '2026-08-20',
          kind: 'goal_completed',
          professional: true,
        },
      ],
      goals: [{ title: 'Shipped the chapter draft', status: 'completed', lifeArea: 'work', targetDate: null }],
    });
    const markdown = renderArchiveMarkdown(archive);
    expect(markdown).toMatch(/Sunday rest/);
    expect(markdown).toMatch(/Life Story/);
    expect(markdown).not.toMatch(/kcal/i);
    expect(renderEvidenceMarkdown(evidenceBankEntries(archive.story))).toMatch(/not a generated CV/i);
    expect(isMusLite('simple')).toBe(true);
    expect(isMusLite('balanced')).toBe(false);
  });
});
