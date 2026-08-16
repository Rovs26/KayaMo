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
