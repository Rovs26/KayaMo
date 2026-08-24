# Phase 4 inventory — Integrations and agentic action (A9–A10)

Status against `Mus_Build_Source_of_Truth.md` §26, §31, and §37. **Never fake an integration.** This slice ships the permission center, documented platform limits, manual calendar alternative, Plan Tomorrow as a confirmable nightly proposal, and browser voice when the engine actually exists.

## §31 Phase 4 bullets

| Item | Status |
|---|---|
| Calendar sync | DEFERRED_NATIVE (manual busy blocks on-device; dashboard says not connected) |
| Health / wearable data | DEFERRED_NATIVE (Physical Self logs still count; no invented steps) |
| Location / travel / weather | DEFERRED_PROVIDER (not requested; no fake forecast) |
| Screen time / app blocking | DEFERRED_NATIVE (focus remains a timer; copy says the PWA cannot block apps) |
| Voice depth | SHIPPED (Web Speech when present; otherwise type. Inbox `kind: voice` stays private) |
| Tool / web research | DEFERRED_PROVIDER (no search tool, no invented citations) |
| Automation rules | DEFERRED_PHASE_5 (auto-manage is clamped off) |
| Permissioned action model | SHIPPED (Suggest vs Act with permission; never default auto-manage) |
| Automatic nightly planning | SHIPPED as a **proposal** (evening reflection opens Plan Tomorrow; user confirms) |

## A10 Integrations & Automation — this slice

| # | Item | Status |
|---|---|---|
| 1–2 | Google/Apple calendar, two-way sync | DEFERRED_NATIVE |
| 3–6 | Health, wearables, screen-time, app blocking | DEFERRED_NATIVE |
| 7–10 | Location, travel, maps, weather | DEFERRED_PROVIDER |
| 11 | Notifications / reminders | SHIPPED (existing quiet reminder; dashboard lists it) |
| 12 | Alarm / Wake Protocol | DEFERRED_NATIVE |
| 13–14 | Voice commands / voice messages | SHIPPED capture into Life Inbox only when SpeechRecognition exists |
| 15–21 | Files, email, cloud, MCP, web/place/price research | DEFERRED_PROVIDER |
| 22 | Automatic schedule rebuilding from external events | DEFERRED_NATIVE (no external events) |
| 23 | Automation rules | DEFERRED_PHASE_5 |
| 24 | Contextual permission requests | PLANNED (copy exists; location is not asked yet) |
| 25 | Integration dashboard | SHIPPED (Settings · What Mus can do; connected is never invented) |

## A9 / A11 adjacent

| Item | Status |
|---|---|
| A9.6 Permission before actions | SHIPPED (level stored on-device) |
| A9.21 What Mus Can Do | SHIPPED |
| A11.2 Plan Tomorrow | SHIPPED (confirm onto tomorrow; leftover is not dumped onto today) |
| A11.9 Protected / fixed time | SHIPPED as manual busy blocks (Dexie-only, not a fake calendar) |

## Out of scope this slice

- OAuth, Health Connect, Apple Health, Capacitor plugins
- A synced `busy_blocks` Postgres table (stays device-local like journal until a real calendar exists)
- Auto-manage writes
- Asking for location
- Web search tools
