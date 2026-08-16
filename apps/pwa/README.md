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
