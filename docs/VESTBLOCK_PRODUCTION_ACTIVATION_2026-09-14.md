# VestBlock production activation — 2026-09-14

This record supersedes the disabled-state observations in the historical Gate 0 baseline. It does not rewrite that audit.

## Public platform

- `vestblock.io` and `www.vestblock.io` serve the approved VestBlock platform.
- The homepage routes people by outcome: Capital, Real Estate, Business Growth + AI, and Personal Roadmap.
- DealVault is the transaction and record layer, not the whole offer.

## Scheduled operating loop

- Vercel runs partner discovery, enrichment, scoring, draft generation, approval, guarded sending, mailbox sync, Buffer publishing/reconciliation, DealMachine acquisition, command-center operations, and improvement review.
- Partner preparation runs concurrently; only send stages execute serially so a shared permit lock is not misreported as a provider failure.
- Controlled-trial capacity rotates across enabled buyer, lender, and investor lanes.
- The shared trial budget uses a true trailing 24-hour attempt ledger.
- A provider attempt remains counted after a later bounce or failure.
- Each automatic buyer, lender, and investor lane has its own database-backed trailing 24-hour attempt quota. Overlapping cron and standalone runs cannot consume the same slot.

## Fail-closed delivery rules

- Resend delivery telemetry, Outlook reply capture, a business mailing address, current templates, usable recipient data, and suppression checks are required before claim/send.
- Approved partner messages are revalidated immediately before their atomic claim.
- Bounces, complaints, suppressions, and provider failures stop broad sending through the delivery circuit breaker.
- The lender recovery canary remains a manual, explicitly requested operation and is never a scheduled bypass.

## Enrichment

- Buyer and lender website analysis runs before paid Hunter lookup.
- Hunter-derived buyer, lender, and investor addresses must be `valid` with confidence of at least 90.
- Buyer, lender, and investor paid lookups each use database-backed global daily quotas that reset at midnight in `America/Chicago`. Every provider attempt is reserved before the Hunter request, including attempts that later fail.
- Buyer, lender, and investor claims prevent duplicate provider calls, recover stale work, cool terminal results for 30 days, and preserve an existing usable contact.
- Sparse investor rediscovery preserves usable contacts and repairs invalid placeholders while retaining website, market, and buy-box data.

## Operational interpretation

“Live” means the scheduled system runs automatically and records truthful provider evidence. It does not mean safety gates are bypassed. When delivery quality or recipient evidence is inadequate, records continue through sourcing, enrichment, scoring, and review while sending remains blocked.
