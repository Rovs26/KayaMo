# @kayamo/db

Drizzle schema, migrations, RLS policies, and typed query helpers. The single source of truth for data shape.

**Built in:** Chapter 4

**Owns:**
- `schema.ts` — all tables
- `queries/` — typed read/write helpers
- `rls/` — row-level security policies
- `client.ts` — browser (anon) and server (service-role) clients

**Rule:** this package is consumed by `apps/*`. It must never import from an app.
