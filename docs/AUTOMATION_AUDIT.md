# VestBlock Automation Audit

**Operation:** VestBlock Revenue Engine  
**Audit date:** 2026-08-10  
**Execution host:** Robert's MacBook Pro (`MacBookPro18,1`, Apple M1 Pro)  
**Repository:** `/Users/mrsanders/VestBlock Codex Sync/Codex Folder`  
**Branch:** `codex/revenue-engine`  
**Policy:** Inventory first. No automation, secret, schedule, table, or integration was deleted or disabled during this audit.

## Executive conclusion

VestBlock has a substantial operating system already. The problem is not a lack of agents or scripts; it is fragmented scheduling, repeated funnel logic, inconsistent ownership, and limited end-to-end attribution.

The audit found **363 runnable or supporting automation records**. The current safe disposition is:

| Disposition | Count | Meaning |
| --- | ---: | --- |
| KEEP | 135 | Retain as a protected capability or dependency. |
| MODERNIZE | 157 | Keep the function; move it behind shared data, policy, and observability. |
| MERGE | 51 | Consolidate overlapping implementations into one shared service or operating loop. |
| ARCHIVE | 20 | Preserve code and history, but remove from the active operating surface after observation. |
| REPLACE | 0 | No automatic replacement is authorized from static evidence alone. One webhook is a replacement candidate after live-caller proof. |
| REMOVE | 0 | Nothing is safe to delete until callers, schedules, history, rollback, and observation gates are satisfied. |

The right next architecture is one shared Revenue Engine serving three lanes—Deals, Capital, and Partners—with common opportunity, contact, property/business, match, activity, scoring, suppression, follow-up, and attribution primitives.

## Scope and method

The audit combined:

- repository inventory and import-closure tracing for routes, scripts, libraries, SQL, workflows, and package commands;
- live read-only inspection of macOS LaunchAgents and Codex desktop automation definitions;
- read-only checks of Vercel configuration and public production health;
- read-only REST inspection of the configured active Supabase project;
- source inspection of cron routes, webhook routes, Inngest workflow code, send gates, suppression logic, and the current Command Center;
- recent activity, status, failure, and send-event evidence where available.

Each record in `docs/AUTOMATION_INVENTORY.json` includes its source path, type, automation family, discovered dependencies, environment variables, tables, services, write signals, scheduling evidence, last file/Git activity, risk class, and proposed disposition.

### Access boundaries

- Vercel project and deployment APIs returned HTTP 403 for the current connector scope. Repository schedules and public runtime health were verified, but dashboard-only cron history remains unverified.
- The Supabase connector exposes an inactive project (`irfiohcwyfxbwqgbwlwk`) that is not the active project configured by the application (`iplmxoxncjyxbixdhrst`). The active project was inspected read-only through its REST schema.
- Direct Postgres access to the active project could not be established because the non-pooled address was unreachable over the available IPv6 path and the pooled tenant credentials were stale. Database triggers, extensions that require SQL visibility, and `pg_cron` remain unverified.
- No secrets or secret values were printed, copied into documentation, changed, or removed.

## Control-plane inventory

| Surface | Found | Live state | Audit conclusion |
| --- | ---: | --- | --- |
| Next.js cron routes | 45 | Only 2 are scheduled in `vercel.json` | Treat route presence and scheduler ownership as separate facts. |
| Vercel cron schedules | 2 | `command-center-autopilot` every 4 hours; `boss-daily-loop` four times daily | KEEP/MODERNIZE behind a shared registry, idempotency, and health view. |
| Codex desktop automations | 11 | 7 active, 4 paused | Keep explicit review-only tasks; merge overlapping revenue loops. |
| macOS VestBlock LaunchAgents | 4 | 1 healthy watcher; 1 blocked by host governance; 2 stale/failing | Modernize paths and ownership before any decommission. |
| User crontab jobs | 0 VestBlock | Only unrelated Gaming Greats jobs | No VestBlock migration needed. |
| Inngest workflows | 1 | Growth service request workflow; direct fallback when Inngest is unconfigured | KEEP as a workflow boundary; improve registry/telemetry. |
| Webhook routes | 3 | PayPal x2, DealMachine x1 | Keep verified handlers; investigate duplicate unsigned PayPal path. |
| Operational scripts | 126 | Mixed direct, scheduled, and library use | Consolidate by lane and shared capability. |
| SQL files | 69 | Many historical feature families | Preserve; map to active schema before migration. |
| Automation/support records | 363 | 135 keep, 157 modernize, 51 merge, 20 archive | Full machine-readable record is the system of record. |

