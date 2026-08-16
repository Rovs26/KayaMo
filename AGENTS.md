# AGENTS.md — KayaMo

Filipino-first calorie and gym tracker. PWA → Android → iOS.
Solo developer. Bundle ID `ph.kayamo.app`. AI companion: Coco.

## Commands
```bash
pnpm install
pnpm dev:pwa          # user app
pnpm dev:admin        # internal tools
pnpm build
pnpm test
pnpm typecheck
pnpm db:migrate
pnpm ph-core:build    # validate + upsert data/ph-core/foods.yaml
pnpm mobile:sync      # copy PWA build into the Capacitor shell
```

## Where code goes
| Path | Holds | Never holds |
|---|---|---|
| `apps/pwa` | routes, screens, glue | domain logic, formulas |
| `apps/admin` | internal dashboards | anything user-facing |
| `apps/mobile` | native plugin wiring | UI, business logic |
| `packages/db` | schema, migrations, RLS, queries | domain formulas |
| `packages/core` | TDEE, targets, trend, progression | I/O, network, React |
| `packages/food` | resolver cascade, source adapters | UI |
| `packages/ai` | router, tools, agent, safety, memory | nutrition math |
| `packages/offline` | Dexie, sync queue | domain logic |
| `packages/ui` | tokens, primitives | app-specific screens |

Packages never import from apps.

## Hard constraints
See `.cursor/rules/000-project.mdc`. The short version: Zod on every LLM
output, `source` + `confidence` on every nutrition write, LLM never produces
nutrition numbers, calorie floors enforced in code, offline-first writes,
no health data in logs, never weaken a test to make it pass.

## Adding a fourth surface
New surfaces go in `apps/` and consume `packages/`. A Messenger bot, a watch
app, or a second product reusing the food resolver should require zero changes
to `packages/`. If it does require changes, the boundary was drawn wrong.
