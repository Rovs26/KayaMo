# @kayamo/offline

Dexie schema, optimistic writes, and the sync queue. Every user-facing mutation goes through here.

**Built in:** Chapter 5

**Owns:**
- `db.ts` — IndexedDB mirror
- `sync.ts` — queue drain, backoff, idempotency
- `hooks.ts` — React bindings

**Rule:** this package is consumed by `apps/*`. It must never import from an app.
