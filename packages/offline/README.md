# @kayamo/offline

Dexie schema, optimistic writes, and the sync queue. Every user-facing mutation goes through here.

**Built through:** bidirectional sync v1

**Owns:**
- `db.ts` — account-isolated IndexedDB mirrors, durable pull checkpoints, local-only journals, and the sync queue
- `sync-registry.ts` — the explicit server↔device allowlist
- `pull.ts` — paginated `(server_updated_at, stable key)` pulls and atomic merge/checkpoint transactions
- `sync.ts` — push-then-pull orchestration, exponential backoff; 401 pauses (does not drop)
- `writes.ts` — Dexie first, then enqueue (idempotency key = `userId:table:entityId`)
- `hooks.ts` — React bindings for sync status and live entries

Sync also runs on `online`, `visibilitychange`, and `focus`. One cycle runs at a
time and pushes queued local mutations before pulling. iOS Safari does not support
Background Sync.

## v1 domain map

Bidirectional user-owned records are explicitly listed in
`BIDIRECTIONAL_SYNC_REGISTRY`: tasks, routines and completions; goals, milestones,
habits and completions; Future Self, Compass, Life Inbox and Personal Rules; daily
plans, focus sessions and preferences; food entries, meal templates, weight logs,
workouts, sets, user exercises and training plans; explicit Mus memories,
conversations and messages; and immutable companion events.

Server-only/read-through data includes profiles, calorie guidance and expenditure
revisions, canonical foods/servings/exercises, progression definitions and derived
companion state, Scripture, push subscriptions, agent telemetry, and Mus context
permissions. Server storage permission does not grant Mus read permission.

Local-only data includes diary, reflection, gratitude, vent and prayer entries;
rest timers and integration grants/busy blocks; Life Story and chapter archives;
and Circles drafts/preferences. These names are deliberately absent from the sync
registry. Unsupported future domains must be added through an explicit privacy and
ownership review.

## Conflict and deletion contract

`updated_at` is the bounded client last-write-wins field. `server_updated_at` is
used only as the pull cursor. A queued local edit survives an older/equal remote
version; a strictly newer remote version replaces it. Server tombstones are
irreversible and delete wins over live stale state in either direction. Equal
client timestamps do not overwrite local state. Tied server cursor timestamps are
ordered by the table's stable primary key, so pagination cannot skip a row.

Every page is validated for ownership and structural cursor fields, then its rows
and table/user checkpoint are written in one Dexie transaction. A crash or cursor
write failure rolls back both. Each authenticated account uses its own IndexedDB;
sign-out switches to an empty signed-out store without deleting another account's
offline queue or private local data.

Daily plans, focus sessions, and daily-loop preferences sync through the normal
LWW/tombstone queue. Reflection, gratitude, venting, diary, and prayer text never
enters that queue unless a user separately confirms **Remember this**.

This package is consumed by `apps/*`. It must never import from an app.
