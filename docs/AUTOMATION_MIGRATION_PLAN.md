# VestBlock Automation Migration Plan

**Operation:** VestBlock Revenue Engine  
**Default posture:** Preserve history, consent, suppression, attribution, and rollback.  
**Production authority:** Human approval required. This plan does not authorize deployment, live sends, spending, contract execution, or deletion.

## Objective

Move VestBlock from fragmented automations to one observable Revenue Engine serving Deals, Capital, and Partners without interrupting revenue, losing history, duplicating outreach, or weakening compliance.

## Target operating model

Every automated action must resolve through:

1. a lane and pipeline stage;
2. a shared opportunity/contact/asset/match/activity identity;
3. one automation registry record with owner, scheduler, risk class, status, and rollback;
4. shared consent, suppression, reply-memory, and frequency policy;
5. a correlation ID and outcome event;
6. an approval policy appropriate to Green, Yellow, or Red risk.

### Risk classes

| Class | Examples | Default authority |
| --- | --- | --- |
| Green | Read-only research, scoring, drafting, dedupe, internal summaries, health checks | May run automatically with logging and bounded resource limits. |
| Yellow | Queue enrollment, external email under existing consent, configuration changes, pausing a failing worker | Requires policy gates, auditable reason, rollback, and owner visibility. New or ambiguous sends require human review. |
| Red | Payments, contracts, production deploys, secret deletion/rotation, bulk sends, destructive data/schema changes | Human approval required before execution. |

## Non-negotiable migration rules

- No deletion based only on filename, age, or static analysis.
- No secret removal until all callers are migrated and rollback expires.
- No blind sends, list uploads, or sequence enrollment outside shared consent and suppression checks.
- No production deploy without explicit human approval.
- No payment-webhook cutover without provider callback proof, signature tests, idempotency tests, and replay tests.
- Preserve old events, run history, suppression decisions, replies, and outcome attribution.
- One active scheduler owner per automation after migration.
- All retries must be bounded, idempotent where applicable, and visible.

## Required evidence for each automation

Before changing an automation, complete this record:

| Field | Requirement |
| --- | --- |
| Canonical ID and owner | Stable registry ID, business owner, technical owner. |
| Purpose and lane | Deals, Capital, Partners, Control Plane, or protected platform. |
| Trigger and scheduler | Vercel, Codex, launchd, Inngest, database, webhook, or manual. |
| Callers | Routes, package scripts, other scripts, imports, external provider callbacks. |
| Dependencies | Tables, queues, APIs, files, environment variables, provider accounts. |
| Actions | Read, write, draft, queue, send, charge, deploy, delete. |
| Recent history | Last success/failure, volume, outcomes, and error taxonomy. |
| Risk and approval | Green/Yellow/Red with explicit authority boundary. |
| Replacement | New service/route/workflow and parity checklist. |
| Rollback | Exact way to re-enable previous owner and reconcile missed work. |

## Migration sequence

Every retirement follows the same six gates.

### 1. Disable

- Stop only the scheduler owner, not the underlying code or data.
- Record who disabled it, why, timestamp, previous cadence, and rollback command.
- For Yellow/Red actions, require human approval before disablement when revenue or payment continuity could be affected.
- Leave credentials, code, tables, and history intact.

Exit condition: replacement is live in shadow/dry-run mode and both systems share correlation and comparison metrics.

### 2. Observe

- Minimum default observation: 7 days for internal jobs; 14 days for external outreach; 30 days for payments or low-frequency revenue events.
- Compare eligible records, suppressed records, actions, failures, duration, provider response, replies, and business outcomes.
- Alert on missing runs, double processing, volume deltas, and unmatched events.

Exit condition: no unexplained revenue, safety, consent, or attribution regression.

### 3. Archive

- Move the old record to archived status in the registry.
- Preserve code and immutable run history.
- Remove it from normal operator views while keeping it searchable.
- Document the replacement and rollback expiration date.

Exit condition: owner signs off that the archived system is no longer the scheduler of record.

### 4. Replace

- Route all callers to the shared service/workflow.
- Reuse common opportunity, contact, asset, match, activity, score, and suppression contracts.
- Enforce one sender and one follow-up state machine per channel.
- Keep adapters thin; business policy belongs in shared modules.

Exit condition: caller inventory reaches zero for the legacy path and replacement parity tests pass.

### 5. Test

Required layers:

- unit tests for scoring, stage transitions, policy, idempotency, and registry validation;
- contract tests for routes, webhooks, providers, and database writes;
- dry-run/shadow comparison using representative recent records;
- replay tests for events and failed jobs;
- end-to-end tests for Deals, Capital, and Partners journeys;
- rollback rehearsal;
- human review for Yellow/Red action paths.

Exit condition: evidence is attached to the registry record and alerts are operational.

### 6. Delete

Deletion is the final, separate decision.

- Confirm zero callers across code, schedules, external callbacks, dashboards, and database-native jobs.
- Confirm observation window and rollback expiration have passed.
- Export any required logs/configuration/history.
- Remove secrets only after confirming they are not shared.
- Use a recoverable branch/commit and document exact removals.
- For tables or production data, require a backup and explicit human approval.

