# Gate 1 — DealMachine export retirement and native API boundary

- Date: 2026-08-14
- Host: `MacBookPro.lan` (primary Mac Pro)
- Repository: `/Users/mrsanders/VestBlock Codex Sync/Codex Folder`
- Branch: `codex/operation-rebrand-final`

## Outcome

Automated DealMachine export acquisition, download polling, ingestion, and export-driven outreach are retired. Historical export files and database records remain preserved as read-only evidence. The replacement integration is a server-only native API boundary that is intentionally inactive until a new credential is verified and `DEALMACHINE_SOURCE_ENABLED=true` is set explicitly.

This document supersedes every older VestBlock instruction that recommends DealMachine browser/session automation, private endpoints, Contacts exports, export watchers, export CSV ingestion, or export-driven outreach.

## Schedule shutdown evidence

The only active local DealMachine export schedule was LaunchAgent `io.vestblock.dealmachine-export-watcher`, which ran every 900 seconds and at load.

- Disabled with `launchctl bootout` before code removal.
- Active plist removed from `~/Library/LaunchAgents/`.
- Recoverable copy retained at `~/Library/LaunchAgents/Disabled/io.vestblock.dealmachine-export-watcher.plist.retired-2026-08-14`.
- Archived plist SHA-256: `c124dd631e7df7f86f40b29861f788dc89ff6fa12fb85d7ed7c8eecf3493efdc`.
- Retired watcher script SHA-256 before deletion: `d707eed87d6b7a509f9e1742627f6d523c094bd97c024e5c3061760d25ac7456`.
- `launchctl print gui/501/io.vestblock.dealmachine-export-watcher` returns “Could not find service”.
- No watcher, export autoloop, or export orchestrator process is running.
- No DealMachine export cron is configured in `vercel.json`.

The archived plist is rollback evidence, not an approved restart mechanism. A code rollback must not reload the watcher unless the export-retirement decision itself is explicitly reversed.

## Dependency inventory and decision

| Surface | Evidence found | Gate 1 decision |
| --- | --- | --- |
| Export generation | Browser/session/private API, saved-list, API-list, list-builder, strategy-runner, market-harvest, and export-request scripts | Removed |
| Scheduled acquisition | LaunchAgent plus local watcher | Unloaded first; plist recoverably archived; installer and watcher removed |
| File polling and ingestion | Downloads watcher, CSV ingest, webhook ingest, cron ingest | Removed |
| Vercel cron | No scheduled export route in `vercel.json`; an unscheduled native acquisition route exists | Native route retained but hard-gated by source flag and credential |
| n8n | No DealMachine workflow artifact exists in the repository. The Mac Pro has only webhook URL/secret configuration, not an n8n management API credential, so remote workflow enumeration cannot be independently asserted from this host | No new workflow created; Gate 4 must verify the n8n account before any native schedule is allowed |
| Database/Supabase jobs | No `pg_cron`, Supabase scheduled job, or DealMachine database runner found; historical source enums and strategy/audit rows exist | Historical records preserved; no schema deletion |
| Inngest | No DealMachine Inngest job found | No action |
| GitHub Actions | No DealMachine/export workflow reference found | No action |
| Webhooks | Export CSV webhook and webhook tests | Removed; no browser/private webhook fallback remains |
| Admin controls | Export commands, pending-download prompts, and export-centric freshness copy | Replaced with authenticated native health and inactive-source status |
| Environment | Existing `DEALMACHINE_API_KEY` is present but user reports it is invalid; source/sync enable flags are absent; legacy web token remains server-side | No credential copied or exposed; native sync remains off; legacy web token is no longer consumed by application code |
| Retry queues and alerts | Export job state, autoloop, follow-up, orchestrator, and freshness prompts | Active producers/commands removed; historical artifacts remain readable but excluded from freshness and authorization |
| Documentation | Multiple pre-migration guides instructed export workflows | Superseded by this runbook; deleted commands must not be restored |

## Retired implementation groups

- Routes: export-ingest cron and DealMachine export webhook.
- Runtime: local export watcher and its LaunchAgent installer.
- Export acquisition: API-list, browser/session/private, list-builder, saved-list, website-list, token rebuild, market harvest, and export request tools.
- Export processing: CSV ingest, v2 CSV ingest, contact-export parser, export job state, research checklist, and SMS-export queue tools.
- Export-driven outreach: export outreach, owner-email, seller autopilot, lowball export queue/runner, portfolio/builder/land/multifamily/BTR/commercial wrappers, tax-code export wrappers, and export autoloops.
- Obsolete tests: export webhook and export system tests.

