# VestBlock Property Intelligence Phase 1

This module adds the first usable slice of the AI Deal Hunter / OSINT Property Intelligence system.

## What Phase 1 Includes

- Admin page: `/admin/deal-hunter`
- Limited user-facing page: `/deal-hunter`
- CSV and GeoJSON public-record import API
- OpenStreetMap-powered map view
- Vacant lot detection with a 0-100 confidence score
- Basic deal scoring with reason codes and plain-English next actions
- Safe outreach draft generation based only on documented public signals
- CSV export for reviewed opportunities
- Manual-only OSINT adapter stubs for SpiderFoot, theHarvester, Maigret, Sherlock, Holehe, and PhoneInfoga

## Database Setup

Apply `supabase-property-intelligence.sql` in Supabase before using the import UI in production.

The migration creates:

- `property_intelligence_sources`
- `property_intelligence_imports`
- `property_intelligence_records`
- `owner_entities`
- `property_signals`
- `owner_contact_candidates`
- `parcel_geometries`
- `map_layers`
- `osint_results`
- `deal_scores`
- `buyer_match_results`
- `enrichment_jobs`
- `provider_sync_logs`
- `outreach_preparation_records`
- `property_intelligence_relationships`

RLS is enabled on all tables. The Phase 1 app routes use the service-role admin client, so public/anon table access remains closed by default.

## Feature Flags

Set these in Vercel/Supabase runtime environment as needed:

- `PROPERTY_INTELLIGENCE_ENABLED` defaults to enabled.
- `MAP_LAYERS_ENABLED` defaults to enabled.
- `OUTREACH_PREP_ENABLED` defaults to enabled.
- `DEALMACHINE_SYNC_ENABLED` defaults to disabled.
- `OSINT_ADAPTERS_ENABLED` defaults to disabled.
- `OVERPASS_ENRICHMENT_ENABLED` defaults to disabled.
- `DOCUMENT_INTELLIGENCE_ENABLED` defaults to disabled.
- `BUYER_MATCHING_ENABLED` defaults to disabled.

External-provider and OSINT features stay disabled until credentials, terms, and compliance workflow are reviewed.

## Import Format

The importer accepts CSV or GeoJSON. It recognizes common county/assessor fields such as:

- `parcel_id`, `apn`, `pin`
- `property_address`, `site_address`, `situs_address`
- `city`, `state`, `zip`
- `owner_name`
- `mailing_address`, `mailing_city`, `mailing_state`, `mailing_zip`
- `land_use`, `property_class`
- `assessed_value`, `land_value`, `building_value`, `improvement_value`
- `structure_sqft`, `lot_sqft`
- `latitude`, `longitude`

Original raw fields are stored with each record so future import mappers can be improved without losing source context.

## Safety Rules

Do not auto-run OSINT tools against private individuals. Phase 1 only exposes adapter metadata and compliance warnings. Tool runners should remain admin-only and manual until Phase 3 adds reviewed per-adapter execution.

Outreach drafts must not imply private knowledge such as mortgage delinquency unless the source is public and documented in the imported record.

## DealMachine API Configuration

The adapter lives in `lib/property-intelligence/dealmachine-adapter.ts`.

Required env var for future live sync:

- `DEALMACHINE_API_KEY`

Manual sync route:

- `POST /api/admin/property-intelligence/dealmachine-sync`

The route is blocked unless `DEALMACHINE_SYNC_ENABLED=true`. The adapter currently maps DealMachine-style payloads into the normalized property intelligence format and returns a guarded message until the live endpoint contract is confirmed.

## Supported Data Sources

- County parcel CSV
- County tax delinquency CSV
- City code violation CSV
- Public assessor CSV
- Public GIS/GeoJSON
- DealMachine API payloads through adapter mapping
- OpenStreetMap / Overpass neighborhood enrichment through a disabled-by-default adapter

## Future Paid Provider Integration

Future providers should plug in behind the same normalized property/contact objects:

- skip trace provider results -> `owner_contact_candidates`
- parcel geometry provider -> `parcel_geometries`
- court/tax/code lists -> `property_signals`
- scoring overlays -> `deal_scores`

Keep source name, source URL/file name, import date, confidence, raw original fields, and normalized fields for every imported record.

Current future-provider stubs:

- ATTOM
- PropStream-style provider
- licensed skip trace provider
- Firecrawl for permitted public pages
- Scrapy-based permitted crawlers
- SpiderFoot, theHarvester, Maigret, Sherlock, Holehe, PhoneInfoga as manual-only OSINT adapters
