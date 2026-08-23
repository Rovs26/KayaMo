# @kayamo/core

Pure domain logic. No I/O, no framework, no network — every function here is unit-testable in isolation.

**Built in:** Bundles 1, 3, 4, and 5.

**Owns:**

- `trend.ts` — time-aware, whoosh-resistant EWMA weight trend
- `tdee.ts` — Mifflin/Katch cold start and adaptive energy-balance estimate
- `targets.ts` — code-derived macros, day types, and non-overridable safety floors
- `progression.ts` — e1RM, volume landmarks, deload logic
- `companion-progression.ts` — idempotent safe rewards, achievements, and Coco growth

**Rule:** this package is consumed by `apps/*`. It must never import from an app.

Wearable burn is never an expenditure input. Every estimate is an immutable
snapshot, and backfilled logs create a new database revision rather than changing
the original. Nutrition targets are estimates for adults, not medical advice.
