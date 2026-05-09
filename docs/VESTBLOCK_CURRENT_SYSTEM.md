# VestBlock Current System

Last updated: 2026-05-09

This document is the current source of truth for the VestBlock repo organization sprint. It separates the working product surface from experimental code, generated output, docs, migrations, tests, and follow-up cleanup.

## Executive Snapshot

VestBlock is a Next.js App Router SaaS with public marketing pages, authenticated credit/funding tools, DealVault smart-contract-backed records, admin dashboards, lead/outreach automation, PR/SEO automation, Supabase as the application database, and Vercel deployment.

Current repo state is a large in-progress worktree, not a small patch. The latest status scan showed roughly 447 changed, deleted, or untracked entries. That is expected from recent feature sprints, but it should be committed in logical groups instead of one giant commit.

Latest cleanup decision: do not remove PostHog right now. Sentry and OpenTelemetry are not wired into the app, but PostHog is actively used for payments, lead capture, chat, upload, dashboard usage, and the health endpoint. Removing it would reduce our ability to see whether the revenue funnel is working.

## What VestBlock Currently Sells

- DealVault and smart contract-backed recordkeeping for agreements, proof records, partner splits, referral payout tracking, and milestone tracking.
- Business funding prep and funding strategy support.
- AI/search visibility services for businesses that need better discovery in search and answer engines.
- Website and AI receptionist/booking support for service businesses.
- Credit, dispute-letter, grant, and business credit tools where they still support the funding journey.

## Main Public Routes

Keep these as buyer-facing routes unless a future product decision changes them.

- `/`
- `/services`
- `/pricing`
- `/dealvault`
- `/dealvault/demo`
- `/smart-contracts`
- `/visibility-expansion`
- `/ai-assistant`
- `/get-started`
- `/funding`
- `/funding/business-funding-strategy`
- `/real-estate-funding`
- `/real-estate-funding/thanks`
- `/sell`
- `/business-setup`
- `/learn`
- `/learn/[slug]`
- `/resources/[slug]`
- `/services/[slug]`
- `/services/financial-growth`
- `/services/credit-card-stacking-strategy`
- `/es/vestblock`

## Main App And Dashboard Routes

These should stay authenticated or role-gated as appropriate.

- `/dashboard`
- `/dashboard/dealvault`
- `/dashboard/dealvault/new`
- `/dashboard/dealvault/[dealId]`
- `/dashboard/dealvault/proof-vault`
- `/dashboard/dealvault/partner-pay`
- `/dashboard/dealvault/milestone-vault`
- `/dashboard/funding`
- `/dashboard/services`
- `/credit-upload`
- `/credit-dashboard/[reportId]`
- `/tools/business-credit`
- `/tools/dispute-letters`
- `/tools/grants`
- `/tools/my-dispute-letters`
- `/tools/upload-report`
- `/chat`
- `/profile`
- `/roadmap`
- `/user-hub`

## Admin And Internal Tools

Keep these, but treat them as internal operations surfaces. They should not be indexed or reachable by anonymous visitors.

- `/admin`
- `/admin-panel`
- `/admin/leads`
- `/admin/lead-sources`
- `/admin/lenders`
- `/admin/buyers`
- `/admin/market-expansion`
- `/admin/pr-engine`
- `/admin/research`
- `/admin/scrape-runs`
- `/admin/seo-opportunities`
- `/admin/funding`
- `/admin/dealvault`
- `/admin/blockchain`
- `/admin/improvement`
- `/admin/reports/daily`
- `/admin/test`

## DealVault Status

DealVault is a working module with public and dashboard routes, API routes, Supabase-backed records, certificate/PDF generation, and smart contract proof-layer support.

The primary buyer demo funnel is now `/dealvault/demo`. Main homepage, services, pricing, smart contracts, DealVault, nav, and footer CTAs should send prospects there when the next step is to understand the product or request a demo.

Important boundaries:

