# Outreach V4 Rebuild

Last updated: 2026-05-17

## Current Bottleneck

The old outreach system is not failing because of one bad filter. It keeps hitting `qualified_pool_exhausted`: too many eligible leads were already sent, too many raw leads lack safe email/contactability, and the old throughput ladder couples scrape, enrich, draft, approve, and send work into a fragile loop.

V4 is a clean boundary beside the old system. The old pipeline stays available as legacy until V4 proves itself.

## V4 Architecture

Flow:

1. Market rotation.
2. Vertical-specific scraper.
3. Normalized V4 lead record.
4. Dedupe and quarantine.
5. Enrichment and scoring.
6. Draft generation.
7. Approval and send-control.
8. Daily scorecard and learning loop.

Current V4 files:

- `lib/leads/outreach-v4/config.mjs`
- `lib/leads/outreach-v4/market-rotation.mjs`
- `lib/leads/outreach-v4/scrapers.mjs`
- `lib/leads/outreach-v4/source-adapters.mjs`
- `lib/leads/outreach-v4/enrichment.mjs`
- `lib/leads/outreach-v4/scoring.mjs`
- `lib/leads/outreach-v4/dedupe-quarantine.mjs`
- `lib/leads/outreach-v4/templates.mjs`
- `lib/leads/outreach-v4/scorecard.mjs`
- `scripts/outreach-v4-dry-run.mjs`
- `scripts/outreach-v4-scorecard.mjs`

## Verticals

- AI Receptionist / missed lead capture.
- Search Visibility / ChatGPT visibility.
- DealVault / proof records / agreement tracking.
- Funding Prep / business setup.
- Businesses without websites.
- Businesses with weak websites or broken lead capture.
- Contractors / home services.
- Real estate / property / service businesses.
- Distressed house pipeline / real estate opportunity discovery.

## Distressed House Pipeline

Distressed house is separate from generic outreach.

It can create two buckets:

- `distressed_property_opportunities`: property/opportunity records for manual review only.
- `real_estate_partner_targets`: B2B targets such as investors, agents, contractors, property managers, lenders, and service partners.

Automatic homeowner/property-contact sending is blocked. The pipeline is designed for review/export first.

Allowed signals:

- Vacant property.
- Code violation.
- Tax delinquency where legally available.
- Absentee owner where legally available.
- Pre-foreclosure where legally available.
- Fire/water damage where legally available.
- Probate/estate indicator where legally available.
- Investor/contractor/agent/property-manager partner opportunity.

Blocked claims:

- No foreclosure rescue claims.
- No guaranteed cash offer claims.
- No funding guarantee.
- No legal advice.
- No guaranteed sale outcome.

## Market Rotation

V4 selects markets separately per vertical. Business outreach and distressed-house markets use separate pools and cooldown windows.

Rules:

- Avoid recently selected cities by vertical.
- Rotate by date and vertical so one city does not dominate.
- Log city, state, vertical, market key, and selected reason.
- Distressed-house market rotation is independent from business outreach rotation.

## Dedupe And Quarantine

Dedupe keys:

- Email.
- Website domain.
- Phone.
- Business name + city + state.
- Property address.
- Parcel/APN if available.
- Source URL.

Quarantine buckets:

- Duplicate identity.
- Missing email.
- Invalid/risky email.
- Suppressed or previous send risk.
- Manual-only distressed property.
- High compliance risk.

## Lead Quality Rules

V4 scores:

- Fit.
- Contactability.
- Urgency.
- Compliance risk.
- Duplicate risk.
- Distressed-property signal strength where relevant.

No lead becomes send-ready without a usable email, safe compliance risk, and a strong score. Distressed-house property records never become auto-send-ready.

## Commands

