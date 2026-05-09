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

1. `/api/cron/leads-scrape`
2. `/api/cron/leads-score`
3. `/api/cron/leads-outreach`
4. `/api/cron/leads-followup`

Confirm:

- scrape runs save
- leads import cleanly
- scores save
- outreach drafts save
- follow-up tasks generate
- admin gets follow-up alerts when needed

## Key Files

- `lib/leads/dailyAutomation.ts`
- `lib/leads/scoring.ts`
- `lib/leads/outreach.ts`
- `lib/leads/outbound.ts`
- `lib/leads/repository.ts`
- `app/api/cron/leads-*`
- `components/admin/lead-intelligence-dashboard.tsx`

## Guardrails

- keep auto-send conservative
- do not let provider-key failures turn into crashes
- treat public-source leads differently from direct hand-raiser leads
- log send failures, do not swallow them

## QA

- `npx tsc --noEmit`
- `corepack pnpm build`
- dry-run cron routes first
- verify `401` on cron route without auth
- verify skip/readiness behavior when provider keys are missing
