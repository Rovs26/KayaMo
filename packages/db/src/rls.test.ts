import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from './database';
import { isDbTestConfigured } from './env';
import {
  insertFoodEntry,
  listFoodEntriesByLogicalDate,
  tombstoneFoodEntry,
  upsertFoodEntry,
} from './queries/food-entries';

const configured = isDbTestConfigured();

type Authed = {
  id: string;
  email: string;
  client: SupabaseClient<Database>;
};

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('Missing Supabase env for RLS tests.');
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

describe.skipIf(!configured)('RLS and tombstones', () => {
  const runId = randomUUID();
  const password = `${randomUUID()}Aa1!`;
  let service: ReturnType<typeof createServiceClient>;
  let userA: Authed;
  let userB: Authed;
  let anon: SupabaseClient<Database>;
  let foodId: string;

  beforeAll(async () => {
    service = createServiceClient();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
    anon = createClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    userA = await createAuthedUser(service, url, anonKey, `ch04-a-${runId}@kayamo.test`, password);
    userB = await createAuthedUser(service, url, anonKey, `ch04-b-${runId}@kayamo.test`, password);

    foodId = randomUUID();
    const { error } = await service.from('foods').insert({
      id: foodId,
      source: 'ph_core',
      source_id: `rls-${runId}`,
      name: 'RLS fixture food',
      kcal: '100',
      protein_g: '1',
      carbs_g: '1',
      fat_g: '1',
      fiber_g: '0',
      sugar_g: '0',
      sodium_mg: '0',
      confidence: '0.50',
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  });

  afterAll(async () => {
    if (!service) return;
    if (foodId) {
      await service.from('food_entries').delete().eq('food_id', foodId);
      await service.from('foods').delete().eq('id', foodId);
    }
    if (userA) await service.auth.admin.deleteUser(userA.id);
    if (userB) await service.auth.admin.deleteUser(userB.id);
  });

  it('blocks user B from reading user A food_entries', async () => {
    const entryId = randomUUID();
    const loggedAt = '2026-08-16T04:00:00.000Z';
    await insertFoodEntry(userA.client, {
      id: entryId,
      user_id: userA.id,
      logged_at: loggedAt,
      meal_slot: 'tanghalian',
      food_id: foodId,
      quantity: '1',
      grams: '100',
      kcal: '100',
      protein_g: '1',
      carbs_g: '1',
      fat_g: '1',
      fiber_g: '0',
      sugar_g: '0',
      sodium_mg: '0',
      source: 'ph_core',
      confidence: '0.50',
      input_method: 'search',
      food_name_snapshot: 'RLS fixture food',
      serving_label_snapshot: '100 g',
      resolved_via: 'ph_core',
      updated_at: loggedAt,
    });

    const asOwner = await listFoodEntriesByLogicalDate(userA.client, {
      userId: userA.id,
      logicalDate: '2026-08-16',
    });
    expect(asOwner.some((row) => row.id === entryId)).toBe(true);

    const asOther = await listFoodEntriesByLogicalDate(userB.client, {
      userId: userA.id,
      logicalDate: '2026-08-16',
    });
    expect(asOther).toEqual([]);

    const { data: byId } = await userB.client.from('food_entries').select('id').eq('id', entryId);
    expect(byId ?? []).toEqual([]);
  });

  it('does not let anon select foods', async () => {
    const { data, error } = await anon.from('foods').select('id').eq('id', foodId);
    expect(data === null || data.length === 0).toBe(true);
    expect(error).toBeTruthy();
  });

  it('keeps a tombstoned food_entry deleted after a stale sync upsert', async () => {
    const entryId = randomUUID();
    const t1 = '2026-08-16T05:00:00.000Z';
    const t2 = '2026-08-16T06:00:00.000Z';
    const live = {
      id: entryId,
      user_id: userA.id,
      logged_at: t1,
      meal_slot: 'hapunan' as const,
      food_id: foodId,
      quantity: '1',
      grams: '100',
      kcal: '100',
      protein_g: '1',
      carbs_g: '1',
      fat_g: '1',
      fiber_g: '0',
      sugar_g: '0',
      sodium_mg: '0',
      source: 'ph_core' as const,
      confidence: '0.50',
      input_method: 'search' as const,
      food_name_snapshot: 'RLS fixture food',
      serving_label_snapshot: '100 g',
      resolved_via: 'ph_core' as const,
      updated_at: t1,
    };

    await insertFoodEntry(userA.client, live);
    await tombstoneFoodEntry(userA.client, { id: entryId, userId: userA.id, updatedAt: t2 });

    const stale = await upsertFoodEntry(userA.client, live);
    expect(stale.applied).toBe(false);

    const listed = await listFoodEntriesByLogicalDate(userA.client, {
      userId: userA.id,
      logicalDate: '2026-08-16',
    });
    expect(listed.some((row) => row.id === entryId)).toBe(false);

    const { data: raw, error } = await service
      .from('food_entries')
      .select('deleted_at')
      .eq('id', entryId)
      .maybeSingle();
    if (error) throw error;
    expect(raw?.deleted_at).toBeTruthy();
  });
});

async function createAuthedUser(
  service: ReturnType<typeof createServiceClient>,
  url: string,
  anonKey: string,
  email: string,
  password: string,
): Promise<Authed> {
  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw created.error ?? new Error('createUser returned no user');
  }
  const client = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.user) {
    throw signedIn.error ?? new Error('signInWithPassword failed');
  }
  return { id: signedIn.data.user.id, email, client };
}
