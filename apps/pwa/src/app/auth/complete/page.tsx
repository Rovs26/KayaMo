'use client';

import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** PKCE landing for the Capacitor WebView (no auth/callback route handler). */
export default function AuthCompletePage() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) {
      router.replace('/login?error=Could%20not%20complete%20sign-in');
      return;
    }
    const supabase = createBrowserSupabaseClient();
    void supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      router.replace(error ? '/login?error=Could%20not%20complete%20sign-in' : '/app');
    });
  }, [router]);

  return (
    <main className="px-4 pt-8">
      <p className="font-body text-body text-muted">Signing in…</p>
    </main>
  );
}
