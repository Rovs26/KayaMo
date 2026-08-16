# @kayamo/core

Pure domain logic. No I/O, no framework, no network — every function here is unit-testable in isolation.

**Built in:** Chapters 13, 18, 19, 23

**Owns:**
- `trend.ts` — EWMA weight trend
- `tdee.ts` — adaptive expenditure engine
- `targets.ts` — macro targets, day types, safety floors
- `progression.ts` — e1RM, volume landmarks, deload logic

**Rule:** this package is consumed by `apps/*`. It must never import from an app.
