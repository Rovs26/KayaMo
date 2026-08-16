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
