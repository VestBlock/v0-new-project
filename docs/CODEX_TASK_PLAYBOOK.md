# Codex Task Playbook

Last updated: 2026-05-19

Use this with `docs/CODEX_FAST_CONTEXT.md`. The point is to start from the likely files, not rediscover the whole repo.

## Do Not Start Here

- Do not scan all `app/` first.
- Do not run full `rg outreach` unless targeted files fail.
- Do not re-review archived docs unless the user asks.
- Do not inspect admin/dashboard code for public marketing copy tasks.
- Do not run live email sends, blockchain transactions, or payments unless explicitly approved.

## If Outreach Is Broken

Use these skills first:

- `.agents/skills/vestblock/compliant-outreach-operations.md`
- `.agents/skills/vestblock/signal-based-outbound-operator.md`
- `.agents/skills/vestblock/outreach-optimization.md`

If Rob asks to stop patching the old loop, start with the V4 rebuild:

- `docs/OUTREACH_V4_REBUILD.md`
- `lib/leads/outreach-v4/`
- `scripts/outreach-v4-dry-run.mjs`
- `scripts/outreach-v4-scorecard.mjs`
- `scripts/outreach-v4-approve-drafts.mjs`
- `scripts/outreach-v4-send-approved.mjs`
- `scripts/outreach-v4-workflow.mjs`

V4 is the active automation path. It discovers, enriches, scores, quarantines, drafts, approves, and sends through the off-platform operator scripts. Live sends must use `scripts/outreach-v4-send-approved.mjs` only after preview guardrails pass.

Rob's current outreach preference is real estate first. Prioritize `real_estate_partners` and `contractors_home_services` before `ai_receptionist`; use `no_website`, `weak_website`, and generic DealVault only as fallback lanes unless Rob asks for them. For real estate, do not lead with DealVault. Lead with partnership discovery: buyer buy box, lender criteria, seller-side buyer matching, contractor referral fit, and VestBlock SEO/search lead flow.

Start with commands:

- `npm run outreach:v4-workflow`
- `npm run outreach:v4-scorecard`
- `npm run outreach:v4-approve -- --limit=50`
- `npm run outreach:v4-send-approved -- --limit=50`
- `npm run outreach:v4-send-approved:live -- --limit=50`

Then inspect:

- `lib/leads/outreach-v4/`
- `artifacts/outreach-v4/<date>/outreach-v4-scorecard.json`
- `artifacts/outreach-v4/<date>/approved-drafts.json`
- `artifacts/outreach-v4/<date>/send-results.json`
- `artifacts/outreach-v4/sent-ledger.jsonl`
- `artifacts/outreach-v4/<date>/quarantine.csv`
- `docs/OUTREACH_V4_REBUILD.md`

Common failure patterns:

- `sent` is below 50: expand V4 real-source adapters and enrichment, do not lower scoring.
- `sent` is above 50: stop all sends for the day, inspect `artifacts/outreach-v4/sent-ledger.jsonl`, confirm the live sender command did not include multiple conflicting `--limit` values, and verify the package script does not hardcode a limit.
- `approved-drafts.json` is missing but `accepted-leads.csv` has `draft_ready`: rerun `npm run outreach:v4-approve -- --limit=50`; the approval script can recover drafts from accepted leads.
- `readyGapToTarget` is above zero: increase fresh V4 market/source volume before any send.
- `missing_mailing_address`: set `OUTREACH_MAILING_ADDRESS` in Vercel production and redeploy.
- `already_sent_in_v4_ledger`: expected duplicate protection from `artifacts/outreach-v4/sent-ledger.jsonl`; do not bypass it.
- Many quarantined leads: fix source quality/enrichment, not send rules.
- Legacy outreach crons are removed, not paused behind `ENABLE_LEGACY_OUTREACH_CRONS`; do not re-enable or recreate them for daily work.

## If Lead Count Is Low

Use these skills first:

- `.agents/skills/vestblock/growth-automation-operator.md`
- `.agents/skills/vestblock/market-expansion-operator.md`
- `.agents/skills/vestblock/market-learning-loop.md`
- `.agents/skills/vestblock/lead-intelligence-operator.md`

Start with:

