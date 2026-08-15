# VestBlock Gate 0 — Production Baseline and System Truth

Audit date: 2026-08-14 (America/Chicago)
Authoritative host alias: `vestblock-pro`
System hostname reported by macOS: `MacBookPro.lan`
Authoritative repository: `/Users/mrsanders/VestBlock Codex Sync/Codex Folder`
Gate status: complete; no production mutation or outreach performed

## Executive result

The authoritative Mac Pro repository and the existing VestBlock Vercel project are verified. The repository is clean and builds successfully, but production is intentionally behind the local release and the operating system is not ready for live outreach.

The current local release is `3e117079`, while production reports `14f2ab0`. Production therefore does not yet contain the approved AI-guided identity assets and metadata from `3e117079`. The later release gate must deploy the accumulated approved work; Gate 0 did not deploy it.

The largest operating blockers are:

1. DealMachine is not operational, and the unwanted local export watcher is still loaded every 15 minutes.
2. The production n8n webhook URL fails the application's HTTPS/allowlist validation, and the only recorded no-send contract run failed with HTTP 403.
3. Live outreach is disabled by environment flags and by the n8n database control.
4. The CRM contains historical leads and outreach records, but the new participant-profile, matching, and strategy-outcome layers contain no real records.
5. The route-ownership audit is stale and fails on `/api/capital/cases`.
6. Obsidian's generated home counter says zero strategies even though Supabase contains ten active strategies and the vault contains their ten generated strategy files.

## Authoritative repository and recovery points

| Item | Evidence | Status |
| --- | --- | --- |
| Repository | `/Users/mrsanders/VestBlock Codex Sync/Codex Folder` | verified |
| Branch | `codex/operation-rebrand-final` | verified |
| Local HEAD | `3e117079f1d5588966e7c4e3f335e1a6d4844404` | verified and clean |
| Required identity commit | `3e117079` is the current HEAD | verified |
| Origin | `https://github.com/VestBlock/v0-new-project.git` | verified |
| Remote branch state | origin currently points to `ba6a9975`; `3e117079` has not been pushed | pending release push |
| Node | `v22.14.0` | verified |
| Package manager | `pnpm 10.33.2` | verified |
| Vercel project | `robert-sanders-projects-f3e473a9/v0-vest-block-rebuild` / `prj_7AKwdS8YpRSPASbFjXTlQ050u41h` | verified |
| Production deployment | `dpl_3XEskNJy8559V5Rw2ZVnWQZTgXLB` / `v0-vest-block-rebuild-kuyzyar2b.vercel.app` | Ready |
| Production aliases | `vestblock.io`, `www.vestblock.io`, and the project aliases | verified |
| Production source | `/api/health` reports `14f2ab0` | behind local release |

### Rollback points

- Hosted rollback artifact: `dpl_3XEskNJy8559V5Rw2ZVnWQZTgXLB`.
- Hosted rollback URL: `https://v0-vest-block-rebuild-kuyzyar2b.vercel.app`.
- Hosted source rollback commit: `14f2ab01e9e86108e68cb5da40f5f82f94e40a23`.
- Local pre-operation rollback commit: `3e117079f1d5588966e7c4e3f335e1a6d4844404`.
- Do not create a second Vercel project. Later releases must target the existing linked project and the `robert-sanders-projects-f3e473a9` scope.

The Codex Vercel connector currently receives a 403 for this account scope. The Mac Pro Vercel CLI is authenticated as `vestblock` and can access the correct project when the Robert Sanders project scope is supplied explicitly. The Mac Pro's default npm cache also contains old ownership damage; the audit used an isolated temporary cache instead of changing filesystem ownership.

## Production versus local release

| Check | Current production | Local build at `3e117079` |
| --- | --- | --- |
| Homepage title | older Capital/Real Estate/Opportunity title | `VestBlock \| Find Your Next Move` |
| AI-guided platform description | not present | exact approved description present |
| New compact AI mark | asset returns 404 | asset returns 200 `image/png` |
| New horizontal platform logo | asset returns 404 | asset returns 200 `image/png` |
| Homepage social card | 200 `image/png` | 200 `image/png` |
| DealVault social card | 200 `image/png` | 200 `image/png` |
| Main public journeys | reachable | reachable |

Production returned HTTP 200 for `/`, `/get-started`, `/next-move`, `/capital`, `/funding`, `/buyers`, `/sell`, `/lenders`, `/real-estate`, `/opportunity`, `/dealvault`, `/ai-assistant`, `/privacy`, and `/terms`. Reachability does not prove downstream CRM creation or follow-up.

