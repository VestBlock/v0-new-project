# VestBlock Automation Registry

**Verified:** 2026-08-10  
**Host:** Robert's MacBook Pro (`MacBookPro18,1`, Apple M1 Pro)  
**Repository:** `/Users/mrsanders/VestBlock Codex Sync/Codex Folder`  
**Rule:** A route or script is not active merely because it exists. This registry lists only proven scheduler owners, provider callbacks, and the on-demand agent control plane.

## Authority boundaries

- Green: read, score, draft, deduplicate, summarize, and run health checks with logging.
- Yellow: queue or send external communication only after eligibility, suppression, frequency, and approval gates pass.
- Red: production deploys, payments, contracts, bulk sends, destructive data changes, and secret changes require human approval.
- The 45 `/api/cron/*` routes all fail closed without cron authorization. Only two are scheduled by `vercel.json`.
- Campaign definitions in `config/revenue-campaigns.json` are disabled until inbound reply capture is connected to a provider.

## Active registry

### `vercel.command-center-autopilot`

| Field | Value |
| --- | --- |
| NAME | Command Center Autopilot |
| PURPOSE | Refresh the operational snapshot and run bounded Command Center planning. |
| TRIGGER | Vercel Cron, `0 */4 * * *`. |
| CONDITIONS | Valid cron authorization; dispatch/send flags remain off unless explicitly enabled. |
| ACTIONS | Reads live operating data; builds plans, tasks, and alerts; defaults to dry-run. |
| DATA USED | Leads, command-center events/jobs/tasks, outreach, suppression, property, buyer, lender, and strategy records. |
| OWNER | VestBlock CTO / Revenue Operations. |
| FAILURE BEHAVIOR | Returns non-2xx; failures are retained in run/event data and surfaced in Command Center automation alerts where present. |
| RETRY POLICY | Scheduler retry only; business actions must remain idempotent. No unbounded application retry. |
| LOG LOCATION | Vercel function logs; Command Center events and jobs. Dashboard history is not available to the current connector scope. |
| HOW TO DISABLE | Human-approved removal of this entry from `vercel.json`, followed by a deployment. |
| HOW TO TEST | Unit: `pnpm run test:command-center-autopilot`. Runtime: authorized request in dry-run mode. |
| STATUS | ACTIVE — code and schedule present; production deployment is older than the candidate. |

### `vercel.boss-daily-loop`

| Field | Value |
| --- | --- |
| NAME | Boss Daily Loop |
| PURPOSE | Produce several daily operating checkpoints for the founder. |
| TRIGGER | Vercel Cron, `0 14,17,20,23 * * *`. |
| CONDITIONS | Valid cron authorization; seller send requires a separate send flag and request intent. |
| ACTIONS | Builds revenue/strategy summaries and bounded next-action queues; defaults to dry-run. |
| DATA USED | Revenue funnel, strategy runs, leads, matches, tasks, source health, and outreach state. |
| OWNER | VestBlock CEO / Revenue Director. |
| FAILURE BEHAVIOR | Returns non-2xx and records available loop/event evidence. No silent fallback send. |
| RETRY POLICY | Scheduler retry only; no blind resend. |
| LOG LOCATION | Vercel function logs; Command Center events/jobs; local operating-loop artifacts when run locally. |
| HOW TO DISABLE | Human-approved removal from `vercel.json`, then deploy. |
| HOW TO TEST | `pnpm run test:operating-loops`; invoke the route with cron authorization and dry-run intent. |
| STATUS | ACTIVE — code and schedule present; production deployment is older than the candidate. |

### `launchd.dealmachine-export-watcher`

