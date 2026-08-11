# VestBlock Unified Release-Candidate Audit

Status: Phase 0 evidence baseline
Audit date: 2026-08-11
Authoritative host: `vestblock-pro`
Repository: `/Users/mrsanders/VestBlock Codex Sync/Codex Folder`
Baseline commit: `ad1312f8b8b261288a4241850df86ef7db25dce6`
Release-candidate branch: `codex/vestblock-unified-release-candidate`

## Scope and safety boundary

This audit records the required evidence before source changes begin. It covers the public customer journey, design system, language, motion, mobile behavior, authentication, payment flow, service-backed APIs, analytics, monitoring, automation gates, the Strategy Brain, and the Obsidian export.

The release-candidate operation may change and test code on the branch. It must not deploy to production, rotate production credentials, send live outreach, publish content, spend advertising funds, charge or refund a customer, mutate production data, or perform a destructive database change without a separate approval.

Assumptions for this review:

- VestBlock is an internet-facing, multi-user financial and real-estate platform.
- Supabase contains customer, lead, partner, deal, payment, and strategy data.
- `www.vestblock.io` is the intended canonical host because metadata and sitemap generation already use it.
- Only an authenticated VestBlock operator may write internal deal memory or execute a strategy.
- Strategy generation may prepare work, but launches, sends, publishing, spend, and destructive actions require explicit human approval.

## Baseline verification

The Mac Pro release-candidate branch was clean at the baseline commit. Before changes:

- `pnpm run typecheck` passed.
- `pnpm run test:autopilot-strategy` passed.
- `pnpm run test:obsidian-vault` passed.
- The local smoke command could not run because no local server was listening on port 3000; all five failures were `ERR_CONNECTION_REFUSED`, not application assertions.
- Public route probes returned HTTP 200 for the reviewed pages.
- Both `vestblock.io` and `www.vestblock.io` returned 200 instead of redirecting to one canonical host.

## Customer-experience findings

### Critical visual and motion problems

- The home hero uses a full-screen WebGL canvas behind the primary copy. Continuous bobbing, rotation, pulsing, orbiting, and particles compete with the decision content and make the VB mark appear to float (`components/hero-section.tsx`, `components/vestblock-command-scene.tsx`).
- At 1440 px the canvas measured approximately 1440 by 836; at 390 px it measured approximately 390 by 1040. The mobile composition overlaps the reading path instead of placing the mark in a stable branded position.
- The live experience splits into two visual systems: the intended graphite/ivory/electric-lime system and legacy cyan/purple gradients, glows, grids, tickers, and border beams in DealVault and `app/globals.css`.

### Information architecture and language

- Home and pathway copy exposes internal implementation language such as “machinery,” “engine,” “workflow,” “systems,” “existing workflow,” and “rebrand.” Customer copy should describe actions, evidence, decisions, and outcomes.
- Capital, Deals, and Opportunities share an almost identical sparse template and do not explain their different customers, inputs, proof, process, or next steps.
- Get Started is a seven-card directory that extends to roughly 5,319 px on mobile instead of acting as a short decision path.
- DealVault extends to roughly 10,540 px on mobile. Its first overflow begins in the live-contract cards; at a 390 px viewport, the page measured approximately 467 px wide.
- Trust evidence appears too late in important journeys.
- Login and registration lack a page-level H1. Login also nests an interactive button inside a link.
- Several mobile controls are only 36–40 px tall rather than the 44 px minimum target.

### Journey inconsistencies

- Get Started says no account is needed while some Capital and Opportunity actions redirect directly to login.
- DealVault’s dense contract, inventory, proof, demo, and long-form intake presentation obscures the primary decision.
- The VB mark is being used as ambient decoration rather than a consistent identity anchor.

## Backend, authorization, and integration findings

### Critical: exposed PostHog personal key and nonfunctional analytics

Masked environment inspection showed that `NEXT_PUBLIC_POSTHOG_KEY` and `POSTHOG_API_KEY` contain the same `phx_` personal API key. The browser provider exposes the public value, the server prefers the private-looking value, and a read-only config probe returned HTTP 404 (`components/providers/posthog-provider.tsx`, `lib/analytics/server.ts`, `app/api/health/route.ts`).

Required release control:

- Reject personal/secret key prefixes in ingestion configuration.
- Use only a PostHog project token in browser and server event capture.
- Distinguish `disabled`, `misconfigured`, `configured`, and verified health.
- Rotate the exposed production credential and set the correct project token as a separately approved production operation.

### Critical: mutable profile role and entitlement fields

The versioned Supabase policy permits users to update their own `user_profiles` row, which includes `role`, `is_subscribed`, and PayPal entitlement fields (`db/migrations/000-FULL-SETUP.sql`). Middleware and server admin checks trust `user_profiles.role === 'admin'` (`middleware.ts`, `lib/auth/admin.ts`).

Required release control:

- Do not authorize administrators from a client-editable profile field.
- Use configured administrator identities and trusted auth app metadata.
- Add a reviewed migration that prevents authenticated clients from changing privileged role, subscription, or payment columns.
- Add a regression test for privilege escalation.

### High: payment identity, product, and amount are not bound

Create-order and capture-order accept `userId`, `productType`, and `requestId` from the caller. Capture can select a product independently of the original PayPal order, allowing a lower-priced order to be interpreted as a higher-priced entitlement (`app/api/create-order/route.ts`, `app/api/capture-order/route.ts`, `lib/payments/products.ts`).

