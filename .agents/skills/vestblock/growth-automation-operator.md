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

> RETIRED 2026-07-02: the cron routes previously listed here (`leads-source-refill`,
> `leads-score`, `leads-outreach`, `send-outreach`, `leads-throughput`, `leads-followup`) were
> removed from the app and must NOT be recreated.

The current daily loop is the autopilot chain — see
`.agents/skills/vestblock/outreach-autopilot-operator.md`:

1. `npm run outreach:autopilot`
2. `npm run outreach:export-pipeline`
3. Operator-reviewed send (never autonomous)
4. Replies/outcomes logged via `outreach:log-reply` / `outreach:log-offer-outcome`

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
