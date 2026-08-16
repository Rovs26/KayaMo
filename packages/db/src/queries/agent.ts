import type { AgentRun } from '../database';
import type { DbClient } from './client';
import { DbQueryError, throwIfError } from './errors';
import { clampUpdatedAtIso } from './lww';

export async function listAgentRuns(client: DbClient, userId: string): Promise<AgentRun[]> {
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