| Field | Value |
| --- | --- |
| NAME | DealMachine Export Watcher |
| PURPOSE | Ingest newly delivered DealMachine exports into the acquisition pipeline. |
| TRIGGER | macOS LaunchAgent every 900 seconds and at load. |
| CONDITIONS | Files must appear in the configured incoming directory and pass parsing/deduplication. |
| ACTIONS | Scans up to 30 recent files, deduplicates, ingests eligible rows, and writes a run report. |
| DATA USED | Local export files, ingestion state, live lead/property records. |
| OWNER | Acquisitions Director. |
| FAILURE BEHAVIOR | Exits non-zero; stderr is retained. It does not send outreach. |
| RETRY POLICY | Next 15-minute launch; processed-file/idempotency state prevents duplicate ingestion. |
| LOG LOCATION | `logs/dealmachine-export-watcher.log`, `logs/dealmachine-export-watcher.error.log`, `reports/dealmachine-export-watcher/`. |
| HOW TO DISABLE | `launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/io.vestblock.dealmachine-export-watcher.plist` after approval. |
| HOW TO TEST | Run the script against a quarantined fixture directory without `--apply`; inspect the JSON report. |
| STATUS | ACTIVE / HEALTHY — last verified run completed with zero candidate files and zero errors. |

### `launchd.distress-stack`

| Field | Value |
| --- | --- |
| NAME | Distress Stack Daily |
| PURPOSE | Build a daily public-record/distress acquisition stack. |
| TRIGGER | macOS LaunchAgent at 07:05 local time. |
| CONDITIONS | Primary-host governance must approve the current host identity. |
| ACTIONS | Runs the distress-stack shell workflow and writes local artifacts; send authority is separate. |
| DATA USED | Public/property sources, local stack state, lead database. |
| OWNER | Acquisitions Director. |
| FAILURE BEHAVIOR | Fails closed on a non-primary host and logs the reason. |
| RETRY POLICY | Next daily launch; manual rerun only after the host rule is corrected. |
| LOG LOCATION | `data/distress-leads/logs/launchd.out.log`, `data/distress-leads/logs/launchd.err.log`. |
| HOW TO DISABLE | Boot out `io.vestblock.distress-stack` after approval. |
| HOW TO TEST | Run `scripts/distress-stack-daily.sh` in its dry/non-send mode after verifying host identity. |
| STATUS | LOADED / BLOCKED — host policy expects `MacBookPro.lan` while this Mac reports `Roberts-MacBook-Pro.local`. |

### `launchd.on-market-creative-daily`

| Field | Value |
| --- | --- |
| NAME | On-Market Creative Daily |
| PURPOSE | Find on-market creative-finance candidates and prepare operator review material. |
| TRIGGER | macOS LaunchAgent at 09:15 local time. |
| CONDITIONS | `ON_MARKET_CREATIVE_SEND=0`; external sends are disabled. |
| ACTIONS | Researches and drafts/queues candidates. |
| DATA USED | Public listing inputs, local artifacts, property/lead records. |
| OWNER | Acquisitions Director. |
| FAILURE BEHAVIOR | Non-zero exit and launchd stderr; no send fallback. |
| RETRY POLICY | Next daily run; manual diagnostic before enabling any send. |
| LOG LOCATION | `/Users/mrsanders/VestBlockOps/logs/on-market-creative-daily.launchd.*.log`. |
| HOW TO DISABLE | Boot out `io.vestblock.on-market-creative-daily` after approval. |
| HOW TO TEST | Run `/Users/mrsanders/VestBlockOps/scripts/run-on-market-creative-daily.sh` with send disabled. |
| STATUS | LOADED / STALE — last log activity was 2026-07-22; no current success evidence. |

### `launchd.public-distress-daily`

| Field | Value |
| --- | --- |
| NAME | Public Distress Daily |
| PURPOSE | Collect public distress opportunities for review. |
| TRIGGER | macOS LaunchAgent at 08:30 local time. |
| CONDITIONS | Source access and host paths must be valid. |
| ACTIONS | Runs the public-distress workflow and writes artifacts; it has no independent send authority. |
| DATA USED | Public sources, local acquisition artifacts, property/lead records. |
| OWNER | Acquisitions Director. |
| FAILURE BEHAVIOR | Non-zero exit with launchd logs. |
| RETRY POLICY | Next daily run; manual diagnostic required after repeated failure. |
| LOG LOCATION | `/Users/mrsanders/VestBlockOps/logs/public-distress-daily.launchd.*.log`. |
| HOW TO DISABLE | Boot out `io.vestblock.public-distress-daily` after approval. |
| HOW TO TEST | Run `/Users/mrsanders/VestBlockOps/scripts/run-public-distress-daily.sh` in non-send mode. |
| STATUS | LOADED / FAILING — last launch exit was 1 and logs have been stale since 2026-07-22. |

