'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { isLocalDevLoginEnabled, LOCAL_DEV_EMAIL } from '@/lib/local-dev-login';
import { createServiceSupabase } from '@kayamo/db/service';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

async function originFromHeaders(): Promise<string> {
  const headerStore = await headers();
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host');
  const proto = headerStore.get('x-forwarded-proto') ?? 'http';
  if (!host) return 'http://localhost:3000';
  return `${proto}://${host}`;
}

export async function signInWithEmail(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) {
    redirect('/login?error=Email%20is%20required');
  }

  const supabase = await createServerSupabase();
  const origin = await originFromHeaders();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/app`,
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect('/login?sent=1');
}

export async function signInWithGoogle() {
  const supabase = await createServerSupabase();
  const origin = await originFromHeaders();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback?next=/app`,
    },
  });

  if (error || !data.url) {
    redirect(
      `/login?error=${encodeURIComponent(error?.message ?? 'Google sign-in is not configured')}`,
    );
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect('/login');
}

function redirectLoginError(message: string): never {
  redirect(`/login?error=${encodeURIComponent(message)}`);
}

/** Development only: session as `local@kayamo.test` so OCR and saves still hit RLS. */
export async function signInAsLocalDev() {
  if (!isLocalDevLoginEnabled()) {
    redirectLoginError('Local sign-in is only available while the PWA is in development.');
  }

  let tokenHash: string | undefined;
  let setupFailed = false;

  try {
    const service = createServiceSupabase();
    await service.auth.admin.createUser({
      email: LOCAL_DEV_EMAIL,
      email_confirm: true,
    });
    const generated = await service.auth.admin.generateLink({
      type: 'magiclink',
      email: LOCAL_DEV_EMAIL,
    });
    const hash = generated.data.properties?.hashed_token;
    if (generated.error || !hash) {
      setupFailed = true;
    } else {
      tokenHash = hash;
    }
  } catch {
    setupFailed = true;
  }

  if (setupFailed || !tokenHash) {
    redirectLoginError('Could not start a local session. Check SUPABASE_SERVICE_ROLE_KEY.');
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  });
  if (error) {
    redirectLoginError('Could not complete local sign-in.');
  }

  redirect('/app');
}