- Dry run: `npm run outreach:v4-dry-run`
- Real-source dry run for first adapter lane: `npm run outreach:v4-dry-run -- --real-source --real-source-verticals=ai_receptionist,no_website,weak_website --business-markets=2 --real-source-limit=5 --real-source-niches=2 --target=50`
- Real-source dry run with controlled email enrichment: `npm run outreach:v4-dry-run -- --real-source --enrich-missing-email --enrichment-limit=25 --target=50`
- Scorecard from latest dry run: `npm run outreach:v4-scorecard`
- Codex safety review and approve safe drafts: `npm run outreach:v4-approve -- --date=<date> --limit=50`
- Daily V4 automation workflow: `npm run outreach:v4-workflow`

Artifacts are written to:

- `artifacts/outreach-v4/<date>/market-rotation-plan.json`
- `artifacts/outreach-v4/<date>/outreach-v4-scorecard.json`
- `artifacts/outreach-v4/<date>/accepted-leads.csv`
- `artifacts/outreach-v4/<date>/quarantine.csv`
- `artifacts/outreach-v4/<date>/drafts.json`
- `artifacts/outreach-v4/<date>/approved-drafts.json`
- `artifacts/outreach-v4/<date>/rejected-drafts.json`
- `artifacts/outreach-v4/<date>/approval-summary.json`

## Next Build Step

The first real-source adapter is now wired for:

- AI Receptionist.
- No Website.
- Weak Website.

It uses configured maps providers in dry-run mode, normalizes records into V4, performs lightweight website checks, extracts public website emails/contact URLs where available, can run controlled Hunter/domain enrichment for missing-email records, and writes artifacts without ingesting into the legacy outreach tables.

Continue replacing the remaining dry-run sample scraper bodies with real source adapters one at a time:

1. DealVault relationship-heavy service adapter.
2. Real estate partner adapter.
3. Search Visibility adapter.
4. Distressed house public-signal importer.
5. Funding Prep adapter.

Do not add live sends until V4 produces enough verified, non-duplicate, non-risky leads in dry run and review mode.

Current target: `50` quality emails/day by default, configurable through `OUTREACH_V4_DAILY_TARGET` or `--target`.

Current real-source bottleneck: maps providers can find fresh businesses, but many records still lack usable public email. Keep routing missing-email records to quarantine/manual review unless website/Hunter enrichment finds a usable contact email.

## Latest 50/Day Test

Run on 2026-05-17 with real source adapters for AI Receptionist, No Website, and Weak Website plus controlled Hunter/domain enrichment:

- New leads scraped: 119.
- Qualified/reviewable leads: 83.
- Draft-ready leads: 37.
- Quarantined leads: 36.
- Enrichment checked: 50 missing-email records.
- Enrichment found: 32 usable candidate emails.
- Duplicate identities blocked: 14.
- Distressed-house auto-send: blocked.

Result: V4 is working as a safer, fresher outreach engine, but it is not yet reliably at 50 quality emails/day. The current gap is 13 additional send-ready leads. The next improvement is to expand real-source adapters beyond the first three verticals and run larger market batches until the ready gap reaches zero without lowering quality rules.

Codex approval result:

- Drafts reviewed: 37.
- Auto-approved: 37.
- Rejected: 0.
- Live sends: still blocked until the send-control step is explicitly run.

Automation check on 2026-05-17 after the V4 cutover:

- New leads scraped: 111.
- Qualified/reviewable leads: 79.
- Draft-ready leads: 40.
- Auto-approved drafts: 40.
- Rejected drafts: 0.
- Ready gap to 50/day: 10.
- Distressed-house property opportunities: 3.
- Distressed-house auto-send: blocked.

## Automation Cutover

On 2026-05-17, scheduled outreach automation was moved off the legacy V2/V3 loop.

- Desktop automations now run V4 commands, especially `npm run outreach:v4-workflow`.
- Vercel no longer schedules old outreach cron routes in `vercel.json`.
- Legacy outreach cron routes have been removed instead of guarded in place. Keep daily work on Outreach V4 plus offline draft generation, and do not reintroduce `ENABLE_LEGACY_OUTREACH_CRONS` as a bypass.
- Legacy send command aliases now block instead of sending from the old queue.
- V4 still does not send live emails; it produces fresh lead artifacts, quarantine exports, scorecards, and Codex-approved B2B draft packets.
