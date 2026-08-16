/**
 * Drizzle + postgres.js. Node-only. Do not re-export from the public
 * `@kayamo/db` barrel — that package is imported by client components.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export function createDrizzle(url: string) {
  const client = postgres(url, { max: 1, prepare: false });
  return { db: drizzle(client, { schema }), client };
}

export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('Missing DATABASE_URL. Copy .env.example to .env.local.');
  }
  return url;
}
