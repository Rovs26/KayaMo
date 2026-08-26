/**
 * Hosted PWA calls same-origin `/api`. The Capacitor WebView has no Next
 * server — bake NEXT_PUBLIC_API_ORIGIN at `pnpm mobile:sync` so search, OCR,
 * and Mus still hit the hosted app (where the provider key lives).
 * Unset origin keeps relative URLs for `pnpm dev:pwa`.
 *
 * Token lookup is injected so this package never imports a Next supabase client.
 */
export type ApiClientConfig = {
  origin?: string;
  getAccessToken: () => Promise<string | null>;
};

const state: ApiClientConfig = {
  origin: process.env.NEXT_PUBLIC_API_ORIGIN,
  getAccessToken: async () => null,
};

export function configureApiClient(config: Partial<ApiClientConfig>): void {
  if (config.origin !== undefined) state.origin = config.origin;
  if (config.getAccessToken) state.getAccessToken = config.getAccessToken;
}

export function apiUrl(path: string, origin = state.origin): string {
  const base = origin?.replace(/\/$/, '') ?? '';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Sends the Supabase access token so hosted API routes work without cookies. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has('Authorization')) {
    const token = await state.getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(apiUrl(path), { ...init, headers });
}