- Supabase remains the app database.
- Blockchain is used as proof/audit/event-record tooling.
- Raw private documents, full contracts, raw property addresses, private keys, and sensitive personal data should not be sent on-chain.
- Tokenized real estate ownership, fractional ownership sales, escrow, custody, and real fund movement are not approved MVP behavior.

Relevant source areas:

- `app/dealvault/`
- `app/dashboard/dealvault/`
- `app/api/dealvault/`
- `components/dealvault/`
- `lib/dealvault/`
- `lib/blockchain/`
- `public/dealvault/`
- `docs/DEALVAULT_*.md`

Current release gate:

- `npm run check:app` for TypeScript plus production Next.js build.
- `npm run check:contracts` for Solidity compile plus contract tests.
- `npm run check:release` for both app and contract checks before a serious production deploy.
- `npm run clean:local` to remove generated local build/cache output after QA.

Tooling baseline: this workspace now targets Node 22 LTS through `.nvmrc` and `.node-version`. Hardhat compile and tests should be run on Node 22 before production contract deployment or live-chain testing.

## Smart Contract Status

Smart contracts are present with Hardhat scripts and tests. The current smart contract lane should remain proof/audit focused.

Relevant source areas:

- `contracts/`
- `hardhat.config.ts`
- `test/DealVaultRealEstate.test.ts`
- `test/MilestoneVault.test.ts`
- `test/PartnerPay.test.ts`
- `test/ProofVault.test.ts`
- `scripts/checkDealVaultDeployReadiness.ts`
- `scripts/deployDealVault.ts`
- `scripts/estimateDealVaultProofGas.ts`
- `scripts/liveTestDealVaultProof.ts`
- `scripts/smokeDealVault.ts`
- `scripts/verifyDealVaultUiFlow.mjs`
- `deployments/`

Do not run paid live-chain actions unless explicitly approved in the active thread.

## Lead And Outreach Automation Status

The lead/outreach system includes discovery, scoring, enrichment, outreach draft generation, send queues, follow-up, lenders, buyers, PR engine, market expansion, daily reporting, and deliverability guardrails.

Relevant source areas:

- `app/api/cron/`
- `app/api/leads/`
- `app/api/lenders/`
- `app/api/buyers/`
- `app/api/admin/leads/`
- `app/api/admin/lenders/`
- `app/api/admin/buyers/`
- `app/api/admin/pr-engine/`
- `lib/leads/`
- `lib/lenders/`
- `lib/buyers/`
- `lib/pr/`
- `lib/outreach/`
- `lib/reporting/`
- `lib/improvement/`
- `lib/content/`
- `docs/VESTBLOCK_OUTREACH_SYSTEM.md`
- `docs/VESTBLOCK_LEAD_INTELLIGENCE_README.md`
- `docs/VESTBLOCK_LENDER_AUTOMATION.md`
- `docs/VESTBLOCK_BUYER_AUTOMATION.md`

Recent cleanup changed the send queue so no-email/contact-form-only leads are routed to manual work instead of being counted as email-send candidates.

Recent revenue-funnel cleanup also added campaign allocation, message-quality blocking, provider-failure stop thresholds, and primary-campaign prioritization so email volume does not crowd out better-fit prospects.

## Payment And Checkout Status

Payments and product definitions exist, but product naming and checkout labels should remain under review until the offer ladder is simplified.

Relevant source areas:

- `lib/payments/products.ts`
- `app/api/create-order/route.ts`
- `app/api/capture-order/route.ts`
- `app/api/process-payment/route.ts`
- `app/api/paypal-webhook/route.ts`
- `lib/paypal/`

Production rule: do not charge real payment methods during cleanup or QA unless explicitly approved.

## Database And Migration Status

Supabase is the primary application database. Migrations are present for funding assistant, service deliverables, lead intelligence, lender/buyer networks, daily intelligence, partner portal, SAM intelligence, PR engine, chat/doc foundations, and DealVault-related tables.

Relevant source areas:

- `db/migrations/`
- `supabase/`
- `types/supabase.ts`
- `lib/supabase/`