## Live schedulers

### Vercel

`vercel.json` schedules only:

| Route | Schedule | Current behavior | Disposition |
| --- | --- | --- | --- |
| `/api/cron/command-center-autopilot` | `0 */4 * * *` | Defaults to dry-run unless explicit dispatch/send gates are enabled. | MODERNIZE |
| `/api/cron/boss-daily-loop` | `0 14,17,20,23 * * *` | Defaults to dry-run; seller send requires a specific send flag and request intent. | MODERNIZE |

All other cron-shaped routes are runnable entry points, not proven Vercel schedules.

### Codex desktop automations

| Automation | State | Cadence | Action boundary | Disposition |
| --- | --- | --- | --- | --- |
| DealMachine daily stack expansion | Active | Daily 08:15 | Expands, queues, and reconciles; no send/spend. | MERGE/MODERNIZE |
| VestBlock boss morning report | Active | Every 4 hours | Runs revenue operations and reports. | MODERNIZE |
| VestBlock daily strategy lab | Active | Daily 08:10 | Can execute email only when script and policy gates permit; no SMS, contract, or spend. | MODERNIZE |
| DealMachine manual finder loop | Active | Every 6 hours | Finds and queues; no send/spend. | MERGE |
| LinkedIn network loop | Active | Every 8 hours | Draft/manual queue only; no LinkedIn action. | KEEP/MODERNIZE |
| SMS review queue | Active | Every 6 hours | Review-only; no send. | KEEP |
| Website QA/security loop | Active | Daily 07:15 | Non-destructive QA; may implement scoped code fixes. | KEEP |
| Bank-owned asset target builder | Paused | Defined | Target research. | ARCHIVE candidate |
| Daily authority engine | Paused | Defined | Content/authority production. | MERGE/ARCHIVE candidate |
| Daily PR/backlink sprint | Paused | Defined | PR/backlink work. | ARCHIVE candidate |
| Landbank REO daily send | Paused | Defined | Send-capable campaign. | KEEP paused pending shared outreach migration |

An orphaned memory directory exists for an older investor partnership automation whose active definition is no longer present. Preserve it for attribution and migration history.

### macOS LaunchAgents

| Label | Cadence | Evidence | Disposition |
| --- | --- | --- | --- |
| `io.vestblock.dealmachine-export-watcher` | Every 900 seconds + run at load | Healthy today; no errors; recent runs found zero candidates and ingested zero. | KEEP/MODERNIZE |
| `io.vestblock.distress-stack` | Daily 07:05 | Currently blocked because host governance expects `MacBookPro.lan`; script also carries an older project-directory default. | MODERNIZE |
| `io.vestblock.on-market-creative-daily` | Daily 09:15 | No recent log content since 2026-07-22; dry by default unless an explicit send flag is enabled. | MODERNIZE/ARCHIVE candidate |
| `io.vestblock.public-distress-daily` | Daily 08:30 | Last launch exit is 1; no recent log content since 2026-07-22. | MODERNIZE/ARCHIVE candidate |

## Automation families

| Family | Records | Direction |
| --- | ---: | --- |
| Real estate | 69 | Shared Deals lane; consolidate ingestion, qualification, analysis, routing, and follow-up. |
| Shared outreach | 39 | One compliant send, sequence, suppression, reply, and attribution service. |
| Buyer | 26 | Merge discovery, scoring, outreach, follow-up, and performance into the Deals lane. |
| Capital | 19 | One Capital lane for borrower intake, lender matching, packaging, readiness, and follow-up. |
| Lender/capital | 17 | Merge with Capital lane while preserving role-specific policies. |
| Partner | 23 | One Partners lane for investors, vendors, referral sources, and strategic relationships. |
| Growth/content | 27 | Attribute to opportunities, audience, experiments, and measurable outcomes. |
| Payments/DealVault | 12 | Protected revenue and access-control capability; retain strong change gates. |
| Control plane | 9 | Merge scheduling, health, event, policy, and approval visibility. |
| Workflow | 8 | Use as durable orchestration boundaries, not duplicate business logic. |
| Legacy government | 7 | Preserve evidence; archive stale SAM/grant loops unless current ownership and outcomes are proven. |
| Supporting | 107 | Keep only where dependency or operating value is established. |

