#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# KayaMo — monorepo scaffold
#
# Creates the folder structure, workspace config, Cursor rules, and docs.
# Does NOT install app dependencies — Chapter 1 of the build guide does that
# with create-next-app so you get current versions instead of stale pins.
#
# Usage:  bash kayamo-scaffold.sh [target-dir]
#         defaults to ./kayamo
# ---------------------------------------------------------------------------
set -euo pipefail

ROOT="${1:-kayamo}"

if [ -e "$ROOT" ]; then
  echo "✗ '$ROOT' already exists. Move it or pass a different target dir."
  exit 1
fi

echo "→ Scaffolding KayaMo at ./$ROOT"
mkdir -p "$ROOT"
cd "$ROOT"

# ---------------------------------------------------------------------------
# Folder tree
# ---------------------------------------------------------------------------
mkdir -p \
  apps/pwa \
  apps/admin \
  apps/mobile \
  packages/db/src \
  packages/core/src \
  packages/food/src/sources \
  packages/ai/src/tools \
  packages/offline/src \
  packages/ui/src \
  packages/config \
  data/ph-core \
  data/exercises \
  supabase/migrations \
  supabase/functions \
  scripts \
  docs/legal \
  .cursor/rules \
  .github/workflows

# ---------------------------------------------------------------------------
# Workspace config
# ---------------------------------------------------------------------------
cat > pnpm-workspace.yaml <<'EOF'
packages:
  - 'apps/*'
  - 'packages/*'
EOF

cat > package.json <<'EOF'
{
  "name": "kayamo",
  "private": true,
  "packageManager": "pnpm@9",
  "scripts": {
    "dev": "turbo run dev",
    "dev:pwa": "turbo run dev --filter=@kayamo/pwa",
    "dev:admin": "turbo run dev --filter=@kayamo/admin",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "test:e2e": "turbo run test:e2e",
    "db:generate": "pnpm --filter @kayamo/db generate",
    "db:migrate": "pnpm --filter @kayamo/db migrate",
    "db:seed": "tsx scripts/seed.ts",
    "ph-core:build": "tsx scripts/build-ph-core.ts",
    "mobile:sync": "pnpm --filter @kayamo/mobile sync",
    "format": "prettier --write ."
  },
  "devDependencies": {}
}
EOF

cat > turbo.json <<'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "globalEnv": [
    "NODE_ENV",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  ],
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "!.next/cache/**", "dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "lint": {},
    "typecheck": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"] },
    "test:e2e": { "dependsOn": ["build"] }
  }
}
EOF

cat > tsconfig.base.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "paths": {
      "@kayamo/db": ["./packages/db/src"],
      "@kayamo/core": ["./packages/core/src"],
      "@kayamo/food": ["./packages/food/src"],
      "@kayamo/ai": ["./packages/ai/src"],
      "@kayamo/offline": ["./packages/offline/src"],
      "@kayamo/ui": ["./packages/ui/src"]
    }
  }
}
EOF

cat > .gitignore <<'EOF'
node_modules/
.next/
out/
dist/
build/
.turbo/
coverage/
*.log
.env
.env.local
.env.*.local
.DS_Store
playwright-report/
test-results/

# Capacitor native projects — generated, but commit them once you ship
apps/mobile/ios/App/Pods/
apps/mobile/android/.gradle/
apps/mobile/android/app/build/
apps/mobile/android/local.properties
*.keystore
*.jks

# Supabase local
supabase/.branches/
supabase/.temp/
EOF

cat > .env.example <<'EOF'
# ── Supabase ───────────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server-only, never imported client-side
DATABASE_URL=

# ── Nutrition data ─────────────────────────────────────────────────────────
USDA_FDC_API_KEY=                   # free from api.data.gov
OFF_USER_AGENT=KayaMo/1.0 (contact@kayamo.ph)   # Open Food Facts requires this