Exit condition: deletion is reviewed, reversible through version control or backup, and does not erase required business records.

## 30-day staged rollout

### Days 0–3: Control plane

- Publish machine-readable inventory and human audit.
- Ship registry contracts and normalized executive snapshot.
- Show scheduler owner, risk, last/next run, status, failures, and action class in Command Center.
- Establish correlation IDs and a common activity vocabulary.
- Make no scheduler changes.

### Days 4–10: Shadow mode

- Normalize Deals, Capital, and Partners pipelines over existing tables.
- Run shared scoring and policy in shadow mode.
- Compare shared results with buyer, lender, investor, seller, and DealMachine loops.
- Produce daily brief and weekly CEO review from real events.

### Days 11–17: First bounded consolidation

- Merge one low-risk, no-send family first: DealMachine discovery/list-building/ingestion.
- Select one scheduler owner; disable duplicate triggers only after parity proof.
- Observe for at least seven days.
- Keep all send-capable automations unchanged.

### Days 18–24: Shared outreach controls

- Route drafting, eligibility, suppression, review, and follow-up through common policy.
- Preserve current channel and provider adapters.
- Put new/ambiguous external actions in review.
- Migrate one lane at a time; do not bulk-enroll.

### Days 25–30: Revenue and protected paths

- Review payment/DealVault integrations separately as Red risk.
- Verify PayPal live callback configuration and event coverage.
- Prepare, but do not execute, signed webhook consolidation without human approval.
- Approve archive candidates based on observed evidence.
- Hold weekly go/no-go review for the next migration batch.

## Family migration map

| Current family | Target owner | First move | Success measure |
| --- | --- | --- | --- |
| DealMachine/manual finder/stack/export | Deals Acquisition workflow | Shared ingest and dedupe, one scheduler owner | No duplicate properties; freshness and source attribution improve. |
| Buyer discovery/outreach/performance | Deals Disposition workflow | Shared opportunity/match score and outreach eligibility | Higher qualified matches and replies; lower failure/skip ambiguity. |
| Seller outreach and follow-up | Deals Acquisition workflow | Shared suppression, reply memory, frequency, and stage transitions | No consent regression; every send maps to opportunity and outcome. |
| Borrower/lender/funding loops | Capital workflow | Shared readiness, package, match, and follow-up stages | Faster complete packages and qualified lender matches. |
| Investor/vendor/referral loops | Partners workflow | Shared partner opportunity and relationship activity | Clear next action and measurable referral/relationship outcomes. |
| SEO/content/PR | Growth workflow | Experiment and opportunity attribution | Work tied to audience, pipeline, and measurable conversion. |
| Boss/morning/daily reports | CEO operating rhythm | One daily brief and one weekly review | One trusted view of money, pipeline, risks, and decisions. |
| Cron/launchd/Codex/Inngest | Control Plane | Shared registry with one active owner per job | No unknown or duplicate schedules; visible health and rollback. |

## Rollback standard

Every cutover must have:

- previous scheduler definition and status;
- last successfully processed cursor or timestamp;
- idempotency/reconciliation procedure;
- command or dashboard action to re-enable the prior owner;
- method to pause the replacement;
- owner and maximum rollback decision time;
- post-rollback reconciliation report.

Rollback must not re-send messages or reapply payment events. Reconciliation must prefer stable provider/event IDs and existing activity IDs.

## Observability standard

Every run and material action should emit:

- automation ID and version;
- run ID and correlation ID;
- lane, opportunity ID, contact ID, and asset ID when applicable;
- trigger and scheduler owner;
- risk class and approval reference;
- eligibility/suppression decision with reason;
- action, provider, status, duration, retry count, and error class;
- cost where available;
- outcome and next action.

Command Center should alert on:

- missed or late runs;
- repeated failures or stuck `running` states;
- unexpected send volume;
- suppressions bypassed or missing decisions;
- duplicate provider/event IDs;
- pipeline stage staleness;
- source or provider health degradation;
- production drift and unowned schedules.

## Human approval checkpoints

Explicit approval is required before:

- production deployment;
- enabling a new send path or increasing volume;
- enabling SMS or LinkedIn action;
- changing payment callbacks or processing rules;
- removing or rotating secrets;
- destructive schema/data changes;
- deleting legacy code, tables, history, or scheduler definitions;
- changing an external provider account or billing configuration.

## Completion criteria

The migration is complete when:

- every active automation is in the registry with one scheduler owner;
- all three strategy lanes use shared identities, activity, scoring, stage, suppression, and attribution contracts;
- Command Center answers what needs attention today, what is moving money, what is stuck, what ran, what failed, and who owns the next action;
- duplicate implementations have completed observation and caller-zero gates;
- protected payment and DealVault paths retain verified authenticity and idempotency;
- no live send, spend, deploy, contract, or destructive action can occur outside its approval policy.
