# @kayamo/offline

Dexie schema, optimistic writes, and the sync queue. Every user-facing mutation goes through here.

**Built through:** Bundle 6

**Owns:**
- `db.ts` — IndexedDB mirrors plus local-only journals and the sync queue
- `sync.ts` — queue drain, last-write-wins, exponential backoff; 401 pauses (does not drop)
- `writes.ts` — Dexie first, then enqueue (idempotency key = `table:entityId`)
- `hooks.ts` — React bindings for sync status and live entries

Sync also runs on `online`, `visibilitychange`, and `focus`. iOS Safari does not support Background Sync.

Daily plans, focus sessions, and daily-loop preferences sync through the normal
LWW/tombstone queue. Reflection, gratitude, venting, diary, and prayer text never
enters that queue unless a user separately confirms **Remember this**.

This package is consumed by `apps/*`. It must never import from an app.
