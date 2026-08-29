import { sql } from 'drizzle-orm';
import { bigint, timestamp } from 'drizzle-orm/pg-core';

const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: 'string' });

export const createdAt = timestamptz('created_at').notNull().defaultNow();

/** Client clock. Last-write-wins field. Never maintained by a now() trigger. */
export const updatedAt = timestamptz('updated_at').notNull();

/**
 * Server clock. Sync cursor only. Trigger-maintained; not client-writable
 * and never used for conflict resolution.
 */
export const serverUpdatedAt = timestamptz('server_updated_at').notNull().defaultNow();

/** Authoritative commit-ordered sync cursor. Trigger-maintained and bounded to JS safe integers. */
export const serverSeq = bigint('server_seq', { mode: 'number' }).notNull().default(0);

/** Shared catalog rows are not in a user feed and therefore have no sequence. */
export const nullableServerSeq = bigint('server_seq', { mode: 'number' });

export const deletedAt = timestamptz('deleted_at');

export const emptyTextArray = sql`'{}'::text[]`;
