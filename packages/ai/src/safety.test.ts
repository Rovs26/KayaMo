import { describe, expect, it } from 'vitest';
import { evaluateCocoSafety } from './safety';

describe('evaluateCocoSafety', () => {
  it.each([
    ['I want to kill myself', 'self_harm', 'urgent'],
    ["I can't breathe and have chest pain", 'medical_emergency', 'urgent'],
    ['My partner hits me and I am scared', 'abuse', 'urgent'],
    ['Help me starve myself this week', 'eating_disorder', 'supportive_redirect'],
  ] as const)('classifies %s', (message, category, level) => {
    const result = evaluateCocoSafety(message);
    expect(result.category).toBe(category);
    expect(result.level).toBe(level);
    expect(result.allowModel).toBe(false);
  });

  it('allows an ordinary planning message', () => {
    expect(evaluateCocoSafety('Help me plan my morning')).toEqual({
      level: 'safe',
      category: 'none',
      allowModel: true,
      showEmergencyPrompt: false,
      message: null,
    });
  });
});