# ── AI model routing (Chapter 17) ──────────────────────────────────────────
AI_PROVIDER_API_KEY=
MODEL_NANO=                         # intent classification, unit parsing
MODEL_SMALL=                        # Taglish extraction, OCR structuring
MODEL_VISION=                       # photo decomposition
MODEL_COACH=                        # weekly narrative only
MODEL_EMBED=
AI_DAILY_BUDGET_USD_PER_USER=0.05
PHOTO_ANALYSES_PER_DAY=10

# ── Optional integrations ──────────────────────────────────────────────────
GOOGLE_CALENDAR_CLIENT_ID=
GOOGLE_CALENDAR_CLIENT_SECRET=

# ── Push ───────────────────────────────────────────────────────────────────
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=

# ── Observability ──────────────────────────────────────────────────────────
SENTRY_DSN=
POSTHOG_KEY=
EOF

cat > .prettierrc <<'EOF'
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 90
}
EOF

# ---------------------------------------------------------------------------
# Package stubs — each gets a package.json, an index, and a README stating
# its single responsibility so Cursor knows where code belongs.
# ---------------------------------------------------------------------------
make_pkg () {
  local name="$1" desc="$2" chapters="$3" owns="$4"
  cat > "packages/$name/package.json" <<EOF
{
  "name": "@kayamo/$name",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "eslint src",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  }
}
EOF
  cat > "packages/$name/README.md" <<EOF
# @kayamo/$name

$desc

**Built in:** $chapters

**Owns:**
$owns

