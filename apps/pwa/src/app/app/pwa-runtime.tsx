'use client';

import { useEffect, type ReactNode } from 'react';

export function PwaRuntime({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Capacitor serves the bundle from the APK. A service worker here would
    // fight native cache and is not needed — Dexie is the offline store.
    const capacitor = (
      window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }
    ).Capacitor;
    if (capacitor?.isNativePlatform?.()) return;

    // iOS has no Background Sync. Queue drain is on visibilitychange + focus
    // inside startSync — registering a SW does not replace that.
    // Web Push only arrives after the PWA is installed to the home screen.
    if (!('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.register('/sw.js', {
      scope: '/', updateViaCache: 'none',
    }).catch(() => {
      // Unsupported or blocked service workers degrade to the online app.
    });
  }, []);
  return children;
}
