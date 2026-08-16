const BASE_MS = 2_000;
const CAP_MS = 15 * 60 * 1000;

/** Exponential backoff for queue retries. Attempt 0 is the first failure. */
export function backoffMs(attempt: number): number {
  const exp = Math.min(Math.max(attempt, 0), 9);
  return Math.min(CAP_MS, BASE_MS * 2 ** exp);
}
