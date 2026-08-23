'use client';

import { useEffect, type ReactNode } from 'react';

export function PwaRuntime({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.register('/sw.js', {
      scope: '/', updateViaCache: 'none',
    }).catch(() => {
      // Unsupported or blocked service workers degrade to the online app.
    });
  }, []);
  return children;
}
