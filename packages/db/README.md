# @kayamo/db

Drizzle schema, SQL migrations, RLS, and typed query helpers. The single source of truth for data shape.

**Built in:** Bundles 0–3 backend foundations

**Owns:**

- `src/schema/` — tables, checks, indexes
- `src/queries/` — typed read/write helpers (filter tombstones; LWW on `updated_at`)
- `supabase/migrations/` — SQL including triggers and RLS
- `client.ts` — browser (anon) and cookie (user JWT, RLS) clients
- `service.ts` — service-role client, never imported from `"use client"` files

**Rules:** `food_entries` stores a nutrient snapshot, never a join. `updated_at` is
last-write-wins. `server_updated_at` is diagnostic freshness metadata;
trigger-maintained `server_seq` is the only authoritative sync cursor. Hard DELETE
is revoked on tombstoned tables.

Bundle 1 adds `tasks`, `routines`, and `routine_completions`. They are user-owned,
offline-syncable, and tombstone-only. A task with `origin = 'coco_confirmed'`
represents a proposal the user already accepted; unconfirmed AI proposals must not
be inserted into these tables.

Bundle 2 adds governed Coco conversations and explicit memories. Bundle 3 adds
immutable expenditure revisions and versioned, code-derived nutrition targets.
Target safety floors are enforced both in `@kayamo/core` and by a database trigger;
nutrition guidance stores its source and confidence. Profile timezone changes do
not silently re-bucket history—the user must invoke the explicit recompute flow.

## Local migrations and RLS tests

Start Supabase with `npx supabase start`, then copy its local API URL, anon key,
service-role key, and database URL into the corresponding variables in the root
`.env.local`. Verify a clean migration replay with:

```bash
npx supabase db reset --local
RUN_DB_TESTS=1 pnpm --filter @kayamo/db test
```

The integration suite creates and removes temporary auth users. Use only an
isolated local or disposable test project.

GitHub Actions runs the same suite in a dedicated `database-integration` job. The
job starts a fresh local Supabase stack, resets that disposable database to replay
every checked-in migration, exports only generated local credentials, and runs:

```bash
RUN_DB_TESTS=1 pnpm test:db:integration
```

The command additionally requires `SUPABASE_DB_URL` for the real PostgreSQL
concurrency and catalog assertions. CI obtains it from `supabase status`; local
developers should use the URL from their explicitly disposable Supabase stack.

Migration `0019_sync_sequence.sql` is immutable. Its historical `server_seq`
backfill updates each participating row while the pre-existing touch triggers are
active, so historical `server_updated_at` values are reset during that migration.
This is an accepted diagnostic-metadata side effect: `server_updated_at` is not a
sync or conflict cursor, and no forward migration is warranted solely to restore
those old diagnostic timestamps.

`pnpm db:migrate` is different: Drizzle connects to whatever `DATABASE_URL`
currently names and applies pending migrations there. Treat it as a deployment
command when `DATABASE_URL` is remote; inspect the target and obtain explicit
approval before running it. A local migration reset or passing RLS suite does not
deploy anything.

This package is consumed by `apps/*`. It must never import from an app.
