# Reference

Schedule, rules starter content, prompt patterns, the recovery playbook, costs, monorepo layout, and the claims this guide deliberately does not make.

---

# Appendix A — The eight-week schedule

| Week | Chapters | Milestone |
|---|---|---|
| 1 | 0–5 | Rules, design system, auth, schema, offline layer |
| 2 | 6–9 | Food data layer + your PH core seeded |
| 3 | 10–13 | You can log food four ways and see your trend |
| 4 | 14–17 | Taglish chat + photo logging + cost guard |
| 5 | 18–21 | Adaptive TDEE, targets, weekly check-in |
| 6 | 22–24 | Gym logging + progression, wired to nutrition |
| 7 | 25–28 | Coco: tools, RAG, planner, nudges |
| 8 | 29–36 | PWA hardening, Capacitor, health sync, safety, compliance |

**Dogfood rule:** from the end of Week 3 you log every meal in KayaMo and nothing else. Every bug you hit as a user jumps the queue ahead of the roadmap. A tracker that you personally abandon in week 2 will not survive contact with anyone else.

---

# Appendix B — Rules file starter content

`.cursor/rules/000-project.mdc` — `alwaysApply: true`

```markdown
---
name: project-constitution
description: KayaMo core rules — stack, hard constraints, and conventions. Applies to all work in this repo.
alwaysApply: true
---

KayaMo is a Filipino-first calorie and gym tracker. PWA first, Capacitor
wrap for Android/iOS. Solo developer. Users are in the Philippines.

NON-NEGOTIABLE:
- Never call an LLM without a Zod schema on the output.
- Never write nutrition data without `source` and `confidence`.
- The LLM extracts text and quantities. Nutrition numbers come from the
  resolver cascade, never from the model.
- Every AI-created entry is editable by the user.
- Offline first: writes go to IndexedDB, then sync.
- Store UTC, render in the user's timezone. Respect their custom day
  boundary (night shift), never assume midnight.
- All money in PHP.
- Calorie floors (1200F/1500M) are enforced in code, not prompts.
- Banned vocabulary anywhere in prompts or UI: cheat, guilty, earned,
  burn it off, bad food, sinful.
- Health data never appears in logs or error reports.

CONVENTIONS:
- pnpm. TypeScript strict. No `any`.
- Server-only Supabase client never imported into a "use client" file.
- All LLM calls route through packages/ai/src/router.ts.
- One chapter per commit, prefixed `chNN:`.
```

Write the other five the same way, each with a `description` that reads like a search query — Grok 4.6 retrieves rules by description, so "Nutrition domain rules: resolver cascade order, PH food data, portions, Taglish aliases" beats "Nutrition rules."

---

# Appendix C — Prompt patterns that work with Grok 4.6

**Plan-then-implement, on every xhigh chapter.** Ask for the plan, read it, push back, *then* say "implement the approved plan." Grok 4.6 is strong at long-horizon agentic work and will happily build the wrong architecture very efficiently if you skip this.

**State the constraint before the task.** Constraints placed after the task get weaker adherence than constraints placed before it.

**Name the anti-pattern.** "Do not collapse the cascade into a single LLM call" prevents the exact shortcut it will otherwise take. Every chapter above has a "Watch out" for this reason — fold it into the prompt.

**Use the browser tool for anything visual.** End UI prompts with "then open the browser, screenshot at 390px, and fix what looks wrong." A screenshot closes the loop that prose cannot.

**Let it ask.** Grok 4.6 can ask clarifying questions while continuing to work. Answer them rather than pre-empting every detail — you will write shorter prompts and get better results.

**Give it the test as the spec.** "Write tests for these 30 Taglish phrases, then make them pass" is a stronger instruction than any amount of description.

---

# Appendix D — When it goes wrong

| Symptom | Fix |
|---|---|
| Agent drifts mid-chapter, starts refactoring unrelated files | Context bloat. `git reset --hard`, new chat, narrower prompt. |
| Same bug survives three fix attempts | Stop iterating. New chat, xhigh, paste the failing test and the relevant file only. Fresh context beats a long argument. |
| It "fixes" a test by weakening the assertion | Add to 000-project.mdc: never modify a test to make it pass; fix the code or tell me the test is wrong. |
| Costs spiking | Check the context meter — you are probably past 200K where Grok's rates double. Restart the chat. |
| Output looks like every other tracker app | Re-paste the Chapter 2 design brief and say so directly. Ask for a screenshot first. |
| It invents nutrition numbers | The numeric-grounding check from Chapter 25 is missing or bypassed. That is a bug, not a prompt problem. |

---

# Appendix E — Running cost at your scale

