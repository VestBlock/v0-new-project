# Property Intelligence Implementation Plan

## Current Stack Read

- Framework: Next.js App Router with TypeScript.
- Database: Supabase/Postgres via service-role server routes.
- Auth/admin: existing `checkAdminAccess` and `requireLeadAdmin` patterns.
- UI: existing shadcn-style components under `components/ui`.
- Existing systems preserved: property analyzer, DSCR/funding pages, buyers, outreach AI, admin command center, and existing API routes.

## Safe Modular Approach

The new layer lives under:

- `lib/property-intelligence`
- `components/property-intelligence`
- `components/admin/property-intelligence-dashboard.tsx`
- `app/admin/deal-hunter`
- `app/deal-hunter`
- `app/api/admin/property-intelligence`
- `app/api/property-intelligence`

It does not rename, delete, or replace existing VestBlock features.

## Phase 1

- Add isolated database tables with `property_intelligence_*` naming where appropriate.
- Add CSV/GeoJSON imports.
- Normalize property records and owner/entity records.
- Detect duplicates by parcel ID and normalized address.
- Detect vacant lots and public distress signals.
- Calculate explainable deal scores.
- Show records on an OpenStreetMap map.
- Generate safe outreach drafts for admin approval.
- Export reviewed leads to CSV.

## Phase 2 Stubs

- DealMachine API adapter behind feature flag.
- Provider sync logs and enrichment jobs.
- Buyer matching hooks.
- DSCR analyzer prefill hooks.
- Funding suggestion hooks.
- Outreach preparation records.
- Graph-style relationship records.

## Phase 3 Stubs

- OSINT adapters: SpiderFoot, theHarvester, Maigret, Sherlock, Holehe, PhoneInfoga.
- Firecrawl and permitted Scrapy crawler adapter stubs.
- Future ATTOM, PropStream-style, and skip-trace provider adapters.
- Overpass neighborhood enrichment adapter.

## Safety Defaults

Risky external-provider features default to disabled.

No automated OSINT runs, texts, calls, captcha bypass, login bypass, private data scraping, credential stuffing, or hidden social scraping are implemented.
