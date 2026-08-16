'use client';

import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function SetSessionPage() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (!accessToken || !refreshToken) {
      router.replace('/login?error=Could%20not%20complete%20sign-in');
      return;
    }

    const supabase = createBrowserSupabaseClient();
    void supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          router.replace('/login?error=Could%20not%20complete%20sign-in');
          return;
        }
        window.location.replace('/app');
      });
  }, [router]);

  return (
    <main className="px-4 pt-8">
      <p className="font-body text-body text-muted">Signing in…</p>
    </main>
  );
}
