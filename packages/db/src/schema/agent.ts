import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, serverUpdatedAt, updatedAt } from './columns';
import { vector1536 } from './types';

export const agentRuns = pgTable(
  'agent_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull(),
    agent: text('agent').notNull(),
    trigger: text('trigger').notNull(),
    input: jsonb('input').$type<Record<string, unknown>>().notNull(),
    output: jsonb('output').$type<Record<string, unknown>>().notNull(),
    model: text('model').notNull(),
    tokens: integer('tokens').notNull().default(0),
    cost_usd: numeric('cost_usd', { precision: 12, scale: 6 }).notNull().default('0'),
    latency_ms: integer('latency_ms'),
    scrubbed_at: timestamp('scrubbed_at', { withTimezone: true, mode: 'string' }),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
  },
  (table) => [
    index('agent_runs_user_created_at_idx').on(table.user_id, table.created_at.desc()),
    check('agent_runs_tokens_nonneg', sql`${table.tokens} >= 0`),
  ],
);

export const agentMemory = pgTable(
  'agent_memory',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull(),
    kind: text('kind').notNull(),
    content: text('content').notNull(),
    embedding: vector1536('embedding'),
    embedding_model: text('embedding_model').notNull(),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
  },
  (table) => [index('agent_memory_user_kind_idx').on(table.user_id, table.kind)],
);
