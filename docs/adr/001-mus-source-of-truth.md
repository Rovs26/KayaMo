# ADR 001 — Mus source of truth and Phase 0 defaults

**Status:** accepted  
**Date:** 2026-08-24

## Context

`Mus_Build_Source_of_Truth.md` is the canonical product, UX, AI, privacy, and delivery guide. The repo was built as KayaMo, a Filipino-first calorie and gym tracker with companion Coco. Those two stories conflict.

## Decision

1. **Authority.** `Mus_Build_Source_of_Truth.md` wins over mocks, tickets, and prior chapter prompts. Claude design wins on pixels only when it does not contradict the MD.
2. **Product name.** The shipped app name remains **KayaMo** until a later rename. Bundle ID stays `ph.kayamo.app`. The companion is **Mus**.
3. **Market.** First users remain in the Philippines. Default timezone Asia/Manila, locale Taglish, money PHP. Localization of other markets is later.
4. **Sequencing.** Build Phase 0 then Phase 1 (becoming loop) before deepening life-area modules. Nutrition and gym already exist; they relocate under **Life → Physical Self** and new breadth there is frozen until the becoming loop is real.
5. **Tabs.** Home, Goals, Life, Grove, Mus. No sixth primary “+” tab. Capture is Life Inbox on Home.
6. **Visual.** Folder (5) tokens and seed-to-tree art stay. A new Claude pack is required for this IA. Until it lands, the PWA may remap structure using existing tokens — not a second brand.
7. **Deferred inventory** from §37 is `PLANNED`, not rejected.

## Consequences

Cursor rules and `AGENTS.md` describe a growth OS, not a tracker-only product. Food/gym packages remain. Coco type names in code may lag the UI name Mus.