## Live activity evidence

### Command Center jobs

Seven job records exist; six are active and one is running.

- `seller-outreach-batch` was running on audit day, four times daily, with `live_run_started` as its latest status.
- `reply-memory-sync` completed on audit day and is configured hourly.
- `suppression-sync`, `daily-strategy-plan`, `source-rotation`, `followup-router`, and `deal-routing-sync` show older seeded or dry-run status and need ownership/freshness gates.

### Strategy and source processing

Recent strategy-run status sample:

| Status | Count |
| --- | ---: |
| awaiting_contacts | 259 |
| planned | 94 |
| completed | 51 |
| blocked | 40 |
| provider_accepted | 28 |
| dry_run | 15 |
| send_blocked | 11 |
| drafted | 1 |
| replied | 1 |

Recent source events were concentrated in DealMachine, followed by HomeHarvest, public records, and property intelligence. This proves the primary acquisition lane is active and should be consolidated, not removed.

### Outreach execution

| System | Sample size | Evidence |
| --- | ---: | --- |
| Buyer outreach runs | 485 | 202 failed, 177 completed, 100 partial, 6 running. |
| Lender outreach runs | 263 | 176 failed, 85 completed, 2 running. |
| Investor automation runs | 500 | 286 completed, 214 failed. |
| Recent outreach send events | 500 | 188 accepted, 136 queued, 136 approved, 40 skipped; all email. |
| Recent email events | 500 | 79 accepted, 421 skipped. |
| Outbound enrollments | 500 | 356 accepted, 89 needs review, 48 suppressed, 7 replied. |

The high failure and skip ratios make observability and shared policy more urgent than increased volume. No new blind-send capability should be added.

### Dormant or historical families

- Legacy business scrape runs show no activity after 2026-06-01.
- PR automation activity was last observed around 2026-06-10.
- SAM alert runs were last observed around 2026-05-03, with more failures than completions in the sample.
- Grant automation appears historical, with activity last observed in 2025.

These are archive candidates, not immediate deletion candidates.

## Existing data and code foundations

The current system already has most of the raw material for the Revenue Engine:

- `command_center_events`, `command_center_jobs`, `command_center_strategy_runs`;
- `command_center_reply_memory`, `command_center_suppression_decisions`;
- `leads`, `buyers`, `lenders`, `matches`, `outreach`, and `suppressions`;
- `property_analysis_runs`, `property_buyer_packets`, `property_buyer_packet_sends`;
- `deal_pipeline_items`, funding, payment, subscription, and DealVault records;
- a large `lib/admin/commandCenter.ts` snapshot layer plus operating loops, boss-agent, growth-scoreboard, and autonomous-system modules.

The safe strategy is to normalize these existing sources into shared Opportunity, Contact, Asset, Match, Activity, Pipeline, Score, and Automation Registry views. A database rewrite is not required for the first release.

## Recommended disposition by capability

### KEEP

- verified PayPal webhook at `/api/webhook`;
- verified DealMachine webhook at `/api/webhooks/dealmachine`;
- Inngest endpoint and growth-service workflow boundary;
- authentication, payment, subscription, and DealVault access-control paths;
- suppression decisions, reply memory, send events, and review queues;
- DealMachine export watcher as an ingestion capability;
- all current secrets, audit history, and outcome evidence.

### MODERNIZE

- Vercel cron routes and active desktop/LaunchAgent schedulers;
- current Command Center data/view layer;
- DealMachine watcher, list-builder, and stack runners;
- daily and weekly executive reporting;
- active buyer, lender, investor, and seller loops;
- entity SEO and growth loops only where attribution to a lane, opportunity, audience, or experiment is present.

### MERGE

