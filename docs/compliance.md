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
