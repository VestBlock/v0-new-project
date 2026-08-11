# Codex Fast Context

Last updated: 2026-05-19

Read this first before starting a VestBlock sprint. This is the short operating map, not the full audit history.

## Current Business Priorities

- Get revenue conversations from DealVault, AI Receptionist, Search Visibility, and funding prep.
- Keep outreach quality-first while working toward the business goal of 100 compliant emails/day.
- Make public pages buyer-facing, premium, and easy to navigate.
- Keep DealVault as proof records, agreement history, payouts, milestones, and demo assets. Do not turn it into escrow, custody, tokenized real estate sales, or legal replacement claims.
- Use automation to surface blockers early instead of silently missing daily goals.
- Run the daily Growth + Product Optimization Loop from the scorecards and learning docs before starting broad audits.

## Fast Skill Router

Use these operator docs before scanning broadly:

- Board-level website optimization: `.agents/skills/vestblock/agent-board-orchestrator.md`, `docs/VESTBLOCK_AGENT_BOARD.md`, `docs/vestblock-agent-board.json`
- Outreach/contactability: `.agents/skills/vestblock/compliant-outreach-operations.md`, `.agents/skills/vestblock/growth-automation-operator.md`, `.agents/skills/vestblock/lead-intelligence-operator.md`, `.agents/skills/vestblock/signal-based-outbound-operator.md`
- Revenue command center: `app/admin/revenue-command/page.tsx`, `lib/admin/revenueCommand.ts`
- Reusable workflow skills: `.agents/skills/vestblock/reusable-skill-authoring.md`, `.agents/skills/vestblock/github-discipline-operator.md`
- Gmail/reply triage: `.agents/skills/vestblock/gmail-triage-operator.md`
- Qualified pool exhausted: `.agents/skills/vestblock/market-expansion-operator.md`, `.agents/skills/vestblock/market-learning-loop.md`, `.agents/skills/vestblock/outreach-optimization.md`
- Public conversion: `.agents/skills/vestblock/agentic-conversion-operator.md`, `.agents/skills/vestblock/analytics-conversion-operator.md`, `.agents/skills/vestblock/compliance-safe-credit-content.md`
- Search Visibility/AEO: `.agents/skills/vestblock/ai-citation-growth-operator.md`, `.agents/skills/vestblock/aeo-content-automation.md`, `.agents/skills/vestblock/seo-aeo-learning-loop.md`
- Funding/funding prep: `.agents/skills/vestblock/funding-lead-automation.md`, `.agents/skills/vestblock/funding-strategy-improvement.md`, `.agents/skills/vestblock/partner-offer-operator.md`
- DealVault revenue: `.agents/skills/vestblock/dealvault-revenue-operator.md`
- Release/env/live issues: `.agents/skills/vestblock/vercel-supabase-release-operator.md`, `.agents/skills/vestblock/production-launch-verification.md`, `.agents/skills/vestblock/security-privacy-audit.md`

## Main Public Routes

- `/`
- `/services`
- `/pricing`
- `/dealvault`
- `/dealvault/demo`
- `/dealvault/demo-record`
- `/smart-contracts`
- `/visibility-expansion`
- `/visibility-expansion/proof-hub`
- `/ai-assistant`
- `/get-started`
- `/funding`
- `/funding/business-funding-strategy`
- `/real-estate-funding`
- `/sell`
- `/learn`
- `/learn/[slug]`
- `/services/[slug]`

## Revenue Products

- DealVault: agreement records, proof certificates, referral/payout clarity, milestone tracking, smart-contract-backed proof events.
- AI Receptionist: missed-call capture, booking support, form follow-up, faster intake for service businesses.
- Search Visibility: SEO/AEO pages, proof hub, off-site mentions, Google/Search Console hygiene, buyer-facing content.
- Funding Prep: document/profile cleanup and application-readiness support, not funding guarantees.
- Website/lead capture support: conversion fixes, better CTAs, forms, and follow-up paths.