- buyer, lender, and investor discover-score-follow-up-performance implementations;
- email senders, sequence runners, suppression checks, reply handling, and attribution;
- overlapping DealMachine stack expansion, manual finder, website list builder, export, and ingestion automations;
- overlapping boss, morning-report, daily-strategy, and operating-loop briefs;
- repeated scoring and readiness logic that should become lane policy.

### REPLACE after proof

- `/api/paypal-webhook` is a replacement candidate because it overlaps the verified PayPal handler without equivalent provider-signature verification. Do not disable it until the configured PayPal callback, event coverage, idempotency, and rollback path are verified.

### ARCHIVE after observation

- stale PR/backlink, SAM, grant, generic business-growth, and generic business-credit loops that cannot demonstrate a current owner, active schedule, dependency, or outcome;
- obsolete wrappers after their callers are moved to shared services;
- orphaned automation memory only after its attribution value is captured.

### REMOVE

None authorized from this audit. Removal requires the migration gates in `docs/AUTOMATION_MIGRATION_PLAN.md`.

## Risk register

| Risk | Level | Evidence | Required control |
| --- | --- | --- | --- |
| Duplicate unsigned PayPal handler | Red | `/api/paypal-webhook` processes overlapping payment events without the provider-verification flow used by `/api/webhook`. | Confirm live caller; consolidate event coverage; test replay/idempotency; cut over; observe; then disable legacy route. |
| High outreach failure ratios | Yellow | Buyer, lender, and investor run samples contain hundreds of failures. | One error taxonomy, retry policy, provider health view, owner, and alert threshold. |
| Sends outside one registry | Yellow | Send-capable routes, scripts, desktop tasks, and database jobs use different gates. | Central action/risk registry and a single send/suppression policy. |
| Fragmented scheduler ownership | Yellow | Vercel, Codex, launchd, database jobs, and manual runners all participate. | One registry showing owner, cadence, action class, last/next run, health, and source of truth. |
| Mac host/path mismatch | Yellow | Distress runner is blocked by primary-host governance and retains an older directory default. | Canonical host identity and repository path; tested rollback. |
| Supabase project mismatch | Yellow | Connector project differs from the active application project. | Reconnect management tooling to the active project before schema mutation. |
| Database-native schedules unverified | Yellow | Direct SQL connection was unavailable during the audit. | Verify triggers, queues, extensions, and `pg_cron` before removing upstream callers. |
| Production drift | Yellow | Production health is good but reports commit `d5b934d`; local branch is ahead and dirty. | Review, test, and human-approved release; no direct production deploy. |
| Weak end-to-end correlation | Yellow | Activity exists across many tables without one opportunity/activity correlation contract. | Shared IDs, activity schema, outcome attribution, and pipeline views. |

## Security finding: duplicate PayPal webhook

- **Rule ID:** NEXT-WEBHOOK-001
- **Severity:** High for payment-state integrity; exact exploitability depends on route reachability and surrounding PayPal/account checks.
- **Location:** `app/api/paypal-webhook/route.ts`, POST handler.
- **Evidence:** The handler consumes and acts on parsed PayPal event data but does not perform the provider-signature verification present in `app/api/webhook/route.ts`.
- **Impact:** An attacker who can satisfy the handler's record-matching conditions may be able to influence payment or subscription state with a forged request. The exact blast radius requires route-level test evidence and live callback configuration.
- **Fix:** Make the verified handler canonical, bring any missing event behavior into it, verify against the raw request data and PayPal transmission headers, preserve idempotency, update the PayPal callback, and only then retire the duplicate.
- **Mitigation:** Until cutover, add route-level monitoring, rate controls, and an explicit feature gate after verifying the live caller. Do not weaken the verified route.
- **False-positive/verification notes:** Confirm whether PayPal currently calls this path, whether an upstream gateway validates it, and which events are unique to it. Those controls were not visible in application code.

## Decision

Proceed with a shared Revenue Engine as an additive normalization and control layer. Do not launch more independent senders. Do not delete legacy systems yet. First ship the automation registry, normalized executive snapshot, shared lane/pipeline/scoring contracts, and observability; then migrate one bounded family at a time through disable, observe, archive, replace, test, and delete gates.
