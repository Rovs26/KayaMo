export class RateLimitError extends Error {
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super(`Rate limit exceeded. Retry in ${Math.ceil(retryAfterMs / 1000)}s.`);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export type RateLimiter = {
  acquire: () => void;
};

export const noopLimiter: RateLimiter = {
  acquire() {
    /* tests and callers that already throttle */
  },
};

/** Sliding window: at most `max` acquires per `windowMs` (default 1000 / hour). */
export class HourlyLimiter implements RateLimiter {
  private hits: number[] = [];

  constructor(
    private readonly opts: {
      max?: number;
      windowMs?: number;
      now?: () => number;
    } = {},
  ) {}

  acquire(): void {
    const now = this.opts.now?.() ?? Date.now();
    const windowMs = this.opts.windowMs ?? 60 * 60 * 1000;
    const max = this.opts.max ?? 1000;
    this.hits = this.hits.filter((t) => now - t < windowMs);
    if (this.hits.length >= max) {
      const oldest = this.hits[0] ?? now;
      throw new RateLimitError(Math.max(1, windowMs - (now - oldest)));
    }
    this.hits.push(now);
  }
}

export const usdaHourlyLimiter = new HourlyLimiter();
export const offHourlyLimiter = new HourlyLimiter();
