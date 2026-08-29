# @kayamo/offline

Dexie schema, optimistic writes, and the sync queue. Every user-facing mutation goes through here.

**Built through:** bidirectional sync v1 with commit-ordered server cursors

**Owns:**

- `db.ts` — account-isolated IndexedDB mirrors, durable pull checkpoints, local-only journals, and the sync queue
- `sync-registry.ts` — the explicit server↔device allowlist
- `pull.ts` — paginated `server_seq` pulls and atomic merge/checkpoint transactions
- `sync.ts` — push-then-pull orchestration, exponential backoff; 401 pauses (does not drop)
- `writes.ts` — Dexie first, then enqueue (idempotency key = `userId:table:entityId`)
- `hooks.ts` — React bindings for sync status and live entries

Sync also runs on `online`, `visibilitychange`, and `focus`. Each cycle captures one
account DB and scope epoch; an account change invalidates it before any further local
write. One module cycle runs at a time and pushes queued local mutations before
pulling. Cross-tab pushes remain data-safe through atomic mutation-revision checks.
iOS Safari does not support Background Sync.

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

`updated_at` is the bounded client last-write-wins field. `server_updated_at` is a
diagnostic freshness timestamp only. `server_seq` is the authoritative pull cursor:
every sync-visible mutation obtains a per-user sequence while holding that user's
transactional counter row, so a later sequence cannot commit before the transaction
that allocated an earlier one. A queued local edit survives an older/equal remote
version; a strictly newer remote version replaces it. Server tombstones are
irreversible and delete wins over live stale state in either direction. Equal
client timestamps do not overwrite local state.

Sequence checkpoints have cursor version 2. A legacy timestamp/key checkpoint is
discarded only for its own table and that table replays from sequence zero. The
idempotent merge preserves newer queued local edits and never wipes the account DB,
local-only records, or unsent mutations.

Malformed version-2 checkpoints (negative, unsafe, null, or non-numeric sequences)
use the same table-scoped recovery. The invalid checkpoint is deleted rather than
accepted, that table replays from sequence zero, and a valid version-2 checkpoint
is established after atomic page application.

Migration `0019_sync_sequence.sql` assigns historical sequences through updates
while legacy touch triggers remain active. Historical `server_updated_at` values
therefore reset during the backfill; this is diagnostic only and never affects
ordering, LWW, or deletion behavior.

Every page is validated for ownership and structural cursor fields, then its rows
and table/user checkpoint are written in one Dexie transaction. A crash or cursor
write failure rolls back both. Each authenticated account uses its own IndexedDB;
sign-out switches to an empty signed-out store without deleting another account's
offline queue or private local data.

Legacy `kayamo` migration uses a durable completion marker per source database and
account. A partial destination never counts as complete; restart repeats idempotent,
destination-first copies and never assigns one account's rows to another. Pull
failures are durable and isolated per table with bounded exponential backoff, so a
bad table does not stop later tables or make status claim the cycle is healthy.

Daily plans, focus sessions, and daily-loop preferences sync through the normal
LWW/tombstone queue. Reflection, gratitude, venting, diary, and prayer text never
enters that queue unless a user separately confirms **Remember this**.

This package is consumed by `apps/*`. It must never import from an app.
