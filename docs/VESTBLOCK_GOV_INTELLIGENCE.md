# VestBlock Government Intelligence

This release turns the SAM.gov integration into a broader government contracting intelligence layer for VestBlock.

## Services Enabled

- Public SAM opportunity ingestion with richer filtering
- Gov contract watchlists and hot-opportunity scoring
- Lead conversion for high-fit opportunities
- Bid / no-bid recommendation summaries
- Exclusion screening for tracked watchlists and entities
- Competitor award tracking
- Assistance listing matching
- Agency / NAICS performance reporting
- Admin digest and protected cron automation

## New Data Model

Required migration:

- `db/migrations/045-create-sam-intelligence.sql`

Core tables:

- `sam_watchlists`
- `sam_opportunities`
- `sam_opportunity_documents`
- `sam_entity_profiles`
- `sam_exclusion_checks`
- `sam_alert_runs`
- `sam_award_intelligence`

Additional support table:

- `sam_assistance_listings`

## Admin Surface

The admin panel now includes a `Government` tab backed by:

- `GET /api/admin/sam/dashboard`

This surface shows:

- watchlists
- watchlist create / edit / pause / archive / delete controls
- hot opportunities
- recent SAM document ingestion coverage
- exclusion screening results
- competitor award feed
- assistance listing matches
- agency buyer intelligence
- recent automation runs
- live verification state for key SAM endpoints

## New Cron Routes

- `/api/cron/sam-opportunity-ingest`
- `/api/cron/sam-match-scoring`
- `/api/cron/sam-exclusion-rechecks`
- `/api/cron/sam-award-monitor`
- `/api/cron/sam-assistance-refresh`
- `/api/cron/sam-alert-delivery`

These are protected by `CRON_SECRET` like the rest of the repo cron routes.

## Environment Variables

Required:

- `SAM_GOV_API_KEY`
- `LEADS_ENABLE_SAM=true`

Recommended:

- `ADMIN_ALERT_EMAIL`
- `OPENAI_API_KEY`

Optional tuning:

- `SAM_API_CACHE_TTL_SECONDS`
- `SAM_API_RETRY_LIMIT`
- `SAM_API_MAX_PAGES`
- `SAM_WATCHLIST_BATCH_LIMIT`
- `SAM_OPPORTUNITY_DAYS_BACK`
- `SAM_OPPORTUNITY_PAGE_LIMIT`
- `SAM_DOCUMENT_FETCH_LIMIT`
- `SAM_DOCUMENT_RESOURCE_LINK_LIMIT`
- `SAM_MATCH_LIMIT`
- `SAM_WATCHLIST_MATCH_THRESHOLD`
- `SAM_LEAD_MATCH_THRESHOLD`
- `SAM_LEAD_MATCH_LIMIT`
- `SAM_ENTITY_SYNC_LIMIT`
- `SAM_EXCLUSION_CHECK_LIMIT`
- `SAM_AWARD_DAYS_BACK`
- `SAM_AWARD_WATCHLIST_LIMIT`
- `SAM_AWARD_PAGE_LIMIT`
- `SAM_ASSISTANCE_WATCHLIST_LIMIT`
- `SAM_ASSISTANCE_PAGE_SIZE`

## API Scope

The implementation is intentionally built on public SAM/GSA APIs only:

- Opportunities API
- Entity Management API
- Exclusions API
- Assistance Listings API
- Federal Hierarchy Public API

It does not assume FOUO or sensitive access.

## Verification Notes

The admin dashboard runs a lightweight live verification against:

- Opportunities API
- Federal Hierarchy API

If the configured key is invalid, the Government tab and cron routes should still fail clearly without breaking the rest of the application.

The opportunity ingest route also attempts to fetch public `description_url`, `additional_info_link`, and a limited number of `resource_links` per opportunity. PDF attachments are parsed server-side when the response is publicly accessible.
