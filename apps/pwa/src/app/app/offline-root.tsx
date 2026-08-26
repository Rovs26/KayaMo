'use client';

import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import { configureApiClient } from '@kayamo/features';
import { startSync } from '@kayamo/offline';
import { listenAppUrlOpen, setNativeChrome } from '@kayamo/mobile/native';
import { type ReactNode, useEffect } from 'react';
import { PwaRuntime } from './pwa-runtime';

function pathFromAppUrl(raw: string): { path: string; code: string | null } | null {
  try {
    const url = new URL(raw);
    const code = url.searchParams.get('code');
    const hostPath = url.pathname || '/';
    const path = url.protocol === 'kayamo:' ? `/${url.host}${hostPath}`.replace(/\/+/g, '/') : hostPath;
    return { path: `${path}${url.search}`, code };
  } catch {
    return null;
  }
}

export function OfflineRoot({ children }: { children: ReactNode }) {
  useEffect(() => {
    const client = createBrowserSupabaseClient();
    configureApiClient({
      getAccessToken: async () => {
        const { data } = await client.auth.getSession();
        return data.session?.access_token ?? null;
      },
    });
    void setNativeChrome();
    const stopListen = listenAppUrlOpen((raw) => {
      const parsed = pathFromAppUrl(raw);
      if (!parsed) return;
      if (parsed.code) {
        void client.auth.exchangeCodeForSession(parsed.code).then(({ error }) => {
          window.location.replace(error ? '/login?error=Could%20not%20complete%20sign-in' : '/app');
        });
        return;
      }
      const next = parsed.path.startsWith('/') ? parsed.path : `/${parsed.path}`;
      if (next.startsWith('/app') || next.startsWith('/login')) {
        window.location.replace(next);
      }
    });
    const stopSync = startSync({ getClient: () => client });
    return () => {
      stopListen();
      stopSync();
    };
  }, []);

  return <PwaRuntime>{children}</PwaRuntime>;
}