Migration files should be committed in order and not renamed casually.

## Active Codex Automations

VestBlock automations:

- `vestblock-daily-site-qa`
- `vestblock-lead-quality-sweep`
- `vestblock-pr-seo-finder`
- `dealvault-smart-contract-health`
- `vestblock-offer-revenue-audit`
- `vestblock-outreach-scorecard`
- `vestblock-revenue-command-center`
- `vestblock-reply-inbox-triage`
- `vestblock-lead-source-roi-tracker`
- `vestblock-dealvault-target-builder`
- `vestblock-no-email-lead-export`
- `vestblock-weekly-offer-cleanup`
- `vestblock-smart-contract-trust-proof-builder`
- `vestblock-pr-pitch-generator`
- `vestblock-abandoned-follow-up`
- `vestblock-deliverability-guardrail`

Non-VestBlock automations also exist for the ShoeGlitch workspace and should not be confused with VestBlock production operations.

## Debug And Internal Route Protection

Already protected by `middleware.ts` as admin-only or authenticated routes:

- `/auth-debug`
- `/credit-report-debug`
- `/credit-report-diagnostic`
- `/database-diagnostic`
- `/debug-analyzer`
- `/setup-database`
- `/test-analysis-debug`
- `/test-document-analysis`
- `/test-openai-simple`
- `/test-streaming`
- `/test-upload`
- `/test-upload-simple`
- `/admin`
- `/admin-panel`

Protected diagnostic APIs:

- `/api/execute-sql`
- `/api/run-db-setup`
- `/api/setup-database`
- `/api/test-analysis`
- `/api/test-formdata`
- `/api/test-openai`
- `/api/test-openai-connection`
- `/api/test-openai-simple`
- `/api/test-streaming`
- `/api/analyze-credit-direct`
- `/api/analyze-pdf-direct`
- `/api/background-analyzer`

The last three were added during this organization sprint because they are costly or internal analysis routes and should not accept anonymous direct requests.

Left public intentionally:

- `/business-setup` because it is a buyer-facing funding-prep page.
- `/affiliates/register` and `/affiliates/application-pending` because they are public partner/application flows.
- `/partners/[partnerKey]/apply` because it is a partner intake path.
- `/partners/buyers/[token]` and `/partners/lenders/[token]` because they are tokenized portal views.

## Repo Cleanup Buckets

Keep:

- Production app routes, shared UI, dashboard routes, API routes, Supabase migrations, DealVault, contracts, lead automation, admin tools, funding/credit tools, and revenue docs.
- `.agents/skills/vestblock/` because these are local operating instructions for the Codex growth/QA automations. They are not customer-facing app code.

Archive:

- Older sprint notes, dated prospect lists, and historical handoff docs that are useful for memory but not active release guidance. Use `docs/archive/` for this instead of deleting.

Delete or ignore:

- Generated build output such as `.next/`, `node_modules/`, `tsconfig.tsbuildinfo`, cache folders, local artifacts, and one-off automation result JSON files. These should not be committed.

Review with Rob:

- Any broad folder removal from `app/`, `components/`, `lib/`, `db/`, `contracts/`, `scripts/`, or `public/`. Too much active work now depends on these areas to delete casually.

## Keep / Archive / Delete / Review

KEEP:

- Public website and sales routes.
- DealVault routes, APIs, components, blockchain libraries, contracts, tests, and deployment metadata.
- Admin dashboards and operational tools.
- Lead/outreach automation and PR/SEO automation modules.
- Funding, credit, grants, dispute-letter, and business credit tools that support the current revenue ladder.
- Supabase migrations, database types, and core auth/access helpers.
- Tests, smoke scripts, and DealVault QA scripts.
- `.agents/skills/vestblock/` because these are useful operating playbooks for future Codex runs.

ARCHIVE:

- One-off prompt and handoff docs after their active content is copied into this source-of-truth doc or a current runbook.
- Candidates include:
- `docs/archive/APIFY_ATLAS_HANDOFF_PROMPT.md`
- `docs/archive/SAAS_CONVERSION_PROMPT.md`
- `docs/archive/SMALL_BUSINESS_TEMPLATE_SPRINT_PROMPT.md`
- `docs/archive/VESTBLOCK_AI_REVENUE_ENGINE_PROMPT.md`
- `docs/archive/VESTBLOCK_SAAS_GROWTH_OS_PROMPT.md`
- `docs/archive/DEALVAULT_LLAMA_HANDOFF.md`

DELETE / IGNORE:

- `artifacts/`
- `cache/`
- `automation-run-results.json`
- `.next/`
- `out/`
- `build/`
- TypeScript build info and package-manager debug logs

During this sprint, `artifacts/`, `cache/`, and `automation-run-results.json` were ignored and removed locally because they are generated output.

REVIEW WITH ROB:

- `vendor/` before deleting or committing because it may contain imported source from the original standalone build.
- `deployments/*.json` before publishing broadly because they are useful contract metadata but should be checked for sensitive or stale network details.
- Legacy/deleted files shown in git status, especially `app/api/analyze-report/route.ts`, `components/enhanced-credit-analyzer-client.tsx`, and `components/enhanced-credit-analyzer.tsx`.
- Public service overlap between funding prep, business setup, funding assistant, financial growth services, and credit tools.
- Any route that still has "test", "debug", or "diagnostic" in its name should eventually move under `/admin` or be removed after replacement.

## Suggested Commit Groups

Do not make one giant commit. Use these groups. For the current exact dirty-worktree file list, use `docs/VESTBLOCK_COMMIT_GROUPS.md`.

1. Public website and services:

- `app/page.tsx`
- `app/layout.tsx`
- `app/pricing/`
- `app/services/`
- `app/dealvault/`
- `app/smart-contracts/`
- `app/visibility-expansion/`
- `app/ai-assistant/`
- `app/get-started/`
- `app/funding/`
- `app/real-estate-funding/`
- `app/sell/`
- `app/business-setup/`
- `components/marketing/`
- `components/hero-section.tsx`
- `components/service-cards.tsx`
- `components/cta-footer.tsx`
- `components/navigation.tsx`
- `components/metrics-section.tsx`
- `lib/seo/`
- `lib/aeo/`

2. DealVault and smart contracts:

- `app/dashboard/dealvault/`
- `app/api/dealvault/`
- `components/dealvault/`
- `lib/dealvault/`
- `lib/blockchain/`
- `contracts/`
- `hardhat.config.ts`
- `deployments/`
- `public/dealvault/`
- `scripts/checkDealVaultDeployReadiness.ts`
- `scripts/copyAbis.ts`
- `scripts/deployDealVault.ts`
- `scripts/diagnoseMilestoneMainnet.ts`
- `scripts/estimateDealVaultProofGas.ts`
- `scripts/liveTestDealVaultProof.ts`
- `scripts/smokeDealVault.ts`
- `scripts/verifyDealVaultUiFlow.mjs`
- `test/DealVaultRealEstate.test.ts`
- `test/MilestoneVault.test.ts`
- `test/PartnerPay.test.ts`
- `test/ProofVault.test.ts`
- `docs/DEALVAULT_*.md`

3. Lead, outreach, PR, and automation:

- `app/api/cron/`
- `app/api/leads/`
- `app/api/lenders/`
- `app/api/buyers/`
- `app/api/admin/leads/`
- `app/api/admin/lenders/`
- `app/api/admin/buyers/`
- `app/api/admin/markets/`
- `app/api/admin/pr-engine/`
- `app/admin/leads/`
- `app/admin/lenders/`
- `app/admin/buyers/`
- `app/admin/market-expansion/`
- `app/admin/pr-engine/`
- `app/admin/research/`
- `app/admin/scrape-runs/`
- `app/admin/seo-opportunities/`
- `lib/leads/`
- `lib/lenders/`
- `lib/buyers/`
- `lib/pr/`
- `lib/outreach/`
- `lib/reporting/`
- `lib/improvement/`
- `lib/content/`
- `lib/email/`
- `docs/VESTBLOCK_*AUTOMATION*.md`
- `docs/VESTBLOCK_OUTREACH_SYSTEM.md`
- `.agents/skills/vestblock/`