### `webhook.paypal-verified`

| Field | Value |
| --- | --- |
| NAME | Verified PayPal Webhook |
| PURPOSE | Process authenticated PayPal payment events. |
| TRIGGER | PayPal callback to `/api/webhook`. |
| CONDITIONS | Provider signature verification and supported event type. |
| ACTIONS | Applies idempotent payment/order state changes. |
| DATA USED | PayPal headers/payload, payment/order records. |
| OWNER | CTO / Finance. |
| FAILURE BEHAVIOR | Rejects invalid signatures; returns non-2xx on processing failure. |
| RETRY POLICY | PayPal provider retry plus event-id idempotency. |
| LOG LOCATION | Vercel function logs and payment records. |
| HOW TO DISABLE | Change the provider callback only with human approval and a rollback plan. |
| HOW TO TEST | Signed provider sandbox fixture and replay/idempotency test. Do not use `/api/paypal-webhook`; it intentionally returns 410. |
| STATUS | ACTIVE; legacy unsigned handler RETIRED. |

### `webhook.dealmachine`

| Field | Value |
| --- | --- |
| NAME | DealMachine Webhook |
| PURPOSE | Receive DealMachine events for property/lead ingestion. |
| TRIGGER | Provider callback to `/api/webhooks/dealmachine`. |
| CONDITIONS | Configured webhook authentication and recognized payload. |
| ACTIONS | Validates, deduplicates, and routes provider records. |
| DATA USED | Provider payload, property intelligence, lead/source records. |
| OWNER | Acquisitions Director / Backend. |
| FAILURE BEHAVIOR | Rejects unauthenticated/invalid events and logs processing failures. |
| RETRY POLICY | Provider retry and application idempotency. |
| LOG LOCATION | Vercel function logs and provider/source run records. |
| HOW TO DISABLE | Provider callback change requires human approval. |
| HOW TO TEST | Authenticated fixture with a tagged test record and cleanup. |
| STATUS | ACTIVE route; current provider delivery history was not available in the connector. |

### `webhook.resend-email-operations`

| Field | Value |
| --- | --- |
| NAME | Resend Delivery and Inbound Reply Webhook |
| PURPOSE | Record delivery state, suppress bounce/complaint recipients, ingest replies, classify them, pause sequences, and surface tasks/drafts. |
| TRIGGER | Resend callback to `/api/webhooks/resend`. |
| CONDITIONS | Raw Svix signature must verify; `RESEND_API_KEY` and `RESEND_WEBHOOK_SECRET` must exist; inbound requires Resend Receiving. |
| ACTIONS | Idempotent provider event record; delivery update; suppression; reply association/classification; enrollment/pipeline update; Command Center task and suggested reply. |
| DATA USED | Resend event/message, outreach send/enrollment, lead, suppression, reply memory, command-center event/task records. Message body is summarized and hashed rather than duplicated. |
| OWNER | Revenue Director / Backend. |
| FAILURE BEHAVIOR | Missing/invalid signatures fail closed; processing failure is recorded as `processing_failed` where possible. No automatic negotiation or sales reply. |
| RETRY POLICY | Resend webhook retry plus provider-event and reply-message idempotency. |
| LOG LOCATION | Vercel function logs, `provider_delivery_events`, `command_center_reply_memory`, `command_center_events`, `admin_tasks`. |
| HOW TO DISABLE | Disable the Resend webhook or remove its secret only after outbound is paused and approval is recorded. |
| HOW TO TEST | `pnpm run test:email-operations`; tagged `--live-db` test; signed Resend fixture after receiving is enabled. |
| STATUS | CANDIDATE READY / EXTERNALLY BLOCKED — source and local tests pass; receiving is disabled, webhook lacks `email.received`, and the local secret is absent. |

### `workflow.inngest-growth-service`

