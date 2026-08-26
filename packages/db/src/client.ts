import {
  createBrowserClient,
  createServerClient,
  type CookieMethodsServer,
} from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database';
import { getPublicSupabaseEnv } from './env';

export type { CookieMethodsServer };

export function createBrowserSupabase() {
  const { url, anonKey } = getPublicSupabaseEnv();
  return createBrowserClient(url, anonKey);
}

export function createCookieSupabase(cookies: CookieMethodsServer) {
  const { url, anonKey } = getPublicSupabaseEnv();
  return createServerClient(url, anonKey, { cookies });
}

/** Capacitor WebView → hosted API. Cookies stay on https://localhost. */
export function createBearerSupabase(accessToken: string) {
  const { url, anonKey } = getPublicSupabaseEnv();
  return createClient<Database>(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
