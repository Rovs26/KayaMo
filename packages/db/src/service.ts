/**
 * SERVICE ROLE CLIENT
 *
 * Import ONLY from Route Handlers, Server Actions, and Edge Functions.
 * Never import this module from a file that has `"use client"`.
 * The `server-only` import below will fail the build if it leaks into the browser.
 */
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { getServiceSupabaseEnv } from './env';

export function createServiceSupabase() {
  const { url, serviceRoleKey } = getServiceSupabaseEnv();
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
