'use client';

import { createBrowserSupabase } from '@kayamo/db';
import { useEffect } from 'react';

/** PKCE landing when the shell has no /auth/callback route handler. */
export function CompleteAuthSession({ afterAuthPath }: { afterAuthPath: string }) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) {
      window.location.replace('/login?error=Could%20not%20complete%20sign-in');
      return;
    }
    const supabase = createBrowserSupabase();
    void supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      window.location.replace(error ? '/login?error=Could%20not%20complete%20sign-in' : afterAuthPath);
    });
  }, [afterAuthPath]);

  return (
    <main className="px-4 pt-8">
      <p>Signing in…</p>
    </main>
  );
}
