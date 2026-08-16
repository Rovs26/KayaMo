# @kayamo/food

Food resolution: source adapters, normalization, and the cascade every logging surface calls.

**Built in:** Chapters 6, 7, 8, 9

**Owns:**
- `sources/usda.ts`, `sources/off.ts` — normalized adapters
- `normalize.ts` — unit conversion, dedupe keys
- `resolve.ts` — the cascade (My Foods → PH core → cache → OFF → USDA → LLM)
- `aliases.ts` — Taglish alias index

**Rule:** this package is consumed by `apps/*`. It must never import from an app.
