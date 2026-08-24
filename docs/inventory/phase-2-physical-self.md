# Phase 2 inventory — Physical Self (A29–A31)

Status against `Mus_Build_Source_of_Truth.md` §37. Other life areas stay shelves.

## A29 Nutrition — this slice

| # | Item | Status |
|---|---|---|
| 1–4 | Calorie / protein / carbs / fat targets | SHIPPED |
| 5 | Fiber | SHIPPED (logged amount only; no invented target) |
| 6 | Water / hydration | DEFERRED_PHASE_3 |
| 7 | Sodium/sugar extras | PLANNED (stored on foods; not a Life surface yet) |
| 8–10 | Meal slots, search, barcode | SHIPPED |
| 11–12 | Photo / voice logging | DEFERRED_VOICE_PHOTO |
| 13–18 | Manual foods, meals, portions, PH foods | SHIPPED |
| 19–21 | Restaurant estimates, verified vs estimated | SHIPPED (source + confidence) |
| 22–28 | Weight-direction and activity-aware targets | SHIPPED (code floors; training/rest day types) |
| 29–35 | Flexible ranges, weekly trends, patterns | PLANNED (trend exists for weight; nutrition week bars on Life) |
| 36–49 | Grocery, recipes, autopilot, location menus | DEFERRED_PHASE_3 |
| 50 | Nutrition interacts with Daily Planning | SHIPPED (logs on Physical Self; day type follows training) |
| 51–54 | Flexible Nutrition, Meal Context, Food Patterns, Autopilot | DEFERRED_PHASE_3 |

## A30 Fitness — this slice

| # | Item | Status |
|---|---|---|
| 1 | Goal selection | SHIPPED (optional life-area tag; Physical Self lists matching goals) |
| 2–10 | Experience, days, equipment, generated programs | DEFERRED_PHASE_3 |
| 11–21 | Specialized programs, demos, warm-ups | DEFERRED_PHASE_3 |
| 22–28 | Sets, load, rest, history, PRs | SHIPPED |
| 29–32 | Substitution, missed-day, reschedule, shortened | PLANNED (shortened via Minimum session) |
| 33 | Minimum Workout | SHIPPED (from today's capacity / recovery intent) |
| 34–36 | Recovery/sleep/soreness inputs | DEFERRED_PHASE_3 |
| 37–38 | Volume and strength trends | SHIPPED (proposal engine from last sessions) |
| 39–49 | Cardio, photos, streaks, travel | DEFERRED_PHASE_3 / DEFERRED_NO_STREAK_PUNISHMENT |
| 50 | Daily Planning integration | SHIPPED (Train today / shorter session on Plan My Day) |
| 51–55 | Adaptive Coach, Versions, Readiness, Library, Identity | PLANNED versions only; rest DEFERRED_PHASE_3 |

## A31 Appearance, grooming, care

All items **DEFERRED_PHASE_3**. Physical Self does not generate appearance flaws.

## Connections required by Phase 2

- Goals: optional `life_area`; Physical Self shows matching active goals.
- Today: training can be confirmed onto the day; workout proposal respects capacity.
- Mus: Physical Self still opens the Mus tab; writes stay user-confirmed.
- Grove: existing `food_logged` / `workout_completed` XP; XP never decreases.
- Life Story: **PLANNED** (not in this slice).
