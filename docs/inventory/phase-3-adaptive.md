# Phase 3 inventory — Adaptive intelligence (A11–A12)

Status against `Mus_Build_Source_of_Truth.md` §31 and §37. Formulas live in `@kayamo/core` (`adaptive.ts`) and read **local confirmed records** only. No LLM. No calendar, health, or wearable integrations.

## §31 Phase 3 bullets

| Item | Status |
|---|---|
| Learned durations | SHIPPED (median of ≥3 completed focus sessions; Plan My Day note + default focus length) |
| Capacity estimation | SHIPPED (from named Plan My Day capacity vs confirmed completions; never invents a busier day) |
| Pattern library | DEFERRED_NO_NEW_TABLE (confirm/skip on Weekly Reset; Keep writes a personal rule, skip stays on-device) |
| Deadline risk | SHIPPED (Goals + Weekly Reset; keep / pause / set down; no shame copy) |
| Procrastination patterns | PLANNED (idle inbox ≥7 days and unscheduled tasks ≥3 days as Forgotten Things) |
| Goal plausibility | SHIPPED (gentle weekly pace; no scenario planning) |
| Goal Reality Check / Critical Path | DEFERRED_PHASE_4 |
| Weekly / monthly analytics | SHIPPED weekly (Weekly Reset + Grove “from your records”); monthly DEFERRED_PHASE_4 |
| Ask My Life / Ask My Past Self | DEFERRED_LLM |
| Forgotten Things | SHIPPED (listed, never dumped onto today) |
| Motivation Profile | DEFERRED_LLM |

## A11 Daily Planning & Execution — this slice

| # | Item | Status |
|---|---|---|
| 1, 3–7, 19–20, 41 | Plan / Restructure / Rescue / check-ins / capacity pick / Minimum / focus / Day Intent | SHIPPED (Phase 0–1) |
| 8 | Automatic capacity estimation | SHIPPED |
| 28 | Task duration learning | SHIPPED (focus blocks; not per-task titles) |
| 35 | Deadline-risk awareness | SHIPPED |
| 37 | Personal rules | SHIPPED (Keep as a rule from a pattern; mus_may_read false by default) |
| 40 | End-of-day unfinished handling | SHIPPED (unscheduled, not dumped) |
| 2 | Plan Tomorrow | PLANNED (evening `tomorrow_note` exists) |
| 9–18, 21–27, 29–34, 36, 38–39 | Task types, travel, mood, location, weather, hours, contracts | DEFERRED_PHASE_4 / DEFERRED_INTEGRATION |

## A12 Reviews, Analytics & Self-Awareness — this slice

| # | Item | Status |
|---|---|---|
| 1–2 | Daily review, Weekly Reset | SHIPPED |
| 6, 26–28, 35, 37 | Goal review, plausibility, change/release, personal-rule confirm/skip, milestones, user corrections | SHIPPED |
| 16, 18, 20, 25 | Idle/forgotten, busiest weekday, postponed, capacity accuracy | SHIPPED (local formulas) |
| 34, 39 | Evidence of becoming, presence grid | SHIPPED (Grove; no streak punishment) |
| 41 | Personal Pattern Library with confirm / reject / edit | DEFERRED_NO_NEW_TABLE |
| 3–5, 7–15, 17, 19, 21–24, 29–33, 36, 38, 40 | Monthly/season/annual, mood/sleep/screen, hours, Mus observations, graphs | DEFERRED_PHASE_4 / DEFERRED_LLM |

## Out of scope this slice

- Ask My Life / Ask My Past Self (LLM over stored life)
- Screen time, mood, wearable, calendar
- Other life-area modules (Work, Mind, etc.)
- A new synced Pattern Library table
- Fake integrations
