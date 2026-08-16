# @kayamo/ai

Everything that talks to a model. Nothing outside this package may import an AI provider SDK.

**Built in:** Chapters 14, 15, 16, 17, 25, 26, 27, 33

**Owns:**
- `router.ts` — model tier selection, budget enforcement, cost logging
- `persona.ts` — Coco's voice and constraints
- `tools/` — one typed tool per file
- `agent.ts` — the single tool-using agent
- `safety.ts` — guardrails, red-flag detection, numeric grounding
- `memory.ts` — pgvector retrieval over the user's own history

**Rule:** this package is consumed by `apps/*`. It must never import from an app.