## Outreach System Map

- V4 rebuild boundary: `docs/OUTREACH_V4_REBUILD.md`, `lib/leads/outreach-v4/`, `scripts/outreach-v4-dry-run.mjs`, `scripts/outreach-v4-scorecard.mjs`, `scripts/outreach-v4-approve-drafts.mjs`, `scripts/outreach-v4-send-approved.mjs`, `scripts/outreach-v4-workflow.mjs`
- V4 real-source priority lane: `npm run outreach:v4-dry-run -- --real-source --real-source-verticals=real_estate_partners,contractors_home_services,ai_receptionist --business-markets=4 --real-source-limit=10 --real-source-niches=5 --target=50`
- Current priority mix: fill most daily sends from real-estate B2B lanes first (`real_estate_partners`, then `contractors_home_services`). Use `ai_receptionist` as a secondary filler. Treat `no_website`, `weak_website`, and generic DealVault as fallback lanes unless Rob explicitly asks for them.
- Current real-estate message: lead with partnership, not DealVault. Ask buyers for buy box, lenders for criteria, seller-side partners for where VestBlock can bring buyer interest, and contractors for ideal referral/project fit. DealVault is a later conversation tool, not the first outreach pitch.
- V4 controlled enrichment: add `--enrich-missing-email --enrichment-limit=25` to let V4 use configured domain enrichment for missing-email records while staying dry-run/review-first.
- Current daily sender path: `npm run outreach:v4-workflow`, `npm run outreach:v4-approve -- --limit=50`, preview with `npm run outreach:v4-send-approved -- --limit=50`, then live send with `npm run outreach:v4-send-approved:live -- --limit=50` when provider, mailing-address, ledger, and guardrails pass.
- Legacy orchestration: `lib/leads/dailyAutomation.ts` is not the daily outreach path; use Outreach V4 and the offline buyer draft pipeline instead.
- Legacy send guardrails/provider: `lib/leads/outbound.ts`
- Legacy autopilot eligibility: `lib/leads/autopilot.ts`
- Revenue campaign fit: `lib/leads/revenueCampaigns.ts`
- Lead repository queries: `lib/leads/repository.ts`
- Legacy V2/V3 outreach scripts were removed from the website repo. Use V4 operator scripts only.
- V4 scorecard: `npm run outreach:v4-scorecard`
- V4 review/approve: `npm run outreach:v4-approve -- --limit=50`
- V4 send approved: `npm run outreach:v4-send-approved -- --limit=50`
- V4 live send approved: `npm run outreach:v4-send-approved:live -- --limit=50`
- Legacy cron routes are no longer scheduled in `vercel.json`: `daily-lead-run`, `leads-scrape`, `leads-enrich-email`, `leads-score`, `leads-outreach`, `leads-followup`, `send-outreach`, `leads-source-refill`, `leads-throughput`, `optimize-outreach`.
- Legacy cron routes were removed from the app and are no longer scheduled. Do not recreate `daily-lead-run`, `leads-*`, `send-outreach`, `buyers-outreach`, `lenders-outreach`, or `optimize-outreach`; use `npm run outreach:v4-workflow`, `npm run buyers:kimi-outreach`, and the approved-draft send scripts.
- High-fit outreach source strategy now favors relationship-heavy service businesses where VestBlock has clearer value: restoration, construction project management, property management, private lending, funding brokers, agencies, staffing, public adjusters, permit expediters, and commercial service firms.
- Email enrichment now checks weak existing emails too, not just missing emails. Direct domain emails can skip enrichment, but webmail or mismatched-domain emails get public website/Hunter verification before drafts.

## Lead Quality And Send Pipeline

1. Discover leads from source connectors.
2. Score and classify revenue fit.
3. Enrich public email/contact data.
4. Generate outreach drafts.
5. Review or auto-approve only production-safe drafts.
6. Send only approved, clean-copy, email-ready leads.
7. Log sent/skipped/failed events and follow-up tasks.

