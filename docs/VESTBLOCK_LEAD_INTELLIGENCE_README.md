# VestBlock Lead Intelligence Engine

This release adds a lead-generation and lead-ops system directly inside VestBlock.

## What It Includes

- Unified lead intelligence on top of the existing `leads` table
- New supporting tables:
  - `lead_sources`
  - `lead_scores`
  - `outreach_messages`
  - `scrape_runs`
  - `lead_notes`
- Admin pages:
  - `/admin/leads`
  - `/admin/leads/[id]`
  - `/admin/lead-sources`
  - `/admin/scrape-runs`
- Retired legacy lead scraping routes:
  - `/api/leads/scrape/new-businesses`
  - `/api/leads/scrape/code-violations`
  - `/api/leads/scrape/google-places`
  - `/api/leads/scrape/sam`
- Lead scoring route:
  - `/api/leads/score`
- Retired outreach route:
  - `/api/leads/generate-outreach`
- CSV export:
  - `/api/leads/export`

## Database Migration

Run:

- `db/migrations/031-create-lead-intelligence-engine.sql`
- `db/migrations/032-add-outscraper-lead-source.sql`
- `db/migrations/033-fix-lead-upsert-conflict.sql`
- `db/migrations/034-growth-automation-upgrade.sql`

This migration:

- expands the existing `leads` table with lead-intelligence columns
- creates the new lead-ops tables
- seeds example lead sources
- adds indexes and admin-only RLS policies
- adds outreach send-event logging and daily automation fields

## Required Environment Variables

- `GOOGLE_PLACES_API_KEY`
- `OUTSCRAPER_API_KEY`
- `SAM_GOV_API_KEY`
- `OPENAI_API_KEY`
- `RESEND_API_KEY`
- `ADMIN_ALERT_EMAIL`
- `FROM_EMAIL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `GOOGLE_WORKSPACE_SENDER`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Source Notes

### Wisconsin DFI

- Uses the public Wisconsin DFI corporate records search
- Best for recently indexed business filings, registered-agent lookups, and setup/funding follow-up

### Code Violations

- Cincinnati route uses the public open-data endpoint
- Milwaukee route uses the public Accela enforcement search
- Milwaukee works best when you provide a street, city, or zip seed because the public search is address-driven

### Google Places

- Uses the Google Places Text Search endpoint
- Pulls business name, address, phone, website, rating, and type
- Runs a website weakness analysis for upgrade and AI receptionist lead signals

### Outscraper Google Maps

- Uses Outscraper's Google Maps API / SDK
- Best when you want extended place fields, broader result coverage, or a batch-friendly Google Maps workflow
- Supports the same `/api/leads/scrape/google-places` route using `provider: "outscraper"` or `provider: "auto"`

### SAM.gov

- Uses the public SAM opportunities API
- Matches opportunities to existing business leads already in VestBlock
- Best results come after you have already loaded local businesses from Google Places or public business filings

## Lead Scoring Model

Each lead is scored from `0-100` using:

- urgency
- business age
- funding need likelihood
- website weakness
- language niche
- distress signal
- contract fit
- contactability
- estimated value to VestBlock

The engine writes both:

- `leads.lead_score`
- a detailed `lead_scores` record with factor breakdowns

## Outreach Generation

For each lead, VestBlock can generate:

- SMS
- cold email
- Facebook/DM
- phone script

Behavior:

- uses OpenAI when `OPENAI_API_KEY` is set
- falls back to deterministic templates if AI is unavailable
- stores drafts in `outreach_messages`
- includes channel-specific compliance notes

## Admin Workflow

### `/admin/leads`

- filter by source
- filter by offer
- filter by city
- filter by status
- filter by minimum score
- export CSV
- rescore leads
- regenerate outreach
- update status inline

### `/admin/leads/[id]`

- view contact and source details
- inspect pain signal and assigned offer
- review outreach drafts
- add internal notes

### `/admin/lead-sources`

- inspect configured sources
- run scrapes directly from the admin UI
- view source type, market, and last run
- see which provider keys are configured versus still missing

### `/admin/scrape-runs`

- monitor scrape history
- view status, counts, and timestamps

## Daily Automation

The old app-route daily automation was retired. Keep daily outreach on the offline/V4 workflow instead of recreating these removed routes:

- `/api/cron/leads-scrape`
- `/api/cron/leads-score`
- `/api/cron/leads-outreach`
- `/api/cron/leads-followup`

Current operator path:

- `npm run outreach:v4-workflow`
- `npm run outreach:v4-scorecard`
- `npm run buyers:kimi-outreach`
- `npm run buyers:kimi-send-preview`
- `npm run buyers:kimi-send-approved` only after draft review

Historical env controls from the retired routes should not be used for new daily work:

- `LEADS_AUTO_SEND_APPROVED`
- `LEADS_DAILY_SCRAPE_LIMIT_PER_SOURCE`
- `LEADS_DAILY_OUTREACH_LIMIT`
- `LEADS_DAILY_SEND_LIMIT`
- `LEADS_DAILY_FOLLOWUP_TASK_LIMIT`

## Outbound Sending

Outbound email now supports:

- Gmail / Google Workspace via OAuth refresh token
- Resend fallback

The send path is intentionally approval-aware and keeps a separate `outreach_send_events` log.

## Suggested First Runs

1. Run the migration.
2. Run `npm run outreach:v4-workflow` for the general offline outreach queue.
3. Run `npm run buyers:kimi-outreach` when buyer CSVs are refreshed.
4. Review generated drafts under `artifacts/offline-automation/outreach-drafts/<date>/buyers`.
5. Preview sends with `npm run buyers:kimi-send-preview`.
6. Send only reviewed/approved drafts with `npm run buyers:kimi-send-approved`.

## Example Request Bodies

### Google Places

```json
{
  "city": "Milwaukee",
  "state": "WI",
  "niches": ["contractors", "restaurants", "spanish-speaking businesses"],
  "limitPerNiche": 6,
  "provider": "auto",
  "language": "en",
  "region": "us"
}
```

### Wisconsin Business Filings

```json
{
  "query": "LLC",
  "limit": 10,
  "daysBack": 45
}
```

### Code Violations

```json
{
  "provider": "all",
  "limit": 20,
  "daysBack": 120,
  "city": "Milwaukee",
  "state": "WI",
  "zip": "53206"
}
```

### SAM Matching

```json
{
  "keyword": "janitorial",
  "naicsCodes": ["561720"],
  "state": "WI",
  "daysBack": 30,
  "limit": 20
}
```

## Operational Notes

- The scrape routes are admin-protected.
- Public APIs and public search surfaces are preferred.
- Source URLs are preserved on leads.
- The Milwaukee enforcement connector is intentionally conservative because the public Accela surface is form-driven.
- Bulk scrape imports are intentionally quieter than direct sales leads: admin alert automation only escalates higher-intent imported leads to avoid inbox spam.
- When Google Maps or SAM provider keys are missing, those routes now return `503` with a provider-readiness payload instead of a generic server error.
