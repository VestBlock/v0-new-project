# VestBlock Lender Automation

## What the lender engine does

The lender engine discovers, scores, enriches, and organizes lender prospects for VestBlock's funding and real-estate workflows.

It currently supports:

- lender discovery
- lender scoring
- lender outreach draft generation
- lender follow-up queueing
- lender performance rollups
- borrower-to-lender match storage

## Daily automation

Routes exist for local/operator use but are not currently scheduled in `vercel.json`:

- `/api/cron/lenders-discover`
- `/api/cron/lenders-score`
- `/api/cron/lenders-followup`
- `/api/cron/lenders-performance`

Retired and not scheduled:

- `/api/cron/lenders-outreach`

Lender outreach should stay approval-gated through offline drafts until a guarded daily lender sender is rebuilt.

Recommended flow:

1. discover new lender prospects
2. enrich and score fit
3. generate partnership outreach drafts
4. queue follow-up tasks
5. roll up performance counts

## Approval model

VestBlock keeps lender outreach under approval control.

Drafts move through:

- `draft` or `needs_review`
- `approved`
- `sent`
- `failed`
- `archived`

Sending is blocked unless:

- a usable contact email exists
- the message is approved
- Gmail sender credentials are configured

## Environment variables

- `GOOGLE_PLACES_API_KEY` for lender discovery via Google Places
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `GOOGLE_WORKSPACE_SENDER`
- `CRON_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`

## Admin surfaces

- `/admin/lenders`
- `/admin/lenders/[id]`
- `/admin/lender-programs`
- `/admin/lender-outreach`
- `/admin/lender-matches`

## Notes on source quality

The first discovery pass uses public market searches and lender websites. It is good for coverage, but the strongest network quality comes from:

- curated regional banks
- credit unions
- CDFIs
- investor-focused real-estate lenders
- community and bilingual programs

## Outreach sequencing

The lender outreach engine now uses a staged conversation instead of pushing economics too early:

- `email_intro`
  - explains VestBlock's borrower-prep angle
  - asks for fit-box guidance
  - asks who handles partner or referral relationships
- `email_followup`
  - repeats the lender-fit checklist
  - asks for state coverage, borrower preferences, and no-go items
  - gently asks whether the lender has a formal referral or broker program, partner onboarding steps, or compensation structure where legally permitted
- `linkedin_dm` and `phone_script`
  - keep the conversation lightweight
  - focus on fit, state coverage, and the right partner contact

For real-estate lenders, the qualification checklist leans into investor appetite, DSCR/LTV/seasoning, cash-out, and rehab tolerance. For business/community lenders, it leans into revenue, time in business, startup tolerance, industry focus, and bilingual support.

## Next practical expansion

- Add more public lender directories and CDFI sources.
- Add lender CSV import for curated partner lists.
- Add explicit lender-owner assignment and reply logging.
- Add borrower-facing lender recommendation cards in the funding dashboard.
