# VestBlock Growth Automation Audit

Last updated: 2026-05-01

## Current Growth System

VestBlock now has a real internal growth engine built on top of the existing `leads` table and admin system.

The current stack includes:

- unified lead storage in `leads`
- supporting lead-ops tables:
  - `lead_sources`
  - `lead_scores`
  - `outreach_messages`
  - `scrape_runs`
  - `lead_notes`
  - `outreach_send_events`
- admin pages:
  - `/admin/leads`
  - `/admin/leads/[id]`
  - `/admin/lead-sources`
  - `/admin/scrape-runs`
- scrape APIs:
  - `/api/leads/scrape/new-businesses`
  - `/api/leads/scrape/code-violations`
  - `/api/leads/scrape/google-places`
  - `/api/leads/scrape/sam`
- scoring and outreach APIs:
  - `/api/leads/score`
  - `/api/leads/generate-outreach`
  - `/api/leads/export`
- daily cron routes:
  - `/api/cron/leads-scrape`
  - `/api/cron/leads-score`
  - `/api/cron/leads-outreach`
  - `/api/cron/leads-followup`

## What Already Exists

### Lead collection

The repo already supports these lead sources:

- Wisconsin DFI new business filings
- Cincinnati public code-enforcement records
- Milwaukee Accela / enforcement search
- Google Places
- Outscraper Google Maps
- SAM.gov opportunity matching
- direct VestBlock forms for:
  - funding
  - AI receptionist / automation
  - service interest
  - real-estate seller requests
  - property/funding lead requests

### Lead scoring

The score engine now writes:

- overall score
- factor breakdown
- best offer
- urgency level
- contactability level
- language segment
- outreach angle
- estimated value label

### Outreach generation

The outreach system now generates:

- cold email
- SMS
- Facebook DM
- Instagram DM
- phone opener / script

It supports:

- deterministic templates
- OpenAI-assisted generation when `OPENAI_API_KEY` is present
- Spanish variants when language signals suggest it
- website-weakness angles
- seller / code-violation angles
- funding and business-growth angles

### Sending architecture

The app now has a separate outbound layer:

- Resend can be used for operator-safe outbound and system mail
- Gmail / Google Workspace can be used for inbox-style outbound if OAuth credentials are present
- send events are logged to `outreach_send_events`
- approved outreach can be auto-sent by cron only when explicitly enabled

### Daily automation

The daily automation loop now supports:

1. scraping public/new leads
2. rescoring leads
3. generating outreach drafts
4. queueing follow-up tasks
5. optionally sending approved outreach
6. notifying admins about follow-up backlog

## What Was Incomplete Before This Upgrade

Before this pass, the lead engine existed but still had important gaps:

- no full daily scrape -> score -> outreach -> follow-up automation loop
- no outbound send-event log
- no clean Gmail/Workspace sending path
- limited approval state for outreach
- limited lead-status model for operator work
- weak website-audit enrichment
- weaker Spanish and automation-offer routing
- inconsistent enrichment between direct user lead forms and imported leads

## What Is Now Safe To Reuse

These parts are the right foundation going forward:

- `lib/leads/types.ts`
- `lib/leads/schemas.ts`
- `lib/leads/repository.ts`
- `lib/leads/scoring.ts`
- `lib/leads/outreach.ts`
- `lib/leads/dailyAutomation.ts`
- `lib/leads/outbound.ts`
- `components/admin/lead-intelligence-dashboard.tsx`
- `components/admin/lead-detail-client.tsx`
- `app/api/admin/leads/*`
- `app/api/cron/leads-*`

## What Still Requires External Credentials

The system is production-safe without these keys, but some connectors will skip cleanly until they are added:

- `GOOGLE_PLACES_API_KEY`
- `OUTSCRAPER_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `GOOGLE_WORKSPACE_SENDER`

If those are missing:

- Google Places / Outscraper scraping is skipped
- Gmail outbound is unavailable
- the app should still return clear readiness detail instead of crashing

For the current VestBlock rollout, SAM.gov is intentionally disabled by default and is no longer treated as a required near-term dependency.

## What Is Duplicated Or Needs Caution

There are multiple lead-entry paths in the app:

- `/api/funding-lead`
- `/api/service-interest`
- `/api/real-estate-lead`
- `/api/sell-lead`
- `/api/ai-assistant-request`

They are now more aligned with the unified lead model, but they still represent multiple intake surfaces. Future changes should keep them mapped back into the same lead field strategy instead of creating more custom lead shapes.

Also note:

- Milwaukee enforcement data remains conservative because the public surface is address-driven
- public-source imports should stay quieter than direct hand-raiser leads to avoid spamming admins
- cold outbound should remain approval-gated unless deliverability and compliance operations are fully configured

## What Must Be Upgraded Next

The strongest next improvements after this pass are:

1. assign leads to operator owners and show per-owner queue views
2. add reply capture / inbox reconciliation if Gmail outbound is enabled
3. add lead-stage revenue reporting for won deals
4. add more city datasets for property distress and local business records
5. add a weekly digest for:
   - best leads
   - failed runs
   - under-contacted segments

## Production Readiness Summary

The growth automation engine is now a real operating subsystem, not just a rough scraper prototype.

It is ready for:

- admin-led daily use
- controlled outbound drafting
- source-health monitoring
- public/open-data lead harvesting
- Spanish-segment lead targeting
- website weakness and automation opportunity targeting

It still depends on third-party credentials for the highest-value provider-backed sources and Gmail outbound.

## 2026-05-01 Market Expansion Upgrade

The lead engine is no longer limited to a small fixed city list.

### Added now

- `target_markets` table for city and metro rotation
- daily market discovery
- large / mid / small city balancing
- niche rotation by market
- 30-day re-scrape protection unless results are strong
- feedback-loop scoring from lead and outreach results
- CSV lead import/export into the same operator queue
- suppression-aware send controls
- human approval mode with `AUTO_SEND_ENABLED=false` by default

### Safe to reuse

- `lib/leads/marketExpansion.ts`
- `lib/leads/dailyAutomation.ts`
- `/api/cron/discover-markets`
- `/api/cron/daily-lead-run`
- `/api/cron/send-outreach`
- `/api/cron/update-market-performance`
- `/api/admin/leads/import`
- `/api/leads/export`
- `/admin/market-expansion`

### Current operating model

Daily growth automation now works like this:

1. discover markets
2. activate a mixed batch of large, mid, and small cities
3. rotate niches inside those cities
4. scrape and deduplicate leads
5. score and offer-match leads
6. generate outreach
7. queue only compliant leads for review
8. optionally send approved leads when auto-send is explicitly enabled

### Remaining dependency risks

The national engine is code-complete, but provider-backed growth volume still depends on:

- `OUTSCRAPER_API_KEY` or `GOOGLE_PLACES_API_KEY`
- Gmail / Workspace OAuth credentials for warm outbound