Unrelated manual CSV import capabilities are retained. `data/dm-exports/` is retained as an archived evidence directory and is not an active inbox.

## Native API boundary

Authoritative base URL: `https://api.v2.dealmachine.com/v1`.

The server-only client and adapter now provide:

- official `dm_sk_live_*` and `dm_at_live_*` credential-format validation;
- a free `/account` authentication health check;
- connection states `not_configured`, `configured_unverified`, `working`, `rate_limited`, `unauthorized`, and `provider_unavailable`;
- explicit inactive/active state separate from credential health;
- official property/people search, fields, filters, locations, usage, and estimate calls;
- page/per-page pagination and per-strategy next-page state;
- minute/day rate-limit capture, `Retry-After`, request pacing, bounded exponential retry, timeouts, and retryable-error classification;
- normalized property identity/address, owner identity, email, non-DNC telephone, source/provider timestamps, provider record IDs, and strategy provenance;
- deterministic deduplication using provider property and person IDs;
- incremental page/start-after controls and source-event provenance;
- suppression metadata that defaults SMS to false/review-only and never treats email consent as known;
- cost estimation and credit-budget checks before applied searches.

The client does not contain browser automation, private endpoints, export generation, export download, or CSV ingestion methods.

## Inactive and missing-credential behavior

- Missing or malformed keys return a health/result state; they do not throw during page rendering or builds.
- A valid-looking key remains `configured_unverified` until the authenticated health check succeeds.
- `syncDealMachineLeadSource` returns an inactive result unless the source flag is on, even if called outside a route.
- The admin sync route requires lead-admin authorization, the source enable flag, a verified provider connection, and a strict bounded request body.
- The cron route requires cron authorization and the same explicit source flag; it is not listed in Vercel cron configuration.
- No production contacts, health success, or API availability are mocked.

## Weekend activation checklist

Do these steps in order. Stop on the first failure.

1. In DealMachine Settings → Developer/API, create or copy the replacement full `dm_sk_live_*` key. Never paste it into chat, a commit, a document, or a client-side variable.
2. Replace `DEALMACHINE_API_KEY` in the Mac Pro `.env.local`. Add the same server-only value to the correct Vercel project for Development, Preview, and Production. Do not add it with a `NEXT_PUBLIC_` prefix.
3. Keep `DEALMACHINE_SOURCE_ENABLED` absent or `false`.
4. Run `pnpm run dealmachine:health`. Require state `working`. Record the non-secret request/rate-limit evidence; never record the key.
5. From an authenticated admin session, run one small cost-estimate request for page 1 with no apply. Confirm filters, fields, reported credits, pagination, and no CRM writes.
6. Inspect a small provider sample and confirm property ID/address, person ID/name, emails, phones, `do_not_call`, provider timestamps, and mailing/residence fields match the current API documentation.
7. Confirm CRM normalization, provider-ID deduplication, source provenance, opt-out/DNC suppression, and review-only SMS defaults using the sample. Do not send outreach.
8. Set `DEALMACHINE_SOURCE_ENABLED=true` only in the intended environment after the prior checks pass. Run one manually approved, low-page-size apply request.
9. Confirm the source event, inserted/updated CRM rows, duplicate behavior, timestamps, suppression fields, and credit/rate-limit accounting.
10. Keep all scheduling off. Scheduling and n8n orchestration may be considered only in Gate 4 after the strategy registry, CRM lifecycle, compliance controls, and pilot design are approved. Never restore export automation.

No additional information should be required unless DealMachine’s account-specific response differs from its published field, pagination, or rate-limit contract.

## Data preservation and rollback

- No historical property, prospect, outreach, suppression, strategy, or audit database rows were deleted.
- No file under `data/dm-exports/` was deleted.
- Historical export-derived records may remain labeled with their original source for lineage, but they cannot authorize new acquisition or count as fresh native API evidence.
- Unrelated manual imports remain available.
- Roll back the code with Git if necessary; do not reload the archived LaunchAgent. A rollback that re-enables exports violates this approved migration.

## Provider references

- API quickstart and authentication: https://dealmachine.com/guides/api-quickstart
- AI-readable API documentation: https://api.docs.dealmachine.com/ai-assistants/llms-txt
- Search groups and pagination concepts: https://api.docs.dealmachine.com/concepts/groups
- People/contact fields, including DNC: https://api.docs.dealmachine.com/reference/people-fields