Current known state: Outreach V4 is the active path with a safer `50/day` target. On 2026-05-19, V4 sent 81 approved B2B emails through Gmail: 45 `real_estate_partners`, 29 `contractors_home_services`, and 7 `ai_receptionist`. This exceeded the intended 50/day cap because `package.json` hardcoded `--limit=50` in the live sender script before a smaller fill-run limit; `scripts/outreach-v4-send-approved.mjs` now uses the last `--limit` argument and the live package script no longer hardcodes a limit. Pause additional sends for the day after the cap is reached.

## DealVault And Smart Contract Map

- Public pages: `app/dealvault/`, `app/smart-contracts/`
- Dashboard: `app/dashboard/dealvault/`
- APIs: `app/api/dealvault/`
- Shared code: `lib/dealvault/`, `lib/blockchain/`
- Contracts: `contracts/`
- Contract tests: `test/ProofVault.test.ts`, `test/MilestoneVault.test.ts`, `test/PartnerPay.test.ts`, `test/DealVaultRealEstate.test.ts`
- Demo package: `scripts/createDealVaultDemoPackage.ts`, `public/dealvault/`, `deployments/dealvault-demo-package.json`
- Do not put raw private docs, full agreements, private addresses, SSNs/EINs, or keys on-chain.

## Vercel Deployment Notes

- Project: `v0-vest-block-rebuild`
- Production alias: `vestblock.io`
- Linked project file: `.vercel/project.json`
- Homebrew `vercel` binary may fail on this Mac because of a missing `libsimdutf` dependency. Use `npx vercel@latest ...` if needed.
- Recent production fix: `OUTREACH_MAILING_ADDRESS` was added to Vercel production/development and redeployed on 2026-05-13.

## Required Env Vars By System

Do not print secrets. Only verify presence.

- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, anon key vars used by app clients.
- Outreach send: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_WORKSPACE_SENDER`, optional `RESEND_API_KEY`, `FROM_EMAIL`.
- Outreach compliance: `OUTREACH_MAILING_ADDRESS` or `BUSINESS_MAILING_ADDRESS`.
- Cron: `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL` or base URL setting used by send-control scripts.
- Lead discovery/enrichment: Google Places/Outscraper/Hunter/API provider keys where configured.
- Search indexing: `GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL`, `GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY`, optional `GOOGLE_SEARCH_CONSOLE_SITE_URL`, plus `INDEXNOW_KEY` or `BING_INDEXNOW_KEY`.
- DealVault chain proof: server-only RPC URL/private key vars. Never expose private keys to client bundles.
- Payments: PayPal/Stripe provider env vars. Do not run live charges unless explicitly approved.

## Common Commands

- App checks: `npm run typecheck`, `npm run build`, `npm run check:app`
- Contracts: `npm run compile:contracts`, `npm run test:contracts`, `npm run check:contracts`
- DealVault demo: `npm run demo:dealvault`
- DealVault UI verifier: `npm run verify:dealvault:ui`
- Outreach V4 workflow: `npm run outreach:v4-workflow`
- Outreach V4 scorecard: `npm run outreach:v4-scorecard`
- Outreach V4 approve: `npm run outreach:v4-approve -- --limit=50`
- Outreach V4 send preview: `npm run outreach:v4-send-approved -- --limit=50`
- Outreach V4 live send: `npm run outreach:v4-send-approved:live -- --limit=50`
- Outreach legacy aliases now route to V4 scorecard/approve or block old send commands.
- No-email export: `npm run outreach:export:no-email`
- Revenue command scorecard: `npm run revenue:command`
- Visibility proof assets: `npm run visibility:proof-assets`
- Visibility AEO scorecard: `npm run visibility:aeo-scorecard`
- Visibility indexing dry run: `npm run visibility:indexing-dry-run`
- Visibility indexing push: `npm run visibility:indexing-push`
- Daily growth memory: `docs/VESTBLOCK_DAILY_LEARNING_LOG.md`, `docs/VESTBLOCK_GROWTH_BACKLOG.md`, `artifacts/daily-growth/`

## Known Blockers

- Not enough production-eligible, email-ready leads to support 50/day consistently across all verticals yet.
- Gmail reply monitoring is not currently trustworthy until Gmail connector is re-authenticated or the local Google OAuth token has a Gmail read-only scope.
- Email verification is the missing scale safety layer before sustained 100/day sending; use ZeroBounce/NeverBounce-style verification before raising volume.
- Many leads are excluded by production rules; do not override that without a specific source-quality fix.
- Lender discovery/sending cron is paused by default because it was a heavy side path and not the current revenue focus. Re-enable intentionally only after core outreach and funding pages are stable.
- Some historical docs are stale. Prefer this file, `docs/CODEX_TASK_PLAYBOOK.md`, and current scripts over older archive prompts.
- Worktree is often dirty. Do not revert unrelated changes.
- Vercel env and local `.env.local` can drift; verify both when live endpoints behave differently than local scripts.
- Google Search Console API submission is blocked until a service account is created, Search Console access is granted, and the Search Console API env vars are set locally and in Vercel.
- Bing/IndexNow URL submission is blocked until an IndexNow key is configured and reachable from the site.

## What Not To Re-Audit Unless Necessary

- Do not scan all `app/` first.
- Do not run broad `rg outreach` unless the targeted files fail to explain the issue.
- Do not read `docs/archive/` unless Rob asks for historical prompt material.
- Do not inspect admin/dashboard code for public marketing copy tasks.
- Do not re-review smart contracts for a copy/design task.
- Do not run live email sends, blockchain transactions, or payments unless explicitly approved in the active thread.

## Recent Fixes And Current State

- Internal links were strengthened from homepage/services/pricing/learn into DealVault, Smart Contracts, Search Visibility proof hub, and AI Receptionist.
- Outreach send queue now can auto-approve safe `needs_review` emails during throughput/send catch-up when guardrails pass.
- Legacy outreach throughput/refill is disabled for scheduled automation. Use V4 workflow instead.
- Outreach scorecard now reports `qualified_pool_exhausted` instead of blaming no-email backlog when the eligible pool was already emailed.
- Vercel production has the compliant outreach mailing address configured.
- A controlled batch was sent successfully through Gmail on 2026-05-13; latest scorecard showed 23 emails sent in the last 24 hours, but the safe send queue was empty.
- Outreach V3 reset has a legacy tool audit command: `npm run outreach:v3-tools`. Do not use it for daily automation.
- Outreach quarantine export now exists: `npm run outreach:quarantine-export` saves missing, risky, suppressed, and enrichment-exhausted leads to an offline CSV. Do not run `npm run outreach:quarantine-export:apply` unless Rob explicitly approves moving those leads out of active outreach counts.
- 2026-05-17: Outreach V4 rebuild was added beside the legacy loop. Start with `docs/OUTREACH_V4_REBUILD.md`, `npm run outreach:v4-dry-run`, and `npm run outreach:v4-scorecard`. V4 separates vertical scrapers, market rotation, scoring, dedupe/quarantine, drafts, and the distressed-house pipeline. It does not send live email by itself. Real-source adapters now prioritize `real_estate_partners` and `contractors_home_services`, with AI Receptionist secondary and no/weak website fallback. V4 defaults to a safer 50/day target.
- 2026-05-17: Scheduled outreach automations were moved off legacy V2/V3. Vercel no longer schedules old lead/outreach/send/refill/throughput routes, desktop automations run `npm run outreach:v4-workflow`, and old send aliases are blocked.
- Legacy website-based outreach refill and throughput routes were removed from the deployed app. Outreach now runs through Codex/operator V4 scripts instead of website cron/API endpoints.
- 2026-05-19: Added V4 send-control through `scripts/outreach-v4-send-approved.mjs`, created the `VestBlock Outreach V4 Daily Sender` desktop automation, deleted the old no-send outreach scorecard/lead-quality/source-ROI automations, and shifted daily sourcing toward real-estate B2B outreach. The same day, 81 approved B2B emails were sent through Gmail; treat this as a cap-overrun incident, not the new target. The sender limit parser and live script were fixed so future fill runs can honor smaller limits.
- 2026-05-14: Added stronger high-fit source profiles and weak-email verification so outreach learns toward better-fit revenue targets instead of only trying to scrape more generic businesses.
- 2026-05-14: Outreach city rotation was strengthened after repeated-city concerns. Source refill now defaults to two markets, no longer puts default Milwaukee/Chicago/Cincinnati markets ahead of active rotation, offsets Apify/Yelp away from Maps, marks Apify market runs, rotates Apify niches, and reports city/source concentration in scorecards and V2 audit exports.
- 2026-05-14: Freight/trucking targeting was removed from active lead and lender discovery. Existing lender category types remain for historical records, but freight/logistics is no longer an active growth path.
- 2026-05-14: Heavy lender cron routes were removed from `vercel.json`, lender autopilot was paused in partner send automation, and funding recommendation lender-match persistence is behind `ENABLE_LENDER_MATCH_PERSISTENCE`.
- 2026-05-14: Public service request queueing now avoids eagerly importing the direct lead automation workflow unless Inngest is unavailable or queueing fails.
- SEO/AEO automation now has a 10-part visibility requirement scorecard: `npm run visibility:aeo-scorecard`. Use it before claiming ChatGPT/search visibility work covers answer pages, proof pages, comparison pages, best-for pages, crawler basics, off-site entity repetition, indexing, prompt tests, and safe claims.
- Visibility indexing now has a guarded script and cron route: `npm run visibility:indexing-dry-run`, `npm run visibility:indexing-push`, and `/api/cron/visibility-indexing-push`. It submits the sitemap to Google Search Console, inspects priority URLs when credentials exist, and submits priority URLs to IndexNow/Bing when configured.
- Entity SEO expansion now has proactive city/service rotation for AI Receptionist, Search Visibility, DealVault, and Funding Prep. Start with `lib/content/entitySeoExpansion.ts` and `docs/VESTBLOCK_ENTITY_SEO_EXPANSION.md`; dry-run with `/api/cron/entity-seo-expansion?dryRun=true&proactiveCityLimit=6`.
- Daily learning loop baseline was added on 2026-05-13: visibility is `100/100`; outreach bottleneck is `qualified_pool_exhausted`, with `0` production send-ready messages and `803` leads excluded by production rules.
- Production build/deploy passed on 2026-05-13.
- 2026-05-14: Added the VestBlock Agent Board so whole-site optimization starts with named owners for revenue, conversion, design, visibility, outreach, DealVault, funding, performance, security, and sales assets.
- 2026-05-14: Added `/admin/revenue-command`, a read-only Revenue Command Center that combines revenue, outreach, visibility, ops, and the 10 reusable operating capabilities into one admin cockpit.

## Fast Triage Checklist

- Is this public website/copy/design? Start with public route/component files only.
- Is this outreach? Read current V4 artifacts first, then run `npm run outreach:v4-workflow`, `npm run outreach:v4-approve -- --limit=50`, `npm run outreach:v4-send-approved -- --limit=50`, and only use live send when the V4 guardrails pass.
- Is this live-send related? Check Vercel env drift before editing code.
- Is this DealVault? Run the demo/verifier commands before changing broad app code.
- Is this deployment? Use `npx vercel@latest ...`, not the broken Homebrew binary.
- Is this a safety-sensitive action? Stop and get explicit approval before live sends, paid chain txs, or charges.