| Field | Value |
| --- | --- |
| NAME | Growth Service Request Workflow |
| PURPOSE | Provide a durable boundary for growth-service work when Inngest is configured. |
| TRIGGER | Event through `/api/inngest`. |
| CONDITIONS | Inngest signing/configuration; otherwise the application uses a direct fallback. |
| ACTIONS | Runs the configured service-request steps and records deliverables/status. |
| DATA USED | Service request, lead/user context, deliverable records. |
| OWNER | Growth Director / Backend. |
| FAILURE BEHAVIOR | Workflow failure remains visible to Inngest; direct fallback is explicit. |
| RETRY POLICY | Inngest-managed bounded workflow retry. |
| LOG LOCATION | Inngest dashboard when configured; application/service-deliverable logs. |
| HOW TO DISABLE | Remove Inngest event dispatch after approval; direct fallback remains. |
| HOW TO TEST | Provider dev event or direct-fallback integration test. |
| STATUS | ACTIVE CAPABILITY; external scheduler history unverified. |

### `paperclip.on-demand-delegation`

| Field | Value |
| --- | --- |
| NAME | Paperclip Agent Delegation |
| PURPOSE | Assign controlled work through CEO, directors, Codex specialists, QA, and review. |
| TRIGGER | Board assignment/on-demand wake; heartbeat timers are disabled. |
| CONDITIONS | Agent is resumed, issue-scoped context is supplied, the correct primary repository workspace is selected, runtime can reach the loopback Paperclip API without sandbox bypass, and budget/approval boundaries permit work. |
| ACTIONS | Creates issues/subissues, executes scoped tasks, records logs/cost/status, and returns reviewed results. |
| DATA USED | Paperclip company/project/issue context and the assigned repository workspace. |
| OWNER | Board / VestBlock CEO. |
| FAILURE BEHAVIOR | Run becomes failed/cancelled with log reference; issue must be blocked or recovered. No automatic production authority. |
| RETRY POLICY | Manual/on-demand recovery; one agent run at a time; no heartbeat timers. |
| LOG LOCATION | Paperclip heartbeat-run logs, issue comments, activity, cost summary, and local database backups. |
| HOW TO DISABLE | Pause agents; timers are already disabled. |
| HOW TO TEST | Controlled read-only issue VES-2 with CEO → CTO → Frontend/Backend/QA → Reviewer. |
| STATUS | CONTROLLED PASS / SAFE REPEATABILITY BLOCKED — VES-2 completed CEO→CTO→Frontend/Backend/QA→Reviewer in 18 runs at $0 metered cost. All participating agents are paused, timers are disabled, bypass is off, and isolated-worktree policy is restored. A safe repeat remains blocked because the default sandbox cannot reach the loopback API without temporary bypass. |

### `autopilot.weekly-strategy`

| Field | Value |
| --- | --- |
| NAME | VestBlock Weekly Strategy Candidates |
| PURPOSE | Turn current pipeline, reply, content, SEO, and experiment evidence into scored candidate strategies. |
| TRIGGER | Founder action in AI Brain. No unattended schedule is enabled in this candidate. |
| CONDITIONS | Admin session, same-origin mutation, and live Command Center data. |
| ACTIONS | Writes review-required strategy records; does not launch a campaign or contact a provider. |
| DATA USED | Command Center snapshot, content assets, PR state, strategy memory, and experiment results. |
| OWNER | Founder / Strategy Engine. |
| FAILURE BEHAVIOR | Fails closed and shows the provider/database error. It does not create generic fallback evidence. |
| RETRY POLICY | Manual retry after the cause is visible. Weekly target keys prevent duplicate candidates. |
| LOG LOCATION | `strategy_updates`, `command_center_events`, and application logs. |
| HOW TO DISABLE | Set the strategy-generation control to off in the future policy editor or remove the UI action in a reviewed release. |
| HOW TO TEST | `pnpm run test:autopilot-strategy`; tagged live test uses exact cleanup. |
| STATUS | CANDIDATE VERIFIED — pure scoring and live strategy→campaign→result persistence passed. |

### `autopilot.content-studio`

