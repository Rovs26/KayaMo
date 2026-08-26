import { describe, expect, it } from 'vitest';
import { cocoModelOutputSchema } from './contracts';

describe('coco model output contracts', () => {
  it('coerces a datetime scheduledFor into a calendar date and dueAt', () => {
    const parsed = cocoModelOutputSchema.safeParse({
      message: 'Want a reminder for the gym later?',
      tone: 'balanced',
      proposals: [
        {
          proposalId: 'proposal-gym-10pm',
          action: 'create_task',
          summary: 'Create a task for a gym session at 10:00 pm today.',
          requiresConfirmation: true,
          arguments: {
            title: 'Go to the gym',
            notes: null,
            scheduledFor: '2026-08-26T22:00:00+08:00',
            dueAt: null,
          },
        },
      ],
      citations: [],
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const proposal = parsed.data.proposals[0];
    expect(proposal?.action).toBe('create_task');
    if (proposal?.action !== 'create_task') return;
    expect(proposal.arguments.scheduledFor).toBe('2026-08-26');
    expect(proposal.arguments.dueAt).toBe('2026-08-26T22:00:00+08:00');
  });
});
