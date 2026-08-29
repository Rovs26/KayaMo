import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, deletedAt, serverSeq, serverUpdatedAt, updatedAt } from './columns';
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
    request_id: text('request_id'),
    status: text('status'),
    error_code: text('error_code'),
    logical_date: date('logical_date', { mode: 'string' }),
    scrubbed_at: timestamp('scrubbed_at', { withTimezone: true, mode: 'string' }),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
  },
  (table) => [
    index('agent_runs_user_created_at_idx').on(table.user_id, table.created_at.desc()),
    index('agent_runs_user_request_id_idx').on(table.user_id, table.request_id),
    index('agent_runs_user_logical_date_idx').on(table.user_id, table.logical_date),
    check('agent_runs_tokens_nonneg', sql`${table.tokens} >= 0`),
    check(
      'agent_runs_content_free_check',
      sql`${table.input} = '{}'::jsonb and ${table.output} = '{}'::jsonb`,
    ),
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
    embedding_model: text('embedding_model').notNull().default('none'),
    explicit: boolean('explicit').notNull().default(true),
    created_at: createdAt,
    updated_at: updatedAt,
    server_updated_at: serverUpdatedAt,
    server_seq: serverSeq,
    deleted_at: deletedAt,
  },
  (table) => [
    index('agent_memory_user_kind_idx').on(table.user_id, table.kind),
    index('agent_memory_server_updated_at_idx').on(table.server_updated_at),
    uniqueIndex('agent_memory_owner_server_seq_uidx').on(table.user_id, table.server_seq),
    check(
      'agent_memory_explicit_check',
      sql`${table.explicit} = true or ${table.deleted_at} is not null`,
    ),
  ],
);
