import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { Page } from '@playwright/test';

if (typeof globalThis.WebSocket === 'undefined') {
  class TestWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    readonly CONNECTING = 0;
    readonly OPEN = 1;
    readonly CLOSING = 2;
    readonly CLOSED = 3;
    readyState = 3;
    url = '';
    protocol = '';
    onopen: ((this: TestWebSocket, ev: Event) => unknown) | null = null;
    onmessage: ((this: TestWebSocket, ev: MessageEvent) => unknown) | null = null;
    onclose: ((this: TestWebSocket, ev: CloseEvent) => unknown) | null = null;
    onerror: ((this: TestWebSocket, ev: Event) => unknown) | null = null;
    close(): void {}
    send(): void {}
    addEventListener(): void {}
    removeEventListener(): void {}
  }
  globalThis.WebSocket = TestWebSocket as unknown as typeof WebSocket;
}

export function e2eSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function createE2eServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('Missing Supabase env for e2e');
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function signInTestUser(page: Page): Promise<{ id: string; email: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Missing Supabase public env for e2e');
  }

  const service = createE2eServiceClient();
  const email = `ch05-${randomUUID()}@kayamo.test`;
  const password = `${randomUUID()}Aa1!`;
  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw created.error ?? new Error('createUser failed');
  }

  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signedIn = await anon.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) {
    throw signedIn.error ?? new Error('signInWithPassword failed');
  }

  const { access_token, refresh_token } = signedIn.data.session;
  await page.goto(
    `/auth/set-session#access_token=${encodeURIComponent(access_token)}&refresh_token=${encodeURIComponent(refresh_token)}`,
  );
  await page.waitForURL('**/app', { timeout: 30_000 });

  return { id: created.data.user.id, email };
}
