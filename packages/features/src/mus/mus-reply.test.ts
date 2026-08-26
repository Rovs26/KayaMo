import { describe, expect, it } from 'vitest';
import { musReplyFromApi } from './mus-reply';

const response = {
  message: 'Rest first. We can look at 9pm when you are ready.',
  tone: 'balanced' as const,
  proposals: [],
  citations: [],
  safety: {
    level: 'safe' as const,
    category: 'none' as const,
    allowModel: true,
    showEmergencyPrompt: false,
    message: null,
  },
};

describe('musReplyFromApi', () => {
  it('reads message from the router envelope', () => {
    expect(musReplyFromApi({ source: 'model', response })).toEqual({
      message: response.message,
      source: 'model',
    });
  });

  it('does not read message off the envelope root', () => {
    const body = { source: 'model', response };
    expect((body as { message?: string }).message).toBeUndefined();
    expect(musReplyFromApi(body)?.message).toBe(response.message);
  });

  it('returns null when the model text is missing', () => {
    expect(musReplyFromApi({ source: 'model', response: { tone: 'balanced' } })).toBeNull();
    expect(musReplyFromApi({ ok: true })).toBeNull();
  });
});
