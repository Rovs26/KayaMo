'use client';

import { CompleteAuthSession } from '@kayamo/features';

/** PKCE landing for the Capacitor WebView (no auth/callback route handler). */
export default function AuthCompletePage() {
  return <CompleteAuthSession afterAuthPath="/app" />;
}
