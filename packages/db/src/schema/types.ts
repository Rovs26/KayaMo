import { customType, numeric } from 'drizzle-orm/pg-core';

export const numericAmount = (name: string) => numeric(name, { precision: 12, scale: 4 });

export const nutrient = (name: string) => numericAmount(name).notNull();

export const confidence = (name = 'confidence') =>
  numeric(name, { precision: 3, scale: 2 }).notNull();

/** pgvector column; values are the `[1,2,3]` text form PostgREST returns. */
export const vector1536 = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'extensions.vector(1536)';
  },
});