Required release control:

- Require an authenticated session and derive user identity server-side.
- Bind the PayPal order to user, product, request, currency, and expected amount.
- Fetch and verify the order before capture; reject every mismatch.
- Never accept a capture-time product override.
- Treat provider transaction IDs idempotently.

### High: public cost and privileged-write surfaces

Several public routes can call paid AI/PDF services or use the Supabase service role under caller-controlled identities: `generate-roadmap`, `generate-letter`, `side-hustle-chat`, `generate-pdf`, and `biz-credit`. There is no repository-wide API rate limiter.

The public property analyzer also accepts `persistToCommandCenter`, `analysisSource`, and an arbitrary `leadId`, enabling anonymous writes into internal deal memory.

Required release control:

- Use one authenticated user/entitlement guard for account-specific and paid routes.
- Derive identity and source on the server.
- Add per-user and per-IP budgets, payload limits, timeouts, and cost ceilings.
- Keep public analysis read-only; require operator authorization for internal persistence.

### High: automation gates fail open

Buyer and lender automation default live sending to enabled when their environment variables are absent (`lib/buyers/automation.ts`, `lib/lenders/automation.ts`). Entity SEO also defaults toward publishing.

Required release control: missing configuration must mean draft-only. Sending, publishing, spend, deployment, and destructive actions need a separate explicit live-action gate and a recorded approval.

### Other integration and security gaps

- Cookie-authenticated mutations do not consistently enforce same-origin checks.
- A DealMachine status route may disclose stored payload details when data exists; downloaded webhook URLs need destination and size limits.
- Sentry credentials exist, but the Next.js SDK, configuration, and instrumentation are absent.
- Production CSP permits broad `https:` sources and inline scripts.
- Security tests do not yet cover payment binding, privilege escalation, CSRF, rate limits, or service-role surfaces.

Controls confirmed working include server-only Supabase service-role construction, 401 responses for sampled protected routes, fail-closed cron authorization, PayPal/Resend/DealMachine webhook verification, the disabled-by-default legacy payment route, and DNS/redirect-aware site-preview SSRF checks.

## Strategy Brain findings

### Fragmented strategy model

The repository contains three separate strategy mechanisms:

- `lib/autopilot/strategyEngine.ts` mixes acquisition channels with business verticals.
- `lib/autopilot/repository.ts` emits three fixed candidates.
- `bossAgent.ts` and `autonomousOperatingCore.ts` contain separate static play batches.

The Command Center consequently emphasizes the seller lane and cannot reliably compare all VestBlock businesses on one evidence model.

### Production evidence snapshot

Read-only aggregate inspection found:

- 0 stored `vestblock_strategy` records and 0 strategy experiments.
- 3,179 strategy runs: 2,315 planned, 264 awaiting contacts, 492 blocked, 51 completed, 15 dry-run, and 1 drafted.
- 8,942 leads, including 5,850 marked contacted and 6 replies.
- 708 buyers, 198 lenders, 81 buyer matches, and 0 lender matches.
- 0 funding profiles or recommendations.
- 46 DealVault deals, 36 proof records, and 19 milestones.
- 364 content assets marked published, with index status unknown.
- The Obsidian export is operational, but it exports 0 strategies, 0 experiments, 250 campaign rows, and 364 content rows.

### Learning-loop defects

- `selfImprovement.ts` writes `run_id: null` and severity `warning`, while the schema requires a non-null run ID and the enum `info | watch | action`; insert errors are ignored.
- Inbound attribution exists, but some operating loops hard-code replies to zero.
- Schema/status drift prevents a dependable feedback loop.

### Required unified vertical registry

The Strategy Brain must keep business vertical, acquisition channel, and strategy type as separate concepts. The authoritative registry is:

1. `business_capital`
2. `real_estate_capital`
3. `capital_partners`
4. `seller_opportunities`
5. `buyers_investors`
6. `development_partners`
7. `opportunity_service_partners`
8. `dealvault`
9. `growth_visibility_services`

Each vertical needs a plain-language offer, ICP and decision-maker, customer problem and buying moment, triggers, qualifications and disqualifiers, approved proof and claim limitations, offer ladder, primary and secondary CTA, lawful lead sources and provenance requirements, channel mix, content pillars, outreach angles, objections, KPIs, cost boundaries, suppression/compliance rules, approval mode, and kill criteria.

Only the top-scoring focus and challenger should be promoted at once. Weak evidence must create a research task, not an invented claim or launch plan. Every generated strategy remains draft-only until approved.

## Release-candidate acceptance criteria

The branch is not release-ready until it demonstrates:

- One graphite/ivory/electric-lime visual system with a stable VB identity treatment.
- Reduced and accessible motion, no mobile canvas collision, no horizontal overflow, and 44 px interactive targets.
- Customer language that explains actions, inputs, proof, outcomes, and next steps.
- Differentiated Capital, Deals, Opportunities, and DealVault journeys.
- Valid semantic headings and interactive markup on the auth journey.
- Fail-closed analytics, automation, persistence, admin, and payment controls.
- A nine-vertical Strategy Brain with evidence states, focus/challenger selection, human approval, attribution hooks, cost boundaries, and research-required behavior.
- PII-safe Obsidian exports.
- Passing type, focused unit, browser, route, and production-build verification.
- A reviewed rollback plan and a non-production preview. Production promotion remains a separate approval.
