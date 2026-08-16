import { loadRootEnv } from './src/load-root-env';
import { defineConfig } from 'drizzle-kit';

loadRootEnv();

export default defineConfig({
  schema: './src/schema/index.ts',
  out: '../../supabase/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  },
});