- `npm run outreach:v4-workflow`
- `npm run outreach:v4-scorecard`
- `npm run outreach:v4-approve -- --limit=50`
- `npm run outreach:v4-send-approved -- --limit=50`

Then inspect:

- `lib/leads/outreach-v4/source-adapters.mjs`
- `lib/leads/outreach-v4/enrichment.mjs`
- `lib/leads/outreach-v4/market-rotation.mjs`
- `lib/leads/outreach-v4/scoring.mjs`
- `artifacts/outreach-v4/<date>/quarantine.csv`

Best next action is usually source quality or enrichment. Do not lower send guardrails just to hit volume.

Do not run V2 audits, old source refill, old throughput, or old send-control unless Rob explicitly asks to inspect legacy behavior.

## If Vercel Deployment Fails

Start with:

- `.vercel/project.json`
- `vercel.json`
- `package.json`
- `npm run typecheck`
- `npm run build`

Use:

- `npx vercel@latest whoami`
- `npx vercel@latest deploy --prod --yes`

Avoid the Homebrew `vercel` binary if it fails with `libsimdutf`. Use `npx vercel@latest`.

If production behaves differently than local, compare env presence in Vercel versus `.env.local` without printing secret values.

## If Website Copy Or Design Needs Work

Use these skills first:

- `.agents/skills/vestblock/agent-board-orchestrator.md`
- `.agents/skills/vestblock/agentic-conversion-operator.md`
- `.agents/skills/vestblock/analytics-conversion-operator.md`
- `.agents/skills/vestblock/website-weakness-audit.md`
- `.agents/skills/vestblock/compliance-safe-credit-content.md`

Start with public pages/components:

- `app/page.tsx`
- `components/hero-section.tsx`
- `components/service-cards.tsx`
- `components/pricing-section.tsx`
- `components/navigation.tsx`
- `app/services/page.tsx`
- `app/pricing/page.tsx`
- `app/dealvault/page.tsx`
- `app/smart-contracts/page.tsx`
- `components/visibility-expansion-page.tsx`
- `app/ai-assistant/page.tsx`
- `app/get-started/page.tsx`
- `app/learn/page.tsx`
- `app/learn/[slug]/page.tsx`
- `lib/aeo/topics.ts`
- `lib/seo/serviceSeoPages.ts`

Do not start in admin/dashboard unless public users can see the copy.

For whole-site optimization, read `docs/VESTBLOCK_AGENT_BOARD.md` and assign directors before editing.

Verification:

- Targeted `npx eslint <changed files>`
- `npm run typecheck`
- `npm run build` if route/shared components changed

## If DealVault Breaks

Use these skills first:

- `.agents/skills/vestblock/dealvault-revenue-operator.md`
- `.agents/skills/vestblock/production-launch-verification.md`
- `.agents/skills/vestblock/security-privacy-audit.md`

Start with:

- `app/dealvault/`
- `app/dashboard/dealvault/`
- `app/api/dealvault/`
- `lib/dealvault/`
- `components/dealvault/`
- `scripts/createDealVaultDemoPackage.ts`
- `scripts/verifyDealVaultUiFlow.mjs`

Commands:

- `npm run demo:dealvault`
- `npm run verify:dealvault:ui`
- `npm run typecheck`
- `npm run build`

Keep raw sensitive deal data off-chain. Use hashes, IDs, statuses, timestamps, and references.

## If Smart Contract Proof Breaks

Start with:

- `contracts/`
- `hardhat.config.ts`
- `deployments/`
- `lib/blockchain/`
- `scripts/checkDealVaultDeployReadiness.ts`
- `scripts/estimateDealVaultProofGas.ts`
- `scripts/liveTestDealVaultProof.ts`
- `test/ProofVault.test.ts`
- `test/MilestoneVault.test.ts`
- `test/PartnerPay.test.ts`
- `test/DealVaultRealEstate.test.ts`

Commands:

- `npm run compile:contracts`
- `npm run test:contracts`
- `npm run check:contracts`
- `npm run estimate:dealvault:proof:polygon`

Do not run `live-test:dealvault:proof:polygon` without explicit approval because it can spend gas.

## If Payments Break

Start with:

- `lib/payments/`
- `lib/paypal/`
- `app/api/create-order/route.ts`
- `app/api/capture-order/route.ts`
- `app/api/process-payment/route.ts`
- `app/api/paypal-webhook/route.ts`
- `app/pricing/page.tsx`