4. Admin dashboards and internal tools:

- `app/admin/`
- `app/admin-panel/`
- `components/admin/`
- `lib/admin/`
- `components/workspace-activity-panel.tsx`
- `components/access-status-card.tsx`

5. Funding and credit tools:

- `app/credit-upload/`
- `app/credit-dashboard/`
- `app/tools/`
- `app/super-dispute/`
- `app/roadmap/`
- `app/user-hub/`
- `app/api/biz-credit/`
- `app/api/dispute-letters/`
- `app/api/funding/`
- `app/api/funding-lead/`
- `app/api/funding-strategy/`
- `app/api/generate-letter/`
- `app/api/generate-pdf/`
- `app/api/generate-roadmap/`
- `app/api/grants/`
- `app/api/upload-credit-report/`
- `components/credit-boost-pack.tsx`
- `components/credit-tools-section.tsx`
- `components/funding-*.tsx`
- `components/*credit*.tsx`
- `lib/credit/`
- `lib/funding/`
- `lib/grants/`
- `lib/letters/`
- `lib/pdf/`
- `lib/workflows/`
- `lib/bizcredit/`

6. Database migrations and types:

- `db/migrations/`
- `supabase/`
- `types/supabase.ts`
- `lib/supabase/`

7. Docs, QA, and security:

- `docs/`
- `tests/`
- `test/`
- `playwright.config.ts`
- `docs/VESTBLOCK_CURRENT_SYSTEM.md`
- `docs/VESTBLOCK_EXTERNAL_AUDIT_READINESS.md`
- `docs/VESTBLOCK_PRODUCTION_READINESS.md`
- `docs/ENV_VARS_REQUIRED.md`

8. Cleanup and platform config:

- `.gitignore`
- `middleware.ts`
- `package.json`
- `pnpm-lock.yaml`
- `tsconfig.json`
- `vercel.json`
- `components/ui/`
- `contexts/auth-context.tsx`
- `lib/auth/`
- `lib/system/`

## Known Risks And Blockers

- The worktree is too large to review as one diff.
- Funding/product offer packaging still overlaps and should be simplified.
- Some legacy debug/test routes remain in the route tree, even though middleware protects them.
- Direct credit analysis and background analysis APIs were protected in middleware during this sprint, but the older analysis stack still needs a deeper security and auth review.
- Vercel deploys skip lint and type validation in the remote build, so local checks must stay part of the release routine.
- Smart contract live transactions should remain explicitly approved and low-cost only.

## Production Ready Vs Experimental

Production-ready or near-ready:

- Public marketing pages after recent copy/design passes.
- DealVault public page and dashboard foundations.
- Smart contract metadata and proof/audit positioning.
- Lead/outreach pipeline with new scorecards and guardrails.
- Admin dashboards for operational visibility.
- Funding and credit tools where already authenticated and tested.

Experimental or needs review:

- Legacy diagnostic/test pages.
- Older direct analyzer APIs.
- Some funding and financial service offer overlap.
- Vendor/imported standalone code.
- Large uncommitted automation expansions that need grouped review.

## Exact Next Cleanup Steps

1. Commit the current cleanup and protection changes separately from feature work.
2. Review `vendor/` and decide whether to keep, archive, or delete it.
3. Move old prompt/handoff docs into `docs/archive/` after confirming no active doc links depend on them.
4. Move surviving debug/test pages under `/admin` or remove them after replacement.
5. Commit the repo in the suggested groups above.
6. Run full checks after each commit group: targeted lint, `corepack pnpm typecheck`, and `corepack pnpm build`.
7. Deploy only after the grouped commits build cleanly.
