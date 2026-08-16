# @kayamo/db

Drizzle schema, SQL migrations, RLS, and typed query helpers. The single source of truth for data shape.

**Built in:** Chapter 4

**Owns:**
- `src/schema/` — tables, checks, indexes
- `src/queries/` — typed read/write helpers (filter tombstones; LWW on `updated_at`)
- `supabase/migrations/` — SQL including triggers and RLS
- `client.ts` — browser (anon) and cookie (user JWT, RLS) clients
- `service.ts` — service-role client, never imported from `"use client"` files

**Rules:** `food_entries` stores a nutrient snapshot, never a join. `updated_at` is last-write-wins; `server_updated_at` is the sync cursor only. Hard DELETE is revoked on tombstoned tables.

This package is consumed by `apps/*`. It must never import from an app.
