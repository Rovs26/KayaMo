import { describe, expect, it } from 'vitest';
import { authorizeCocoToolCall } from './tools';

describe('authorizeCocoToolCall', () => {
  it('denies memory reads without memory permission', () => {
    expect(
      authorizeCocoToolCall(
        { callId: '1', name: 'read_memory', arguments: {} },
        { memory: false, allowedActions: [] },
      ),
    ).toEqual({ allowed: false, reason: 'permission_denied' });
  });

  it('denies actions outside the server allow-list', () => {
    expect(
      authorizeCocoToolCall(
        {
          callId: '1',
          name: 'propose_action',
          arguments: { action: 'remember_this' },
        },
        { memory: true, allowedActions: ['create_task'] },
      ),
    ).toEqual({ allowed: false, reason: 'action_denied' });
  });

  it('allows a read-only daily context call', () => {
    expect(
      authorizeCocoToolCall(
        { callId: '1', name: 'read_daily_context', arguments: {} },
        { memory: false, allowedActions: [] },
      ).allowed,
    ).toBe(true);
  });
});
