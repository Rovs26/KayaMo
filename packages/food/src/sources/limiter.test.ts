import { describe, expect, it } from 'vitest';
import { HourlyLimiter, RateLimitError } from './limiter';

describe('HourlyLimiter', () => {
  it('allows up to max requests in the window then throws', () => {
    let now = 0;
    const limiter = new HourlyLimiter({ max: 2, windowMs: 1000, now: () => now });
    limiter.acquire();
    limiter.acquire();
    expect(() => limiter.acquire()).toThrow(RateLimitError);
    now = 1000;
    expect(() => limiter.acquire()).not.toThrow();
  });
});