## Verification results

| Check | Result |
| --- | --- |
| Full ESLint | exit 0; 0 errors and 70 existing warnings |
| TypeScript | pass |
| Next.js production build | pass; 261 static pages generated |
| Focused Playwright smoke suite | 7 of 7 passed |
| Supabase live schema/security audit | pass |
| Supabase project binding | API and database both use `iplmxoxncjyxbixdhrst` |
| Supabase schema references | 145 referenced tables and 2 RPCs; none missing |
| Supabase RLS/security assertions | pass; no audited anonymous or privileged exposure |
| Applied Supabase migrations | 17; latest `20260814110000` |
| Route-ownership matrix | fail; `/api/capital/cases` is unassigned |
| Local production smoke | homepage, key lanes, health, social cards, and new assets return expected 200 responses |

The full lint warnings are mainly existing React effect/state warnings and unused symbols. They do not currently fail the build, but they remain technical debt.

## Integration truth table

| Integration | Current evidence | Gate 0 status |
| --- | --- | --- |
| Vercel | correct project, aliases, Ready deployment, and 14 configured cron schedules | working; production behind local |
| Supabase/Postgres | live security audit passed; 176 public tables; current production evidence available | working and verified |
| Outlook/Microsoft Graph | configuration present; mailbox/reply memory updated about two hours before audit | working evidence |
| Resend | API, sender, and webhook configuration present; 732 historical provider events | configured with historical delivery evidence; no new send test |
| OpenAI | credential present locally and in production | configured; not exercised in Gate 0 |
| n8n | URL and secret names present; production URL fails validation; one no-send run failed HTTP 403 | broken and fail-closed |
| ATTOM | configured and enabled in production with 7,584 property-intelligence records and recent evidence; credential absent from Mac Pro local env | production evidence exists; local direct test blocked |
| DealMachine | an older key exists, source flag is absent, user reports API failure, and no recent export-ingest evidence exists | not operational |
| Buffer | key and one Facebook channel ID present; standalone scheduling script exists | configured but not production-automated; account ownership still needs verification |
| Outscraper | credential present; production enable flag absent | configured but inactive |
| Instantly | no credential in the audited environment | unavailable |
| Inngest | route exists; event key absent | unavailable as an outbound automation producer |
| Hunter | credential present | configured; not exercised |
| IndexNow/SEO | current indexing, AEO, entity SEO, and publishing evidence exists | working evidence |
| PayPal | production credentials and webhook ID present | configured; transaction flow not exercised |
| DealVault chain | production addresses, RPC, and administrative key names exist | configured; chain mutation not exercised |
| Twilio, Postiz, PostHog | no runtime implementation found | intentionally excluded |

Several production secrets—including service-role, OpenAI, PayPal, and blockchain administrative credentials—are classified as non-sensitive variables in Vercel. Values were not recorded or exposed by this audit. Their Vercel sensitivity classification must be corrected and affected credentials reviewed during the security release gate.

## Capability evidence

The read-only capability audit found:

- 9 healthy capabilities;
- 1 manual-queue-only capability;
- 1 locally blocked capability;
- 1 unproven capability;
- no audit-reported failed or stale capability.

Healthy evidence exists for Supabase, Outlook mailbox processing, strategy sourcing/reporting, daily reports, AEO auditing, entity SEO, content publishing, indexing pushes, and improvement review. LinkedIn is intentionally a manual task queue.

ATTOM was marked locally blocked because its credential is not in the Mac Pro `.env.local`, even though production configuration and recent database evidence exist. DealMachine contact exports were unproven: zero recent property rows, pending contact exports, or ingested contact rows were recorded by the audit.

## Active automation inventory

### Vercel schedules

Fourteen schedules are deployed from `vercel.json`:

| Route | Schedule |
| --- | --- |
| `/api/cron/boss-daily-loop` | `0 14,17,20,23 * * *` |
| `/api/cron/daily-ops-report` | `30 4 * * *` |
| `/api/cron/strategy-engine` | `30 13,19 * * *` |
| `/api/cron/strategy-source-orchestrator` | `0 11,18 * * *` |
| `/api/cron/seller-followup?excludeDealMachine=true` | `30 21 * * *` |
| `/api/cron/partner-network-pipeline` | `15 15 * * *` |
| `/api/cron/linkedin-task-queue?limit=40` | `45 15 * * *` |
| `/api/cron/mailbox-sync` | `15 * * * *` |
| `/api/cron/attom-enrichment?limit=10&mode=smart` | `30 12 * * *` |
| `/api/cron/improvement-review` | `15 5 * * *` |
| `/api/cron/aeo-site-audit` | `0 10 * * *` |
| `/api/cron/entity-seo-expansion` | `15 10 * * *` |
| `/api/cron/visibility-aeo-publisher?limit=2` | `30 10 * * *` |
| `/api/cron/visibility-indexing-push?inspectLimit=5` | `0 12 * * *` |