| Field | Value |
| --- | --- |
| NAME | VestBlock Content Studio |
| PURPOSE | Create one reusable draft with platform variants, a graphic brief, video plan, and internal calendar record. |
| TRIGGER | Founder action in Growth → Content. |
| CONDITIONS | Admin session, same-origin mutation, OpenAI quota for generation, and founder review before distribution. |
| ACTIONS | Stores drafts and private branded graphics; internal calendar planning is allowed. It never publishes. |
| DATA USED | Founder prompt, selected service, content asset, and the real VestBlock monogram. |
| OWNER | Founder / Growth. |
| FAILURE BEHAVIOR | Provider errors are returned exactly; no placeholder copy, graphic, or video is marked generated. |
| RETRY POLICY | Manual retry after provider health is restored. No automatic paid-provider retry. |
| LOG LOCATION | `content_assets`, private `documents/content-studio` storage, `command_center_events`, and application logs. |
| HOW TO DISABLE | Set content generation to off in autonomy policy and deploy the reviewed change. |
| HOW TO TEST | `pnpm run test:autopilot-content-provider`. |
| STATUS | CODE READY / PROVIDER BLOCKED — the live provider returned `credit_balance_exhausted`; nothing was published. |

### `bridge.buffer-social`

| Field | Value |
| --- | --- |
| NAME | Buffer Approval-Gated Social Bridge |
| PURPOSE | Send an already-approved content asset through the founder's existing Buffer account. |
| TRIGGER | Explicit approved dispatch only; the content calendar remains internal by default. |
| CONDITIONS | Approved founder user, stored API key, selected channel ID, schedule time, and an idempotent result ledger. |
| ACTIONS | Preview locally or create one approved schedule request through the existing Buffer script. |
| DATA USED | Approved copy, selected channel ID, scheduled time, and VestBlock content ID. |
| OWNER | Founder / Growth Operations. |
| FAILURE BEHAVIOR | Missing approval/configuration or non-2xx response fails closed. Redirects are rejected. |
| RETRY POLICY | Manual, idempotent retry after inspecting the provider response. |
| LOG LOCATION | VestBlock content/result files plus Buffer history after connection. |
| HOW TO DISABLE | Remove the provider credentials or set social scheduling to off. |
| HOW TO TEST | Run `pnpm run buffer:facebook-calendar`, review the result, then schedule one private/test item only after credentials and destination are approved. |
| STATUS | LIVE AUTH VERIFIED / APPROVAL-GATED — the `vestblock socials` key and VestBlock Facebook channel are configured; no post was scheduled or published during setup. |

### `bridge.n8n-marketing`

| Field | Value |
| --- | --- |
| NAME | Signed n8n Marketing Bridge |
| PURPOSE | Execute visible cross-service workflows while keeping Supabase and VestBlock as the source of truth. |
| TRIGGER | Explicit approved dispatch only; adapter previews by default. |
| CONDITIONS | Approved founder user, exact HTTPS webhook URL, static Header Auth secret, HMAC signature, event contract, and matching idempotency key. |
| ACTIONS | Preview or send one signed event; core strategy logic remains in VestBlock. |
| DATA USED | Minimal event payload and VestBlock request ID. |
| OWNER | CTO / Growth Operations. |
| FAILURE BEHAVIOR | Missing approval/configuration, redirects, timeout, or non-2xx response fail closed. |
| RETRY POLICY | Manual, idempotent retry after workflow history is inspected. |
| LOG LOCATION | VestBlock event logs and n8n execution history after connection. |
| HOW TO DISABLE | Remove the webhook/secret or set the owning automation to off. |
| HOW TO TEST | Run `pnpm run test:n8n-provider-bridge`; for an explicitly approved live connection proof, run `pnpm run test:n8n-live-preview`. |
| STATUS | LIVE PREVIEW VERIFIED — workflow `wyi6LMTPGkhZCYYa` is published with Header Auth; a signed production-webhook proof returned HTTP 202 in preview mode, and no downstream write nodes exist. |

### `google-ads.report-monitor`

