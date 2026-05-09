# VestBlock Buyer Automation

## What the buyer engine does

The buyer engine discovers, scores, enriches, and organizes property buyers for VestBlock's seller and distressed-property workflows.

It currently supports:

- buyer discovery
- buyer scoring
- buyer outreach draft generation
- buyer follow-up queueing
- buyer performance rollups
- property-to-buyer match storage

## Daily automation

Scheduled in `vercel.json`:

- `/api/cron/buyers-discover`
- `/api/cron/buyers-score`
- `/api/cron/buyers-outreach`
- `/api/cron/buyers-followup`
- `/api/cron/buyers-performance`

Recommended flow:

1. discover new buyer prospects
2. enrich websites and score fit
3. generate partnership or acquisition outreach drafts
4. queue follow-up tasks
5. roll up responsiveness and match activity

## Approval model

VestBlock keeps buyer outreach under approval control.

Drafts move through:

- `draft` or `needs_review`
- `approved`
- `sent`
- `failed`
- `archived`

Sending is blocked unless:

- a usable buyer contact email exists
- the message is approved
- sender credentials are configured

## Environment variables

- `GOOGLE_PLACES_API_KEY` for buyer discovery via Google Places
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `GOOGLE_WORKSPACE_SENDER`
- `CRON_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`

## Admin surfaces

- `/admin/buyers`
- `/admin/buyers/[id]`
- `/admin/buyer-outreach`
- `/admin/buyer-matches`

## Live intake integration

Buyer matching now runs automatically for:

- `/api/sell-lead`
- `/api/real-estate-lead`

That means direct seller leads and real-estate funding intakes can start producing buyer matches without waiting for a manual operator step.

## Notes on source quality

The first discovery pass uses public market searches and investor websites. It is good for coverage, but the strongest buyer network quality comes from:

- local cash buyers with clear buy boxes
- landlord and BRRRR operators
- proven fix-and-flip groups
- institutional buyers with market-specific acquisition criteria
- bilingual acquisition teams in Spanish-heavy markets

## Next practical expansion

- Add curated CSV import for buyer lists and hedge-fund coverage.
- Add code-violation lead auto-matching during lead enrichment.
- Add reply logging and acquisition-team owner assignment.
- Add buyer routing cards directly inside the real-estate lead detail experience.
