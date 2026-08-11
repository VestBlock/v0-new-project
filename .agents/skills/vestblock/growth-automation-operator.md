# VestBlock Growth Automation Operator

Use this skill when operating or expanding VestBlock's daily growth engine.

## Goal

Keep VestBlock's lead machine running every day across:

- scraping
- scoring
- outreach drafting
- approval
- follow-up
- admin visibility

## Daily Loop

Run and verify:

1. `/api/cron/leads-source-refill`
2. `/api/cron/leads-score`
3. `/api/cron/leads-outreach`
4. `/api/cron/send-outreach`
5. `/api/cron/leads-throughput`
6. `/api/cron/leads-followup`

Confirm:

- scrape runs save
- leads import cleanly
- scores save
- outreach drafts save
- follow-up tasks generate
- admin gets follow-up alerts when needed

## When The Pool Is Exhausted

If the scorecard says `qualified_pool_exhausted`, do not lower send rules. Work this order:

1. Run `npm run outreach:v3-tools`.
2. Run `npm run outreach:scorecard`.
3. Check `lib/leads/marketPresets.ts`, `lib/leads/marketExpansion.ts`, and `lib/leads/dailyAutomation.ts`.
4. Add or rotate high-fit source profiles before expanding low-fit niches.
5. Verify weak-email enrichment is active for webmail or mismatched-domain leads.

High-fit profiles should favor businesses with clear revenue pain: restoration, construction project management, property management, private lending, funding brokers, agencies, staffing, public adjusters, permit expediters, and commercial service firms.

Avoid re-adding freight/trucking/logistics unless Rob explicitly asks for that vertical.

## Key Files

- `lib/leads/dailyAutomation.ts`
- `lib/leads/scoring.ts`
- `lib/leads/outreach.ts`
- `lib/leads/outbound.ts`
- `lib/leads/repository.ts`
- `lib/leads/marketExpansion.ts`
- `lib/leads/marketPresets.ts`
- `app/api/cron/leads-*`
- `scripts/outreach-v3-tool-audit.mjs`
- `scripts/lead-quality-scorecard.mjs`
- `scripts/outreach-send-control.mjs`
- `components/admin/lead-intelligence-dashboard.tsx`

## Guardrails

- keep auto-send conservative
- do not let provider-key failures turn into crashes
- treat public-source leads differently from direct hand-raiser leads
- log send failures, do not swallow them
- 100/day is a business goal, not permission to email weak leads
- no-email leads are manual/export only

## QA

- `npm run outreach:scorecard`
- `npm run outreach:preflight`
- `npm run outreach:v3-tools`
- `npm run typecheck`
- `npm run build` when route/shared code changed
- dry-run cron routes first
- verify `401` on cron route without auth
- verify skip/readiness behavior when provider keys are missing
