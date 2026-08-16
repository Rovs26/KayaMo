'use client';

import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import { startSync } from '@kayamo/offline';
import { type ReactNode, useEffect } from 'react';

export function OfflineRoot({ children }: { children: ReactNode }) {
  useEffect(() => {
    const client = createBrowserSupabaseClient();
    return startSync({ getClient: () => client });
  }, []);

  return children;
}