| Field | Value |
| --- | --- |
| NAME | Google Ads Report-Only Monitor |
| PURPOSE | Detect spend without conversion, high CPL, and low CTR without changing account state. |
| TRIGGER | Google Ads Scripts preview or approved schedule after account connection. |
| CONDITIONS | Authorized Ads account and preview review. The script contains no mutation API. |
| ACTIONS | Reads seven-day campaign metrics, emits a structured report, and recommends REVIEW or MAINTAIN. |
| DATA USED | Campaign ID/name/status and aggregate cost, click, impression, and conversion metrics. |
| OWNER | Founder / Paid Growth. |
| FAILURE BEHAVIOR | Script/log failure only; campaigns and budgets are unchanged. |
| RETRY POLICY | Next approved report run. No spend-changing retry exists. |
| LOG LOCATION | Google Ads Scripts execution logs; VestBlock ingestion is pending the approved n8n bridge. |
| HOW TO DISABLE | Remove its Ads Script schedule. |
| HOW TO TEST | `pnpm run test:google-ads-monitor`, then Google Ads Preview after credentials exist. |
| STATUS | CONTROLLED FIXTURE PASS / ACCOUNT BLOCKED — report logic passes; no Ads account is configured, so no live-account execution is claimed. |

### `manual.obsidian-strategy-vault`

| Field | Value |
| --- | --- |
| NAME | Obsidian Strategy Vault Export |
| PURPOSE | Project VestBlock strategy and aggregate learning memory into a local linked vault for founder review. |
| TRIGGER | Manual `pnpm run obsidian:vault:export`; no unattended schedule is installed. |
| CONDITIONS | Primary Mac Pro repository, valid Supabase read credential, and a safe local vault path. |
| ACTIONS | Reads strategy, aggregate experiment, strategy-run, content-count, and provider-verification records; writes Markdown, Bases, Canvas, and a provenance manifest. |
| DATA USED | Strategy records and aggregate operating metrics only. Lead/customer PII and credentials are excluded. |
| OWNER | Founder / Strategy Operations. |
| FAILURE BEHAVIOR | Exits non-zero on missing credentials, unsafe path, malformed Canvas, or a blocked sensitive field. It cannot publish, send, deploy, or spend. |
| RETRY POLICY | Manual rerun after correcting the local error. Human-owned files under `Notes/` are preserved. |
| LOG LOCATION | Command output and `~/Documents/VestBlock Strategy Vault/.vestblock-export-manifest.json`. |
| HOW TO DISABLE | Stop running the command or move the local vault to Trash. No background process exists. |
| HOW TO TEST | `pnpm run test:obsidian-vault`; then inspect one live export and compare manifest counts with Supabase. |
| STATUS | LIVE EXPORT PASS / MANUAL — Obsidian and four pinned skills are installed; the vault is registered and open on the Mac Pro. The first live export completed without warnings and the deterministic safety test passed. |

## Present but not active

- The other 43 cron routes are authorized entry points with no Vercel schedule.
- `scripts/gmail-reply-sync.ts` and `scripts/log-reply.ts` are manual recovery/operator tools, not schedulers.
- `daily-ops-report` works in authorized dry-run mode but is not scheduled by `vercel.json`.
- A weekly business growth report is not implemented; `pr-engine-weekly-learning` is PR-specific and does not satisfy that requirement.
- Eleven Codex desktop automations were found in the prior audit (seven active, four paused), but this session could not read their live desktop definitions from the MacBook Pro CLI. Their prior evidence remains in `docs/AUTOMATION_INVENTORY.json` and `docs/AUTOMATION_AUDIT.md`; they are not promoted to scheduler-of-record here without a fresh live check.

## Known control gaps

1. Production is on an older build, so candidate registry controls and the Resend route are not live.
2. Vercel run history is unavailable to the current connector scope.
3. Database-native schedules and RLS policy definitions could not be inspected because the Supabase management connector points to a different project.
4. Two launchd jobs are stale/failing and one is blocked by host-name governance.
5. Daily reporting is callable but unscheduled; weekly business reporting is absent.
6. Inbound email cannot be production-active until Resend Receiving, `email.received`, and the webhook secret are configured.
7. OpenAI content/graphic verification is blocked by exhausted provider credit.
8. Google Ads and ChatGPT Ads are not fully credentialed. Buffer, n8n, and Search Console have live authentication proofs, but no social publication, downstream n8n write, ad mutation, or spend is claimed.
