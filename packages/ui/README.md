# @kayamo/ui

Design tokens and shared primitives. Consumed by both pwa and admin.

**Built in:** Chapter 2

**Owns:**
- `tokens.css` — the semantic token layer
- `components/` — Button, Card, Sheet, NumberDisplay, TrendRibbon, Toast, EmptyState

**Rule:** this package is consumed by `apps/*`. It must never import from an app.
