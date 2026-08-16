import {
  createBrowserClient,
  createServerClient,
  type CookieMethodsServer,
} from '@supabase/ssr';
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
