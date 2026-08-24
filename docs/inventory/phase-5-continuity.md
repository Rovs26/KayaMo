# Phase 5 inventory — Long-term continuity (A26–A27)

Status against `Mus_Build_Source_of_Truth.md` §16, §27–28, §31, and §37. This slice ships Life Story from confirmed goals, Grove chapter closure (XP never decreases), a compile-not-CV Evidence Bank, a free Personal Life Archive on this device, and Mus Lite as a density dial. No premium price is invented. Backup to a new device is not claimed as complete.

## §31 Phase 5 bullets

| Item | Status |
|---|---|
| Advanced Life Story / Timeline | SHIPPED as a dated list of confirmed beats (Grove). Search / attachments / faith-by-default DEFERRED |
| Professional Evidence Bank exports | SHIPPED (compile of `professional` story rows; markdown + JSON; not a résumé/CV generator) |
| Mature Life Grove / chapter closure | SHIPPED (what changed / accomplished / let go / learned / carries; points stay) |
| Personal Life Archive | SHIPPED (markdown + JSON; default file has no nutrition kcal or weight) |
| Richer offline / Mus Lite | SHIPPED as Complexity Dial Simple / Balanced / Advanced (density only; export and privacy stay) |
| Advanced premium intelligence / customization | DEFERRED_OWNER (no paywall, no invented price) |

## §16 Life Story & archive — this slice

| Item | Status |
|---|---|
| 16 Life Story from confirmed growth | SHIPPED (Keep in Life Story on completed / released goals; Released is never “failed”) |
| 16.1 Evidence attachments | DEFERRED_FILES |
| 16.2 Professional Evidence Bank | SHIPPED as compile/export, not a generated CV |
| 16.3 You’ve Been Here Before | DEFERRED_LLM |
| 16.4 Chapter Closure | SHIPPED |
| 16.5 Personal Life Archive | SHIPPED (on-device download; journals/faith/nutrition stay out of the default file) |

## A26 Accessibility & Mus Lite — this slice

| # | Item | Status |
|---|---|---|
| 23–25 | Easy / advanced density | SHIPPED (Complexity Dial) |
| 31 | Mus Lite | SHIPPED as Simple: extra learned/capacity notes hide; core loops stay |
| 32 | Complexity Dial Simple / Balanced / Advanced | SHIPPED |
| 1–22, 26–30 | Full a11y, localization, reduced motion, low-data | DEFERRED_PLATFORM / already partly in the PWA shell |

## A27 Data ownership & continuity — this slice

| # | Item | Status |
|---|---|---|
| 1, 28 | Own data; leave without losing an export | SHIPPED (archive copy on this device) |
| 2–4, 13 | Export story, goals, grove/chapter history | SHIPPED (default archive) |
| 14–15 | Human-readable and machine-readable | SHIPPED (`.md` + `.json`) |
| 32 | Personal Life Archive | SHIPPED |
| 5–12, 16–18 | Journals, faith, fitness history, date-range, per-area | DEFERRED (not in the default file on purpose) |
| 19–21 | Backup / restore / new device | DEFERRED_SYNC |
| 22–27, 29–31 | Cloud conflict, undelete, premium-data survival | DEFERRED_SYNC / DEFERRED_OWNER |

## A23 / A25 adjacent

| Item | Status |
|---|---|
| A23.49 Add completed goal to Life Story | SHIPPED (user confirms; released goals can be kept too) |
| A16.34 Easy Life Story access | SHIPPED (Grove) |
| A25.8–9 Search Life Story / chapters | DEFERRED |

## Storage

`life_story_entries` and `grove_chapters` are Dexie-only (v11), same pattern as journal and busy blocks. **DEFERRED_SYNC** — no Postgres table, no sync queue, not AI-readable.

## Out of scope this slice

- Inventing a premium price or paywall
- Claiming backup/restore to a new device is done
- Phase 6 Circles
- Other life-area modules (Work, Mind, Relationships, …)
- Fake calendar / health / wearable connections
- Résumé/CV generation
- Nutrition kcal or weight in the default archive
- Journals, prayer, or faith milestones unless the user later opts them in
