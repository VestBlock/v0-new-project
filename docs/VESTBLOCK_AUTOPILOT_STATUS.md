# VestBlock Autopilot Status

**Candidate date:** 2026-08-11  
**Repository:** `/Users/mrsanders/VestBlock Codex Sync/Codex Folder`  
**Branch:** `codex/revenue-engine`  
**Production deployment:** Not authorized and not performed.

## What works

- The founder Command Center opens on Today and is reduced to five areas: Today, Pipeline, Growth, AI Brain, and System.
- Today uses live Command Center records for Needs You, Money Closest, AI work, recommended moves, and operating numbers.
- Ask VestBlock Brain uses the existing grounded Command Center copilot route.
- Strategy candidates are built from live reply, task, deal, match, content, PR, SEO, and experiment records.
- Strategy scores expose impact, confidence, cost, speed, difficulty, and risk weights.
- Strategies persist in `strategy_updates`; approved strategies can create a planned `command_center_strategy_runs` campaign with `launchAuthority: not_granted`.
- Results persist in `experiment_results` with strategy, campaign, lead, reply, opportunity, conversion, and revenue links.
- Content Studio stores one core draft with platform variants, a graphic prompt, video script, and shot list.
- Drafts can be placed on an internal content calendar without publishing.
- The visual route is ready to generate a private image and composite the real VestBlock monogram after generation.
- Eight visible autonomy policies separate automatic drafting/classification from approval-gated publishing, PR, ads, and deployment.
- The n8n adapter defaults to preview, requires a founder user, rejects redirects, uses idempotency keys, and fails closed when configuration is absent.
- The published n8n bridge requires a separate static Header Auth secret, checks the signed-envelope contract, and returns a 202 preview without any downstream write node.
- ChatGPT Ads has a read-only account/reporting adapter. No campaign creation, bid, budget, activation, billing, or spend method is exposed in VestBlock.
- Buffer is the selected approval-gated social distribution path; internal content drafting and calendar storage remain provider-independent.
- The Google Ads monitor is report-only and has no account-mutation method.
- A derived Obsidian Strategy Vault projects strategy, aggregate experiment, campaign-status, content-count, and provider-verification records into linked Markdown, Bases, and JSON Canvas files without exporting lead/customer PII.

## Verification

| Check | Result |
| --- | --- |
| Full TypeScript check | Passed |
| Production build | Passed; 246 static pages generated and the Autopilot/admin routes compiled |
| Strategy scoring | Passed; expected score 83 |
| Live Supabase strategy → planned campaign → attributed result | Passed with tagged records and exact cleanup |
| Internal content calendar persistence | Passed with a tagged draft; planned time persisted, `published_at` stayed null, and exact cleanup ran |
| Google Ads report-only controlled fixture | Passed; one waste alert and one healthy CPL were classified without an account mutation API |
| Live OpenAI copy and graphic generation | Passed in the later credential proof; the configured key completed a minimal generation request with HTTP 200 |
| Buffer schedule | Connected for VestBlock Facebook only; no post was scheduled or published during setup |
| ChatGPT Ads reporting | Passed: the account-scoped key authenticated to the active Vestblock LLC advertiser account; restricted financial-services review is rejected, so launch remains blocked |
| n8n workflow | Passed: workflow `wyi6LMTPGkhZCYYa` is published with Header Auth; one signed production-webhook request returned HTTP 202 in preview mode with no external write |
| Live Google Ads account preview | Blocked: no account/developer credentials |
| Search Console metrics | Partial: site URL exists; service credential does not |
| Video rendering | Blocked: no approved provider credential |
| Founder cockpit browser QA | Passed at 1440px and 390px; all five tabs switched, Today stayed default, legacy operations stayed collapsed, and mobile scroll width equaled viewport width |
| P0/P1 regression check | No P0 or P1 defect found in the scoped build, tests, or browser journey |
| Obsidian vault deterministic fixture | Passed; required files, unique Canvas IDs, edge integrity, safety manifest, and preservation of human-owned notes verified |
| Obsidian vault live export | Passed on the Mac Pro without warnings: 0 current VestBlock strategy candidates, 0 attributed experiments, latest 250 strategy-run rows, 361 content records, valid 7-node/5-edge Canvas, and no email/phone patterns |

## Approval boundaries

- Automatic: analyze, score, classify, draft, persist internal plans, and run read-only monitoring.
- Approval required: social scheduling, PR outreach, ad changes/spend, major SEO release, sensitive messages, and production deployment.
- Reply, STOP, bounce, complaint, ambiguous correlation, and suppression controls remain fail-closed.

## Current strategy state

No generated weekly strategy is silently activated. The first Brain action creates review-required candidates from the current snapshot. A founder approval is required before the system can build a planned campaign, and a planned campaign has no launch authority.

## Current AI activity

The cockpit reports actual seven-day improvement runs, strategy runs, active agents, failures, and draft content counts. It does not invent “agents working” or scheduled posts when those records do not exist.

## External blockers

1. Resolve the rejected ChatGPT Ads advertiser/financial-services review. Read-only reporting is authenticated, but no campaign will launch without separate creative, targeting, bid, budget, billing, and launch approval.
2. Complete Google Ads advertiser verification, run the monitor in Preview, and ingest the first report before claiming live ads data.
3. Add a Search Console service credential before claiming query/page metrics.
4. Select and credential a video provider before claiming rendered video.

The n8n trial showed 14 days remaining at activation. Choose a paid plan or export the workflow before the trial ends. Downstream write nodes remain intentionally absent and require a separate review and approval.

The candidate is not production-complete while these provider proofs are blocked.
