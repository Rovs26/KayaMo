/**
 * Hosted PWA calls same-origin `/api`. The Capacitor WebView has no Next
 * server — bake NEXT_PUBLIC_API_ORIGIN at `pnpm mobile:sync` so search, OCR,
 * and Coco still hit the hosted app (where the provider key lives).
 * Unset origin keeps relative URLs for `pnpm dev:pwa`.
 */
export function apiUrl(path: string, origin = process.env.NEXT_PUBLIC_API_ORIGIN): string {
  const base = origin?.replace(/\/$/, '') ?? '';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Sends the Supabase access token so hosted API routes work without cookies. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has('Authorization')) {
    const { createBrowserSupabaseClient } = await import('./supabase/browser');
    const { data } = await createBrowserSupabaseClient().auth.getSession();
    if (data.session?.access_token) {
      headers.set('Authorization', `Bearer ${data.session.access_token}`);
    }
  }
  return fetch(apiUrl(path), { ...init, headers });
}