Do not charge real cards or PayPal accounts unless explicitly approved.

## If Public Lead Forms Break

Use these skills first:

- `.agents/skills/vestblock/agentic-conversion-operator.md`
- `.agents/skills/vestblock/revenue-operations-operator.md`
- `.agents/skills/vestblock/email-alert-automation.md`

Start with:

- `app/api/service-interest/route.ts`
- `app/api/funding-lead/route.ts`
- `app/api/visibility-expansion-request/route.ts`
- `app/api/ai-assistant-request/route.ts`
- `app/api/dealvault/pilot-interest/route.ts`
- Public page containing the form
- `lib/email/sendEmail.ts`

Check that blank/no-email leads do not trigger noisy email alerts.

## If Search Visibility/AEO Work Is Requested

Use these skills first:

- `.agents/skills/vestblock/ai-citation-growth-operator.md`
- `.agents/skills/vestblock/aeo-content-automation.md`
- `.agents/skills/vestblock/seo-aeo-learning-loop.md`

Start with:

- `app/learn/`
- `lib/aeo/topics.ts`
- `lib/content/entitySeoExpansion.ts`
- `lib/seo/serviceSeoPages.ts`
- `lib/seo/structuredData.ts`
- `app/sitemap.ts`
- `app/api/cron/entity-seo-expansion/route.ts`
- `public/llms.txt` or app route serving `/llms.txt`
- `docs/VESTBLOCK_ENTITY_SEO_EXPANSION.md`
- `docs/VESTBLOCK_AEO_PLAYBOOK.md`
- `docs/DEALVAULT_SEO_AEO_STRATEGY.md`

Use buyer questions and proof assets. Do not create thin programmatic pages just to inflate page count.

For city/service expansion, run `/api/cron/entity-seo-expansion?dryRun=true&proactiveCityLimit=6` or inspect `runEntitySeoExpansion`. The proactive path should use existing `entity_seo_opportunities`, not a second page generator.

## If Revenue Command Or Daily Scorecards Are Requested

Start with:

- `/admin/revenue-command`
- `lib/admin/revenueCommand.ts`
- `npm run revenue:command`
- `scripts/lead-quality-scorecard.mjs`
- `scripts/visibility-aeo-scorecard.mjs`
- `scripts/visibility-indexing-push.mjs`
- `.agents/skills/vestblock/continuous-improvement-operator.md`

Do not add a second CRM. Extend the existing read-only command center or existing admin dashboards.

## If Browser QA Is Requested

Use:

- `.agents/skills/vestblock/production-launch-verification.md`
- `browser-use:browser` for the in-app browser when requested
- Playwright only when a repeatable browser test is needed

Check local render, console errors, mobile layout, and safe form dry-runs. Do not run live payments, live sends, or blockchain transactions.

## If Gmail Replies Or Bounces Are Requested

Use:

- `.agents/skills/vestblock/gmail-triage-operator.md`
- Gmail connector when available
- `npm run process:gmail-bounces` without `--apply` first
- `npm run suppress:bad-lead-emails` without `--apply` first

Draft replies but do not send unless Rob explicitly approves.

## If GitHub Or PR Hygiene Is Requested

Use:

- `.agents/skills/vestblock/github-discipline-operator.md`
- GitHub skills/tools if connected
- `git status --short`

Group changes by business outcome and do not revert unrelated work.

## If Content Factory Work Is Requested

Use:

- `docs/content/VESTBLOCK_CONTENT_COMMAND_CENTER.md`
- `scripts/createGrowthSalesAssets.mjs`
- `public/proof/`
- `public/sales/`
- `docs/sales/`

Create one core asset, then repurpose it into social, outreach, FAQ, and proof-friendly formats.

## Default Verification Ladder

- Docs only: no TypeScript needed.
- Single TS/TSX file: targeted `npx eslint <file>`, then `npm run typecheck`.
- Public route/shared component: targeted lint, `npm run typecheck`, `npm run build`.
- Outreach send logic: targeted lint, `npm run typecheck`, `npm run outreach:preflight`.
- Contracts: `npm run compile:contracts`, `npm run test:contracts`.
