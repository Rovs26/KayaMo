import {
  cocoActionNameSchema,
  cocoToolCallSchema,
  type CocoActionName,
  type CocoToolCall,
} from './contracts';

export type CocoToolAuthorization =
  | { allowed: true; call: CocoToolCall }
  | { allowed: false; reason: 'invalid_call' | 'permission_denied' | 'action_denied' };

/** Authorizes a tool request but never executes it or mutates application data. */
export function authorizeCocoToolCall(
  value: unknown,
  permissions: { memory: boolean; allowedActions: CocoActionName[] },
): CocoToolAuthorization {
  const parsed = cocoToolCallSchema.safeParse(value);
  if (!parsed.success) return { allowed: false, reason: 'invalid_call' };
  if (parsed.data.name === 'read_memory' && !permissions.memory) {
    return { allowed: false, reason: 'permission_denied' };
  }
  if (parsed.data.name === 'propose_action') {
    const action = cocoActionNameSchema.safeParse(parsed.data.arguments.action);
    if (!action.success || !permissions.allowedActions.includes(action.data)) {
      return { allowed: false, reason: 'action_denied' };
    }
  }
  return { allowed: true, call: parsed.data };
}
