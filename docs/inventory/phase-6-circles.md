# Phase 6 inventory — Circles (A18, A38.9)

Status against `Mus_Build_Source_of_Truth.md` §30, §31, and §37. Owner asked to proceed. This slice ships **optional, private-first Circles on this device** with per-group visibility and a compile preview. It does **not** invent a social network, members, feed, follower counts, or partner brands.

## §31 Phase 6 bullets

| Item | Status |
|---|---|
| Social / Circles | SHIPPED as local named groups + visibility grants; social **off** by default |
| Partner rewards | DEFERRED_OWNER (economy is an open item; no fake brands) |

## §30 principles — this slice

| Principle | Status |
|---|---|
| Optional | SHIPPED (Life + Settings; social toggle off by default) |
| Private-first / user chooses exactly what is shared | SHIPPED (allowlisted facets only) |
| No automatic journals / health / faith / money | SHIPPED (hard withheld list; kcal/weight/faith cannot be granted) |
| No follower-count emphasis | SHIPPED (copy + preview never mention followers) |
| No infinite engagement feed | SHIPPED (no feed UI) |
| No doomscroll algorithm | SHIPPED (nothing to rank) |
| Strong blocking / reporting | DEFERRED_NETWORK (no other people yet) |
| Granular Circle visibility | SHIPPED (workouts this week / selected goals / grove stage name) |

## A18 Social & Community — this slice

| # | Item | Status |
|---|---|---|
| 1, 2, 25 | Optional; profiles can stay private; social can stay off | SHIPPED |
| 3–4 | Choose what is shared; no sensitive auto-public | SHIPPED |
| 9 | Share selected goals | SHIPPED (explicit pick per Circle) |
| 8 | Share selected Grove | SHIPPED as stage name only; points stay private |
| 13 | Fitness activity as a count | SHIPPED (confirmed workouts this week, not calories) |
| 21–23 | No follower counts, feed, or ranking algorithm | SHIPPED |
| 26 | Circles with per-group visibility | SHIPPED |
| 5–7, 10–12, 14–19 | Badges, live challenges, friends, reactions | DEFERRED_NETWORK |
| 20 | Private messaging | DEFERRED |
| 24 | Block / report | DEFERRED_NETWORK |

## A19 / A38

| Item | Status |
|---|---|
| A19 Circle / public challenges | DEFERRED_NETWORK |
| A38.9 Partner rewards | DEFERRED_OWNER |

## Storage

`circles` and `social_prefs` are Dexie-only (v12). **DEFERRED_SYNC** — no Postgres, no sync queue, not AI-readable. Invites are not sent.

## Out of scope this slice

- Fake members, invites, or a live social graph
- A sixth tab
- Other life-area modules (Work, Mind, Relationships, …)
- Partner-reward economy or branded perks
- Sharing nutrition, weight, journals, faith, or money
- Claiming backup/restore or cloud Circles