| Line item | Just you | 100–1,000 users |
|---|---|---|
| Vercel | Free (hobby) | ~$20/mo |
| Supabase | Free | ~$25/mo (Pro) |
| USDA FDC + Open Food Facts | Free | Free |
| LLM (chat + photo + weekly coach) | ~$0.10–0.50/mo | ~$10–500/mo depending on photo volume |
| Push (Web Push / FCM / APNs) | Free | Free (~$99/yr Apple dev) |
| **Total** | **~$0–1/mo** | **~$55–550/mo** |

Photo analysis is the cost lever. If it runs hot, tighten the daily rate limit and downscale images harder before pushing model tiers up.

---

# Appendix F — What this guide deliberately does not claim

- **Photo calorie estimation is not accurate enough to trust unedited.** Validation work puts multimodal-LLM energy estimation around 36% mean absolute percentage error on standardized single foods, with systematic underestimation that worsens on larger portions, and roughly double the error on mixed meals versus single items. Filipino composite dishes are the worst case. Build it as a draft tool and say so in the product.
- **MEV/MAV/MRV are heuristics, not measurements.** Present them as adjustable bands.
- **Your PH core values are estimates until you verify them.** Ingredient decomposition from USDA data is a defensible starting point, not authoritative Philippine composition data. If you want authoritative numbers, request a data-use agreement from DOST-FNRI in writing.
- **The generated privacy policy is a draft.** You process sensitive personal information under RA 10173. Get it reviewed.

---

# Appendix G — Monorepo layout

Run `kayamo-scaffold.sh` before Chapter 1. It creates this:

```
kayamo/
├── apps/
│   ├── pwa/            the product — Next.js, installable PWA
│   ├── admin/          internal tools, auth-gated, never public
│   └── mobile/         Capacitor shell for Android + iOS
├── packages/
│   ├── db/             schema, migrations, RLS, typed queries
│   ├── core/           TDEE, targets, trend, progression  (pure, no I/O)
│   ├── food/           resolver cascade + USDA/OFF adapters
│   ├── ai/             Coco: router, tools, agent, safety, memory
│   ├── offline/        Dexie + sync queue
│   ├── ui/             design tokens + primitives
│   └── config/         shared eslint / ts / tailwind presets
├── data/ph-core/       foods.yaml, prices.yaml — your moat
├── supabase/           migrations + edge functions
├── docs/               compliance, breach runbook, legal drafts
├── scripts/
└── .cursor/rules/      six rules files, pre-written
```

### Where each chapter's code lands

| Chapters | Package or app |
|---|---|
| 2 | `packages/ui` |
| 3, 4 | `packages/db` + `apps/pwa` (auth routes) |
| 5 | `packages/offline` |
| 6, 7, 8, 9 | `packages/food` + `data/ph-core` |
| 10, 11, 12, 13 | `apps/pwa` (screens) |
| 14, 15, 16, 17 | `packages/ai` |
| 18, 19, 23, 24 | `packages/core` |
| 20, 21, 28 | `supabase/functions` + `packages/core` |
| 22 | `apps/pwa` + `data/exercises` |
| 25, 26, 27, 33 | `packages/ai` |
| 29 | `apps/pwa` |
| 30, 31, 32 | `apps/mobile` |
| 34 | `docs/` |
| 35 | `apps/admin` |

### Why three apps instead of one

**`admin` is separate so it can never ship to users.** It carries service-role
database access, cost dashboards, and the safety review queue. Keeping it in its
own deploy target means there is no code path where an internal tool leaks into
the user bundle — a boundary that is very hard to re-establish later if you
start with everything in one app.

**`mobile` is a shell, not a port.** Capacitor embeds the `apps/pwa` build
verbatim. It holds `capacitor.config.ts`, the generated `android/` and `ios/`
projects, and native plugin wiring — nothing else. If you catch yourself writing
a screen in there, it belongs in the PWA.

### Adding a fourth surface later

New surfaces go in `apps/` and consume `packages/`. A Messenger bot for logging
via chat, a watch app, or a second product that reuses the food resolver should
require **zero** changes to `packages/`. If adding one forces you to modify a
package, the boundary was drawn in the wrong place — fix the boundary rather
than special-casing the new app.

The same applies across products. If KitaMo and KayaMo eventually need shared
Filipino food and pricing data, `packages/food` and `data/ph-core` are the two
things designed to lift out into a shared org-level package. Everything else is
product-specific by intent.

### The one rule that keeps this clean

**Packages never import from apps.** Enforce it — add a dependency-cruiser or
ESLint boundary rule in Chapter 35. The day a package reaches into an app is the
day the monorepo becomes a single tangled app with extra folders.
