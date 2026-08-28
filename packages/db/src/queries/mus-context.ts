import type { MusContextPermission } from '../database';
import type { MusContextDomain } from '../schema/mus-context';
import type { DbClient } from './client';
import { DbQueryError, throwIfError } from './errors';

export async function listMusContextPermissions(
  client: DbClient,
  userId: string,
): Promise<MusContextPermission[]> {
  const { data, error } = await client
    .from('mus_context_permissions')
    .select('*')
    .eq('user_id', userId)
    .order('domain', { ascending: true });
  throwIfError(error);
  return data ?? [];
}

export async function setMusContextPermission(
  client: DbClient,
  input: {
    userId: string;
    domain: MusContextDomain;
    allowed: boolean;
    updatedAt: string;
  },
): Promise<MusContextPermission> {
  const { data, error } = await client
    .from('mus_context_permissions')
    .upsert(
      {
        user_id: input.userId,
        domain: input.domain,
        allowed: input.allowed,
        updated_at: input.updatedAt,
      },
      { onConflict: 'user_id,domain' },
    )
    .select('*')
    .single();
  throwIfError(error);
  if (!data) throw new DbQueryError('setMusContextPermission returned no row');
  return data;
}
