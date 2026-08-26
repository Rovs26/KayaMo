'use client';

import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from './app-shell';
import styles from '@kayamo/features/app-shell.module.css';

/**
 * Client session gate so the same /app shell works as a bundled Capacitor
 * WebView (no Next server, no cookies() during static export) and as the PWA.
 */
export default function AppHome() {
  const router = useRouter();
  const [session, setSession] = useState<{ userId: string; email: string } | 'loading' | 'anon'>(
    'loading',
  );

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    void supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        setSession('anon');
        return;
      }
      setSession({ userId: data.user.id, email: data.user.email ?? 'Signed in' });
    });
  }, []);

  useEffect(() => {
    if (session === 'anon') router.replace('/login');
  }, [router, session]);

  if (session === 'loading' || session === 'anon') {
    return (
      <div className={styles.viewport}>
        <div className={styles.shell} />
      </div>
    );
  }

  return <AppShell userId={session.userId} email={session.email} />;
}