External live-send flags are disabled, including global auto-send, buyer, lender, investor, strategy execution, Command Center sending, and n8n live outreach. The boss loop's internal dispatch flag is enabled while its sending flags remain disabled.

### Mac Pro launch agents

Four VestBlock agents are loaded and last reported exit status 0:

| Agent | Trigger | Current concern |
| --- | --- | --- |
| `io.vestblock.dealmachine-export-watcher` | every 900 seconds and at load | obsolete; must be disabled first in Gate 1 |
| `io.vestblock.distress-stack` | daily 07:05 | requires strategy/dependency review |
| `io.vestblock.public-distress-daily` | daily 08:30 | requires strategy/dependency review |
| `io.vestblock.on-market-creative-daily` | daily 09:15 | requires strategy/dependency review |

No GitHub Actions workflows were found. The live database does not contain a `cron.job` relation, so no pg_cron inventory exists. Buffer is not scheduled by Vercel. The n8n database control exists but has `live_send_enabled=false`; the integration is currently broken before dispatch can be trusted.

## Strategy baseline

Supabase contains ten active version-1 strategy lanes:

1. Capital and funding.
2. Real estate buyers and investors.
3. Sellers and property acquisition.
4. Lenders and capital providers.
5. Real estate professionals and providers.
6. Business buyers and sellers.
7. Next Move financial roadmaps.
8. DealVault opportunities.
9. Partnerships and referrals.
10. Content and visibility.

All ten have active contracts and generated Obsidian strategy files. However:

- `strategy_lane_outcomes` contains zero measured outcomes;
- every strategy currently uses essentially the same generic 30-day experiment language;
- several requested lanes are combined rather than independently executable;
- the older seller execution engine uses a separate strategy-key catalog;
- the generated Obsidian home page is stale and reports zero strategies;
- no single reconciled registry currently proves that the application, CRM, n8n, and Obsidian use the same strategy identifiers and versions.

Gate 2 must perform the complete strategy inventory and reconciliation. Gate 0 did not modify strategy records.

## CRM and outreach readiness

Production contains:

- 9,031 leads;
- 1,088 strategy lead memberships;
- 1,157 Command Center outbound enrollments;
- 732 Resend provider-delivery events;
- 1,074 mailbox/reply-memory records;
- 161 lead suppressions.

The historical delivery-event set contains 608 delivered, 103 bounced, 17 suppressed, and 4 accepted events. These figures are historical evidence, not a new Gate 0 campaign.

The newer controlled operating layer contains:

- 0 participant profiles;
- 0 participant opportunity matches;
- 0 strategy outcome windows;
- 1 n8n orchestration run, which failed in no-send mode with HTTP 403.

The CRM therefore has useful historical data and suppression infrastructure but is not ready for a new controlled outreach pilot. Live sending remains disabled. No email, social post, SMS, phone task, advertisement, webhook dispatch, or customer-data mutation was initiated during Gate 0.

## Website journey baseline

The local release exposes the main paths required for later end-to-end validation:

- AI-guided homepage;
- free Next Move questionnaire and management route;
- capital and funding paths;
- buyer criteria intake;
- seller intake;
- lender criteria intake;
- real-estate and opportunity hubs;
- DealVault overview and authenticated tools;
- AI-assistant intake;
- privacy and terms.

Public GET reachability and the existing smoke suite pass. Gate 0 did not submit forms or create real CRM records. Those mutations belong to the later CRM and website-journey gates after the automation and strategy controls are reconciled.

## Gate 0 decision

Gate 0 is complete. The authoritative repository and deployment target are verified, the worktree is clean before documentation, and recovery points are recorded.

The next authorized gate is Gate 1: disable and retire DealMachine export automation before implementing the inactive native-API boundary. Gate 1 must preserve historical data, prove the watcher and export schedules are stopped, and must not claim the new DealMachine API works until the replacement credential is supplied and verified.

Do not deploy or begin live outreach before the remaining gates pass.
