import { sql } from 'drizzle-orm';
import { timestamp } from 'drizzle-orm/pg-core';

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'string' });

export const createdAt = timestamptz('created_at').notNull().defaultNow();

/** Client clock. Last-write-wins field. Never maintained by a now() trigger. */
export const updatedAt = timestamptz('updated_at').notNull();

/**
 * Server clock. Sync cursor only. Trigger-maintained; not client-writable
 * and never used for conflict resolution.
 */
export const serverUpdatedAt = timestamptz('server_updated_at').notNull().defaultNow();

export const deletedAt = timestamptz('deleted_at');

export const emptyTextArray = sql`'{}'::text[]`;
