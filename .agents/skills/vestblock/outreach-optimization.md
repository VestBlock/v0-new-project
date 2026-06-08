# Outreach Optimization

Use this skill when tuning VestBlock lead outreach from real outcomes.

## Inputs

- `leads`
- `outreach_messages`
- `outreach_send_events`
- `outreach_variants`
- `experiment_results`

## Goal

Improve reply rate and reduce bounce risk by segment.

Prioritize revenue conversations over raw send volume.

## Segment order

1. best offer
2. language
3. category
4. niche
5. city/state

## Optimization Loop

1. Run `npm run outreach:scorecard`.
2. Run `npm run outreach:v2-audit`.
3. Compare `outreach_send_events` outcomes by offer, source, and email quality.
4. Promote variants that produce replies or booked tasks.
5. Deprioritize variants that create bounces, no replies, or confused prospects.

Offer angles:

- DealVault: agreement records, milestone proof, payout clarity.
- AI Receptionist: missed calls, faster response, booking help.
- Search Visibility: found in Google and AI answers for buyer-intent services.
- Funding Prep: clearer funding path and cleaner application package.

## Guardrails

- do not auto-send unapproved cold outreach
- do not erase baseline templates
- store variants and winners with version history
- Spanish variants should be evaluated separately
- avoid internal language like workflow, infrastructure, operator, pilot, AEO, and readiness unless the buyer would say it
- do not optimize toward freight/trucking/logistics unless that vertical is intentionally reopened