**Rule:** this package is consumed by \`apps/*\`. It must never import from an app.
EOF
  [ -f "packages/$name/src/index.ts" ] || echo "export {};" > "packages/$name/src/index.ts"
}

make_pkg db \
  "Drizzle schema, migrations, RLS policies, and typed query helpers. The single source of truth for data shape." \
  "Chapter 4" \
  "- \`schema.ts\` — all tables
- \`queries/\` — typed read/write helpers
- \`rls/\` — row-level security policies
- \`client.ts\` — browser (anon) and server (service-role) clients"

make_pkg core \
  "Pure domain logic. No I/O, no framework, no network — every function here is unit-testable in isolation." \
  "Chapters 13, 18, 19, 23" \
  "- \`trend.ts\` — EWMA weight trend
- \`tdee.ts\` — adaptive expenditure engine
- \`targets.ts\` — macro targets, day types, safety floors
- \`progression.ts\` — e1RM, volume landmarks, deload logic"

make_pkg food \
  "Food resolution: source adapters, normalization, and the cascade every logging surface calls." \
  "Chapters 6, 7, 8, 9" \
  "- \`sources/usda.ts\`, \`sources/off.ts\` — normalized adapters
- \`normalize.ts\` — unit conversion, dedupe keys
- \`resolve.ts\` — the cascade (My Foods → PH core → cache → OFF → USDA → LLM)
- \`aliases.ts\` — Taglish alias index"

make_pkg ai \
  "Everything that talks to a model. Nothing outside this package may import an AI provider SDK." \
  "Chapters 14, 15, 16, 17, 25, 26, 27, 33" \
  "- \`router.ts\` — model tier selection, budget enforcement, cost logging
- \`persona.ts\` — Coco's voice and constraints
- \`tools/\` — one typed tool per file
- \`agent.ts\` — the single tool-using agent
- \`safety.ts\` — guardrails, red-flag detection, numeric grounding
- \`memory.ts\` — pgvector retrieval over the user's own history"

make_pkg offline \
  "Dexie schema, optimistic writes, and the sync queue. Every user-facing mutation goes through here." \
  "Chapter 5" \
  "- \`db.ts\` — IndexedDB mirror
- \`sync.ts\` — queue drain, backoff, idempotency
- \`hooks.ts\` — React bindings"

make_pkg ui \
  "Design tokens and shared primitives. Consumed by both pwa and admin." \
  "Chapter 2" \
  "- \`tokens.css\` — the semantic token layer
- \`components/\` — Button, Card, Sheet, NumberDisplay, TrendRibbon, Toast, EmptyState"

cat > packages/config/README.md <<'EOF'
# @kayamo/config

Shared ESLint, Prettier, Tailwind, and tsconfig presets so `pwa` and `admin`
never drift. Created in Chapter 1.
EOF

# ---------------------------------------------------------------------------
# App placeholders
# ---------------------------------------------------------------------------
cat > apps/pwa/README.md <<'EOF'
# @kayamo/pwa — the user-facing app

Next.js 15 App Router. This is the product. Ships as an installable PWA and
is the exact bundle `apps/mobile` wraps.

**Scaffold with (Chapter 1):**
```bash
pnpm create next-app@latest apps/pwa --ts --tailwind --app --src-dir --use-pnpm
```
Then set `"name": "@kayamo/pwa"` in its package.json.

**Contains:** routes, screens, service worker, manifest, and thin glue only.
Domain logic lives in `packages/`. If you find yourself writing a TDEE
formula in here, it belongs in `@kayamo/core`.
EOF

cat > apps/admin/README.md <<'EOF'
# @kayamo/admin — internal tools

Next.js, separate deploy, auth-gated to you. Never public.

**Screens:**
- PH core curation (Chapter 7) — review, edit, and verify food entries
- Cost dashboard (Chapter 17) — spend per user, per feature, cache hit rate
- Resolver diagnostics (Chapter 8) — which cascade rung is firing, and misses
- Safety review (Chapter 33) — flagged interactions, privately
- Product metrics (Chapter 35) — retention, logging completeness, time-to-log

**Why separate from the PWA:** admin bundles service-role access and internal
data. Keeping it in its own app means it can never accidentally ship to users.
EOF

cat > apps/mobile/README.md <<'EOF'
# @kayamo/mobile — Capacitor shell

Wraps the `apps/pwa` build for Android and iOS. Built in Chapters 30–32.

**This app holds native code only.** No screens, no business logic — if you're
writing UI here, it belongs in the PWA.

- `capacitor.config.ts` — appId `ph.kayamo.app`, appName `KayaMo`
- `android/`, `ios/` — generated native projects
- native plugin wiring: camera, ML Kit barcode, push, haptics, health

**Why not React Native:** the PWA already exists and works. Capacitor embeds
it verbatim; React Native would mean rebuilding every screen.

**Build:**
```bash
pnpm --filter @kayamo/pwa build
pnpm --filter @kayamo/mobile sync
npx cap open android    # or ios
```
EOF

# ---------------------------------------------------------------------------
# Data seeds
# ---------------------------------------------------------------------------
cat > data/ph-core/foods.yaml <<'EOF'
# KayaMo — Philippine core food dataset (Chapter 7)
#
# THIS IS YOUR MOAT. Hand-curated, personally verified.
#
# Rules:
#  - Never scrape FNRI PhilFCT. Derive values by decomposing dishes into
#    ingredients priced against CC0 USDA FoodData Central data.
#  - Record the assumed recipe in source_note for every entry.
#  - confidence stays <= 0.8 until you have personally verified the entry.
#  - macros must reconcile with kcal within 5% using the 4/4/9 rule.

foods:
  - id: kanin-white-cooked
    name: Kanin (white rice, cooked)
    name_tl: [kanin, rice, sinaing, bigas na luto]
    category: staple
    per100g: { kcal: 130, protein: 2.7, carbs: 28.2, fat: 0.3, fiber: 0.4, sodium_mg: 1 }
    servings:
      - { label: "1 tasa", grams: 200, is_default: true }
      - { label: "1/2 tasa", grams: 100 }
      - { label: "1 cup (rice cooker cup)", grams: 180 }
    typical_prep: Plain steamed, no salt or oil added.
    source_note: USDA FDC "Rice, white, long-grain, regular, cooked, unenriched".
    confidence: 0.8

  - id: adobong-manok
    name: Chicken adobo
    name_tl: [adobong manok, adobo, chicken adobo]
    category: ulam
    per100g: { kcal: 190, protein: 17.0, carbs: 2.1, fat: 12.4, fiber: 0.1, sodium_mg: 620 }
    servings:
      - { label: "1 serving (1 hita + sauce)", grams: 150, is_default: true }
      - { label: "1 piraso (thigh)", grams: 110 }
      - { label: "1 order (carinderia)", grams: 130 }
    typical_prep: >
      Bone-in thigh, skin on. Per 1kg chicken: 60ml soy sauce, 60ml cane
      vinegar, 15ml oil, garlic, bay, peppercorn. Sauce partially reduced;
      assumes roughly half the marinade is consumed with the serving.
    source_note: >
      Ingredient decomposition from USDA FDC (chicken thigh with skin,
      cooked, roasted; soy sauce; vegetable oil). Sodium dominated by soy
      sauce — verify against your own recipe, this varies enormously.
    confidence: 0.6
EOF

cat > data/ph-core/prices.yaml <<'EOF'
# Typical PHP prices for the planner agent (Chapter 27).
# Shown in the UI with last_updated so stale prices are visible.
# These are ESTIMATES, never presented as authoritative.

last_updated: 2026-08-16
region: NCR

items:
  - { item: Rice (well-milled), unit: kg, palengke: 52, supermarket: 58 }
  - { item: Chicken leg quarters, unit: kg, palengke: 180, supermarket: 210 }
  - { item: Eggs (medium), unit: tray-30, palengke: 240, supermarket: 265 }
  - { item: Tokwa, unit: pc, palengke: 15, supermarket: 22 }
  - { item: Monggo, unit: kg, palengke: 95, supermarket: 120 }
  - { item: Galunggong, unit: kg, palengke: 200, supermarket: 240 }
EOF

cat > data/exercises/README.md <<'EOF'
Exercise library seed (Chapter 22). ~120 exercises with Taglish aliases,
muscle groups, equipment, and default rep ranges.
EOF

# ---------------------------------------------------------------------------
# Cursor rules
# ---------------------------------------------------------------------------
cat > .cursor/rules/000-project.mdc <<'EOF'
---
name: project-constitution
description: KayaMo core rules — monorepo layout, hard constraints, naming, and conventions. Applies to all work in this repo.
alwaysApply: true
---

KayaMo is a Filipino-first calorie and gym tracker. PWA first, Capacitor wrap
for Android/iOS. Solo developer. Users are in the Philippines.
Bundle ID `ph.kayamo.app`. AI companion is named Coco.

## Monorepo layout — put code in the right place
- `apps/pwa`    — user-facing Next.js app. Routes, screens, thin glue only.
- `apps/admin`  — internal tools, auth-gated, never public.
- `apps/mobile` — Capacitor shell. Native code only, zero business logic.
- `packages/db` `core` `food` `ai` `offline` `ui` — all shared logic.

Packages never import from apps. Apps never duplicate package logic.
If a formula or a resolver appears inside `apps/`, that is a bug.

## Non-negotiable
- Never call an LLM without a Zod schema on the output.
- Never write nutrition data without `source` and `confidence`.
- The LLM extracts text and quantities. Nutrition numbers come from the
  resolver cascade in @kayamo/food, never from the model.
- Every AI-created entry is editable by the user.
- Offline first: writes go to IndexedDB via @kayamo/offline, then sync.
- Store UTC, render in the user's timezone. Respect their custom day
  boundary (night shift) — never assume midnight.
- All money in PHP.
- Calorie floors (1200F / 1500M) are enforced in code, not prompts.
- Banned vocabulary anywhere in prompts or UI copy: cheat, guilty, earned,
  burn it off, bad food, sinful.
- Health data never appears in logs or error reports.
- Never modify a test to make it pass. Fix the code, or tell me the test
  is wrong and why.

## Conventions
- pnpm workspaces + turbo. TypeScript strict. No `any`.
- The service-role Supabase client is never imported into a "use client" file.
- All LLM calls route through @kayamo/ai `router.ts`.
- One chapter per commit, prefixed `chNN:`.
EOF

cat > .cursor/rules/100-stack.mdc <<'EOF'
---
name: stack-and-tooling
description: KayaMo tech stack, build commands, dependency rules, Next.js and Supabase conventions, turbo and pnpm workspace usage.
---

Next.js 15 App Router · TypeScript strict · Tailwind v4 · Supabase
(Postgres, Auth, Storage, Edge Functions) · Drizzle ORM · Dexie ·
Vercel AI SDK · Zod · Vitest · Playwright · Capacitor · pnpm + turbo.

Do not substitute a library without asking.

Commands: `pnpm dev:pwa`, `pnpm dev:admin`, `pnpm build`, `pnpm test`,
`pnpm typecheck`, `pnpm db:migrate`, `pnpm ph-core:build`.

- Server Components by default; "use client" only where interaction requires it.
- Route handlers validate input with Zod at the boundary.
- Migrations are generated, reviewed, and committed — never applied ad hoc.
- Add a dependency to the package that uses it, not to the root.
EOF

cat > .cursor/rules/200-data-model.mdc <<'EOF'
---
name: data-model-and-rls
description: KayaMo database schema rules — tables, denormalization, row-level security, offline sync keys, and migration conventions.
---

- RLS on every table. Users read only their own rows. Exception: `foods` and
  `servings` where source != 'user' are globally readable.
- `food_entries` stores a DENORMALIZED nutrient snapshot. Never replace it
  with a join. Correcting a food in 2027 must not silently rewrite 2026 history.
- Every user-owned row uses a client-generated UUID primary key plus
  `updated_at`, so offline sync can do last-write-wins.
- Targets and expenditure estimates are versioned rows (`effective_from`),
  never updated in place.
- User-created foods are private by default, with an explicit opt-in to share.
- Every table carries created_at / updated_at.
EOF

cat > .cursor/rules/300-ai-agents.mdc <<'EOF'
---
name: ai-agents-and-coco
description: KayaMo AI rules — Coco's persona, agent architecture, tool design, model tier routing, memory, cost control, and numeric grounding.
---

## Coco
KayaMo's companion (the sibling of KitaMo's Lis). A training partner, not a
nutritionist and not a hype account. Speaks Taglish naturally, matching the
user's register. Never moralizes about food. Never says "guilty", "cheat meal",
"earned it", or "burn it off". Reports numbers plainly and asks before advising.
Defined once in @kayamo/ai `persona.ts`.

## Architecture
ONE tool-using agent plus scheduled and event-triggered runs. No supervisor
hierarchy, no agent-to-agent delegation, unless explicitly requested.

- The structured DB is the source of truth. Every number Coco states must come
  from a tool result — enforce with the numeric-grounding check, and reject
  any output containing an unreferenced figure.
- Coco proposes; the user disposes. Write actions require UI confirmation.
- Long-term profile is updated by an explicit tool, never by silent inference.

## Model routing
Every call goes through `router.ts`. Tiers: NANO (classification), SMALL
(extraction, OCR), VISION (photo), COACH (weekly narrative only). Check the
embedding cache before any model call. Enforce the per-user daily budget.
Log model, tokens, latency, and cost_usd to `agent_runs` on every call.
EOF

cat > .cursor/rules/400-nutrition-domain.mdc <<'EOF'
---
name: nutrition-domain
description: KayaMo nutrition and food data rules — resolver cascade order, Philippine food data sourcing, portions, Taglish aliases, licensing constraints.
---

## Resolver cascade (@kayamo/food `resolve.ts`) — order is fixed
1. My Foods (user's own confirmed foods)
2. PH core (`source='ph_core'`, matched on name AND name_tl aliases)
3. Local cache
4. Open Food Facts — jumps to FIRST when a barcode is present
5. USDA FoodData Central
6. LLM estimate — last resort, confidence capped at 0.5, always UI-flagged

Never collapse the cascade into a single LLM call.
Always return a ranked candidate list, never a bare answer.

## Licensing — hard constraints
- Do NOT scrape FNRI PhilFCT or any FNRI endpoint. No open licence exists.
  PH core values come from ingredient decomposition of CC0 USDA data, with
  the assumption recorded in `source_note`.
- Open Food Facts is ODbL: store the attribution with every imported record
  and surface it in the About screen. Send a proper User-Agent.
- USDA FoodData Central is CC0 — free to use.

## Portions
PH-native units come first in every picker: tasa, piraso, order, hiwa,
kutsara, bowl. Grams are the fallback, not the default.
Vague sizes (malaki / sakto / maliit) map to portion multipliers, never ignored.
EOF

cat > .cursor/rules/500-safety-privacy.mdc <<'EOF'
---
name: safety-and-privacy
description: KayaMo safety guardrails and Philippine data privacy rules — calorie floors, disordered eating red flags, banned copy, RA 10173 compliance, health data handling.
---

## Safety — enforced in code, not prompts
- Calorie floors 1200 (female) / 1500 (male). No override, no advanced mode.
- Max weekly loss target 1% bodyweight. Max deficit 25% below TDEE.
- Clamp any request that breaches a floor and surface `clamped: true` honestly.
- Red-flag detection on input: extreme restriction, purging, appetite
  suppression, "how little can I eat", BMI-below-17.5 goals, body-image
  distress. When flagged: do not provide the plan, respond warmly and briefly,
  surface PH support resources from the config file, do not lecture, do not
  end the conversation.
- Never comment on appearance. Never use guilt framing.
- If a medical condition is mentioned (diabetes, PCOS, kidney, pregnancy,
  ED history), defer to their clinician and do not generate a plan.
- KayaMo is not a medical device. No diagnosis, treatment, or prescription.

## Privacy — RA 10173 (Data Privacy Act of 2012)
Health data is SENSITIVE personal information — the highest-risk category.
- Granular, versioned, opt-in consent per purpose. Nothing pre-ticked.
- Photos deleted from storage after analysis unless the user saves them.
- Calendar event titles are never sent to a model. Only derived time blocks.
- No health data in application logs, analytics, or error reports.
  Analytics track EVENTS, never content.
- Export and hard-delete must both work in-app.
- Breach notification to the NPC within 72 hours (see docs/breach-response.md).
- NPC registration is triggered at 1,000 users processing sensitive personal
  information — see docs/compliance.md.
EOF

# ---------------------------------------------------------------------------
# Docs
# ---------------------------------------------------------------------------
cat > docs/compliance.md <<'EOF'
# Compliance — RA 10173 (Philippine Data Privacy Act of 2012)

> Draft. Requires review by a Philippine lawyer before public launch.

**Status:** pre-launch, single user.

## Why this matters
KayaMo processes health and fitness data, which is **sensitive personal
information** under RA 10173 — the highest-risk category, carrying the
heaviest penalties.

## Triggers to watch
| Trigger | Obligation | Status |
|---|---|---|
| Processing sensitive personal info of 1,000+ individuals | Register data processing systems with the NPC, within 20 days of the system commencing operation (NPC Circular 2022-04, which explicitly covers online and mobile applications) | Not yet reached |
| Any processing | Designate a Data Protection Officer | You, provisionally — record it here |
| Personal data breach | Notify the NPC and affected users within 72 hours | Runbook at docs/breach-response.md |

Penalties run 0.5–3% of annual gross income, capped at ₱5M per violation,
plus criminal liability.

## Processing inventory
| Purpose | Data | Lawful basis | Recipients | Retention |
|---|---|---|---|---|
| Core tracking | food entries, weight, workouts | consent | Supabase | until deletion |
| Photo analysis | meal photos | separate consent | AI provider | deleted post-analysis unless saved |
| Health sync | steps, HR, sleep, weight | separate consent | on-device → Supabase | until deletion |
| Product analytics | events only, no content | separate consent | analytics vendor | 12 months |

## Open items
- [ ] Privacy policy + terms reviewed by counsel
- [ ] DPO formally designated and contact published
- [ ] Cross-border transfer disclosure for the AI provider
- [ ] NPC registration reminder set at the 1,000-user threshold
EOF

cat > docs/breach-response.md <<'EOF'
# Breach response runbook

**NPC notification deadline: 72 hours from knowledge of the breach.**

1. **Contain** — revoke keys, disable the affected path, snapshot logs.
2. **Assess** — what data, how many data subjects, is sensitive personal
   information involved (health data always is), is there a real risk of
   serious harm.
3. **Notify the NPC** within 72 hours: nature of the breach, data involved,
   likely consequences, measures taken.
4. **Notify affected users** — plain language, what happened, what data, what
   you're doing, what they should do.
5. **Document** everything in this repo under `docs/incidents/`.
6. **Post-mortem** — root cause, the control that failed, the fix.

Contacts: NPC (privacy.gov.ph) · counsel: TBD · hosting: Supabase support
EOF

cat > docs/legal/README.md <<'EOF'
Privacy policy and terms live here as markdown, generated in Chapter 34.

**They are drafts.** KayaMo processes sensitive personal information under
RA 10173 — have these reviewed by a Philippine lawyer before taking real users.
EOF

cat > AGENTS.md <<'EOF'
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
EOF

cat > README.md <<'EOF'
# KayaMo

*Kaya mo.* A Filipino-first calorie and gym tracker with an AI companion
that speaks Taglish. Sibling to KitaMo.

```
kayamo/
├── apps/
│   ├── pwa/          → the product (Next.js, installable PWA)
│   ├── admin/        → internal tools, auth-gated
│   └── mobile/       → Capacitor shell for Android + iOS
├── packages/
│   ├── db/           → schema, migrations, RLS
│   ├── core/         → TDEE, targets, trend, progression  (pure logic)
│   ├── food/         → resolver cascade + source adapters
│   ├── ai/           → Coco: router, tools, agent, safety
│   ├── offline/      → Dexie + sync queue
│   ├── ui/           → design tokens + primitives
│   └── config/       → shared eslint/ts/tailwind presets
├── data/ph-core/     → the Philippine food dataset (your moat)
├── supabase/         → migrations + edge functions
├── docs/             → compliance, breach runbook, legal drafts
└── .cursor/rules/    → the constitution Cursor reads
```

## Getting started
1. `pnpm create next-app@latest apps/pwa --ts --tailwind --app --src-dir --use-pnpm`
2. Rename it to `@kayamo/pwa` in its package.json
3. `cp .env.example .env.local` and fill it in
4. `pnpm install`
5. Open Cursor, set Grok 4.6 to **xhigh**, and start at Chapter 1 of the build guide

## Why this shape
The PWA is the product. Admin exists so internal tooling and service-role
access can never ship to users. Mobile is a shell, not a rewrite — Capacitor
embeds the PWA build verbatim. Everything reusable lives in `packages/`, so
a future surface (or a future app) consumes it without a refactor.
EOF

cat > .github/workflows/ci.yml <<'EOF'
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
EOF

cat > scripts/README.md <<'EOF'
- `build-ph-core.ts` — validate data/ph-core/foods.yaml and upsert (Chapter 7)
- `seed.ts` — seed dev data (Chapter 4)
- `simulate-tdee.ts` — 12-week synthetic personas for the TDEE engine (Chapter 18)
EOF

git init -q 2>/dev/null || true

echo ""
echo "✓ KayaMo scaffolded."
echo ""
echo "Next:"
echo "  cd $ROOT"
echo "  pnpm create next-app@latest apps/pwa --ts --tailwind --app --src-dir --use-pnpm"
echo "  cp .env.example .env.local"
echo "  open in Cursor → Grok 4.6 xhigh → Chapter 1"
echo ""
