const FUTURE_SKEW_MS = 5 * 60 * 1000;

export function clampUpdatedAt(value: Date, now = new Date()): Date {
  if (value.getTime() > now.getTime() + FUTURE_SKEW_MS) {
    return now;
  }
  return value;
}

export function clampUpdatedAtIso(value: string, now = new Date()): string {
  return clampUpdatedAt(new Date(value), now).toISOString();
}

/** Last-write-wins: incoming applies only when strictly newer than existing. */
export function incomingWins(existingUpdatedAt: string, incomingUpdatedAt: string): boolean {
  return new Date(incomingUpdatedAt).getTime() > new Date(existingUpdatedAt).getTime();
}

export function omitServerCursor<T extends { server_updated_at?: unknown }>(
  row: T,
): Omit<T, 'server_updated_at'> {
  return omitKeys(row, ['server_updated_at']);
}

export function omitKeys<T extends object, K extends keyof T>(row: T, keys: readonly K[]): Omit<T, K> {
  const copy = { ...row };
  for (const key of keys) {
    delete copy[key];
  }
  return copy;
}
