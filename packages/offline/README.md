# @kayamo/offline

Dexie schema, optimistic writes, and the sync queue. Every user-facing mutation goes through here.

**Built in:** Chapter 5

**Owns:**
- `db.ts` — IndexedDB mirror of food_entries, weight_logs, workouts, workout_sets, foods, servings, sync_queue
- `sync.ts` — queue drain, last-write-wins, exponential backoff; 401 pauses (does not drop)
- `writes.ts` — Dexie first, then enqueue (idempotency key = `table:entityId`)
- `hooks.ts` — React bindings for sync status and live entries

Sync also runs on `online`, `visibilitychange`, and `focus`. iOS Safari does not support Background Sync.

This package is consumed by `apps/*`. It must never import from an app.
