'use client';

import { createBrowserSupabase } from '@kayamo/db';
import { useEffect } from 'react';

export function SetAuthSession({ afterAuthPath }: { afterAuthPath: string }) {
  useEffect(() => {
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (!accessToken || !refreshToken) {
      window.location.replace('/login?error=Could%20not%20complete%20sign-in');
      return;
    }

    const supabase = createBrowserSupabase();
    void supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        window.location.replace(error ? '/login?error=Could%20not%20complete%20sign-in' : afterAuthPath);
      });
  }, [afterAuthPath]);

  return (
    <main className="px-4 pt-8">
      <p>Signing in…</p>
    </main>
  );
}
