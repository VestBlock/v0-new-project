# Continuous Improvement Operator

Use this skill when working on VestBlock's learning loops, daily optimization jobs, and operator-facing improvement system.

## Core principle

VestBlock should improve through measured results, not random tweaks.

## Main tables

- `improvement_runs`
- `improvement_insights`
- `research_briefs`
- `strategy_updates`
- `experiment_results`
- `prompt_versions`
- `score_adjustments`
- `outreach_variants`
- `market_performance_snapshots`
- `method_performance_snapshots`
- `daily_operator_reports`

## Daily jobs

- `improvement-review`
- `research-digest`
- `optimize-outreach`
- `optimize-markets`
- `optimize-content`
- `optimize-credit-funding`

## Safety model

- auto-apply only low-risk score, market, and outreach changes
- queue medium/high-risk customer-facing changes for admin review
- log every run and every applied change

## QA checklist

- run build and typecheck
- test dry-run cron responses
- confirm admin pages load
- confirm queued strategy updates can be approved or applied

## Daily Scorecard Contract

Every daily optimization pass should produce a short status using:

- Revenue: `/admin/revenue-command`
- Outreach: `npm run outreach:scorecard`, `npm run outreach:preflight`, `npm run outreach:v2-audit`
- Visibility: `npm run visibility:aeo-scorecard`, `npm run visibility:indexing-dry-run`
- Technical health: `npm run typecheck` and targeted lint when code changed

Use these status colors:

- Green: target met and no critical blockers.
- Yellow: partial progress, queue exists, or manual review required.
- Red: blocked by empty qualified pool, failed provider, broken build, missing env, or unsafe send state.

Store durable learning in `docs/VESTBLOCK_DAILY_LEARNING_LOG.md`, `docs/VESTBLOCK_GROWTH_BACKLOG.md`, or the relevant operator skill. Do not leave the learning only in chat.
