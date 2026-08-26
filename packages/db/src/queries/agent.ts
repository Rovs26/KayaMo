import type { AgentRun } from '../database';
import type { DbClient } from './client';
import { DbQueryError, throwIfError } from './errors';
import { clampUpdatedAtIso } from './lww';

export type AgentRunTelemetryWrite = {
  id: string;
  userId: string;
  requestId: string;
  trigger: string;
  logicalDate: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  outcome: 'model' | 'fallback' | 'safety' | 'budget';
  errorCode: string;
  updatedAt: string;
  agent?: string;
};

/** Stores operational metadata only. Prompt, response, health, and journal content are excluded. */
export async function insertAgentRunTelemetry(
  client: DbClient,
  event: AgentRunTelemetryWrite,
): Promise<void> {
  const { error } = await client.from('agent_runs').insert({
    id: event.id,
    user_id: event.userId,
    agent: event.agent ?? 'coco',
    trigger: event.trigger,
    input: {},
    output: {},
    model: event.model,
    tokens: event.inputTokens + event.outputTokens,
    cost_usd: String(Math.max(0, event.costUsd)),
    latency_ms: Math.max(0, Math.round(event.latencyMs)),
    request_id: event.requestId,
    status: event.outcome,
    error_code: event.errorCode,
    logical_date: event.logicalDate,
    updated_at: clampUpdatedAtIso(event.updatedAt),
  });
  throwIfError(error);
}

export async function getAgentSpendUsd(
  client: DbClient,
  params: { userId: string; logicalDate: string },
): Promise<number> {
  const { data, error } = await client
    .from('agent_runs')
    .select('cost_usd')
    .eq('user_id', params.userId)
    .eq('logical_date', params.logicalDate);
  throwIfError(error);
  return (data ?? []).reduce((total, row) => total + Number(row.cost_usd), 0);
}

export async function listAgentRuns(
  client: DbClient,
  userId: string,
): Promise<AgentRun[]> {
  const { data, error } = await client
    .from('agent_runs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  throwIfError(error);
  return data ?? [];
}

export async function markAgentRunScrubbed(
  client: DbClient,
  params: { id: string; userId: string; updatedAt: string },
): Promise<void> {
  const { data, error } = await client
    .from('agent_runs')
    .update({
      scrubbed_at: new Date().toISOString(),
      updated_at: clampUpdatedAtIso(params.updatedAt),
    })
    .eq('id', params.id)
    .eq('user_id', params.userId)
    .select('id');
  throwIfError(error);
  if (!data?.length) {
    throw new DbQueryError('markAgentRunScrubbed matched no row');
  }
}
