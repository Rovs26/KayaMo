import type { RateLimiter } from './limiter';
import { FoodSourceError } from '../types';

export type FoodFetcher = (input: string, init?: RequestInit) => Promise<Response>;

export type SourceHttpDeps = {
  fetch?: FoodFetcher;
  limiter?: RateLimiter;
};

export async function requestJson<T>(
  url: string,
  init: RequestInit,
  deps: SourceHttpDeps,
): Promise<{ ok: true; status: number; data: T } | { ok: false; status: number }> {
  deps.limiter?.acquire();
  const fetchFn = deps.fetch ?? globalThis.fetch;
  const response = await fetchFn(url, init);
  if (!response.ok) {
    return { ok: false, status: response.status };
  }
  try {
    const data = (await response.json()) as T;
    return { ok: true, status: response.status, data };
  } catch {
    throw new FoodSourceError('Food source returned invalid JSON', response.status);
  }
}
