# VestBlock Research Engine

Last updated: 2026-05-01

## Purpose

The research engine gives VestBlock a safe way to stay current without blindly chasing random advice.

It does three things:

1. stores curated public-source research briefs
2. ties those briefs to live operational weak spots and wins
3. turns them into operator-facing recommendations instead of silent code changes

## Storage

Research is stored in `research_briefs`.

Each brief includes:

- `theme`
- `source_type`
- `source_url`
- `source_title`
- `brief_title`
- `summary`
- `recommendations_json`
- `priority`
- `status`
- `created_by_run_id`

## Current themes

- credit repair workflow improvements
- funding readiness improvements
- SEO / AEO content opportunities
- local outreach and lead-gen patterns
- AI receptionist and appointment-booking positioning
- Spanish growth opportunities
- distressed property outreach
- conversion and pricing refinement

## How it runs

Daily:

- `/api/cron/research-digest`

That cron:

- looks at current wins and weak spots from the improvement review
- maps those into curated research themes
- stores structured briefs for operators

## Safety rules

- only curated high-quality public sources should be used
- source URLs must be stored
- research does not directly overwrite workflows
- research produces recommendations first
- medium and high-risk recommendations stay queued for review

## Operator use

Use `/admin/research` to review:

- newest briefs
- recommendation bullets
- priority
- source links

This is intended to help VestBlock keep refining methods while staying grounded and auditable.
