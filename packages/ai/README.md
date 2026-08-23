# @kayamo/ai

Everything that talks to a model. Nothing outside this package may import an AI provider SDK.

**Built in:** Bundles 1–2, with later capabilities staged for Bundles 3–8.

**Owns:**

- `coco-router.ts` — validation, permissions, budgets, retries, safety, and fallbacks
- `contracts.ts` — typed context, response, proposal, citation, tool, and safety shapes
- `openai-provider.ts` — server-only Responses API adapter
- `persona.ts` — Coco's voice and constraints
- `tools.ts` — tool authorization without execution or mutation
- `agent.ts` — the single tool-using agent
- `safety.ts` — deterministic red-flag handling before a provider call
- `memory.ts` — pgvector retrieval over the user's own history

**Rule:** this package is consumed by `apps/*`. It must never import from an app.

Normal Coco conversations and user-confirmed memories may sync. Diary, vent, and
prayer-journal text remains device-only unless the user explicitly chooses
**Remember this**. Operational telemetry contains no prompt, response, journal, or
health content, and every proposed write requires a separate user confirmation.
