# VestBlock Lead Sources

Last updated: 2026-05-01

## Active Source Catalog

### Wisconsin DFI New Businesses

- source key: `wisconsin_dfi_new_businesses`
- type: public filing source
- use case:
  - new LLC / corporation targeting
  - business setup / compliance help
  - early funding-readiness follow-up

Primary offers:

- `Business Setup / Compliance Help`
- `Business Funding`
- `Business Credit Builder`

## Cincinnati Code Enforcement

- source key: `cincinnati_code_enforcement`
- type: public open-data source
- use case:
  - distressed property leads
  - seller leads
  - compliance-pressure outreach

Primary offers:

- `Real Estate Seller Lead`
- `Grant / Funding Roadmap`

## Milwaukee Accela Enforcement

- source key: `milwaukee_accela_enforcement`
- type: public enforcement search
- use case:
  - distressed property leads
  - seller-fit routing
  - cleanup/compliance angle

Notes:

- best with tighter address seeds
- public surface is conservative and address-driven

Primary offers:

- `Real Estate Seller Lead`

## Google Places Businesses

- source key: `google_places_businesses`
- type: API-backed business discovery
- use case:
  - urban local businesses
  - businesses needing funding
  - businesses needing website help
  - businesses needing receptionist/booking automation
  - Spanish-speaking business targeting

Primary offers:

- `Business Funding`
- `AI Receptionist Launch`
- `AI Appointment Booking System`
- `Website Upgrade Sprint`
- `Spanish Funding Assistance`

Requires:

- `GOOGLE_PLACES_API_KEY`

## Outscraper Google Maps Businesses

- source key: `outscraper_google_maps_businesses`
- type: Google Maps enrichment provider
- use case:
  - batch-style local business discovery
  - expanded business metadata
  - alternative provider when Google Places is not preferred

Primary offers:

- `Business Funding`
- `AI Receptionist Launch`
- `AI Appointment Booking System`
- `Website Upgrade Sprint`
- `Spanish Funding Assistance`

Requires:

- `OUTSCRAPER_API_KEY`

## Apify Yelp Businesses

- source key: `apify_yelp_businesses`
- type: actor-backed directory discovery
- use case:
  - harder local-business expansion outside the Google Maps path
  - Yelp category discovery for service businesses
  - additional phone/address/website-first lead coverage

Primary offers:

- `Business Funding`
- `AI Receptionist Launch`
- `AI Appointment Booking System`
- `Website Upgrade Sprint`
- `Spanish Funding Assistance`

Requires:

- `APIFY_TOKEN`

Current rollout note:

- used as an expansion source, not a replacement for Outscraper
- first actor target is Yelp so VestBlock can add harder directory coverage without a large rewrite

## SAM Contract Opportunities

- source key: `sam_contract_opportunities`
- type: public federal opportunity matching
- use case:
  - government-contract readiness
  - subcontract opportunity support
  - business-category opportunity routing

Primary offers:

- `Gov Contract Readiness`
- `Grant / Funding Roadmap`

Requires:

- `SAM_GOV_API_KEY`

Current rollout note:

- disabled by default unless `LEADS_ENABLE_SAM=true`
- safe to leave off while VestBlock focuses on funding, websites, automation, and real-estate growth

## Non-Google Business Discovery Paths

VestBlock can still grow lead volume without Google Places or Outscraper by leaning harder on:

- state business filing records
- city and county business-license datasets
- chamber / member directories where terms allow
- code-enforcement and distressed-property records
- landlord / property-maintenance public datasets where legally accessible
- CSV imports from purchased or manually sourced lead lists

That means the growth engine does not depend entirely on Google-backed business discovery, even though Google-style business data is still the strongest broad local-business source when available.

## Direct VestBlock Form Sources

These are not public-source scrapers, but they should still flow into the same lead intelligence system:

- funding forms
- service-interest forms
- AI receptionist / automation forms
- seller forms
- real-estate funding forms

These matter because they are usually higher-intent than imported public-source leads.

## Website Weakness Detection

Website analysis runs on leads with websites and looks for:

- no website
- weak mobile fit
- no obvious CTA
- no chat
- no online booking
- weak trust signals
- old/thin site structure

This helps route leads into:

- `AI Receptionist Launch`
- `AI Appointment Booking System`
- `Website Upgrade Sprint`

## Priority Markets

The lead engine now uses `target_markets` instead of staying locked to a short static city list.

Starter expansion focus includes:

- Wisconsin
- Illinois
- Indiana
- Michigan
- Ohio
- Georgia
- Texas
- Florida
- Tennessee
- North Carolina
- Arizona
- Nevada
- Missouri

Daily rotation aims to select:

- 2 large metros
- 3 mid-size cities
- 5 smaller cities / suburbs

The system avoids re-scraping the same city for 30 days unless historical performance is strong enough to justify a faster return.

## Safe Source Rules

- prefer public/open-data sources
- preserve `source_url`
- do not collect private logins or sensitive consumer data
- keep scraping conservative
- log every run to `scrape_runs`

## CSV Lead Imports

The admin lead system also supports outside lead lists through CSV import.

Expected columns:

- `business_name`
- `contact_name`
- `email`
- `phone`
- `website`
- `city`
- `state`
- `niche`
- `source`

Imported leads are:

- validated
- deduplicated
- added to the same admin lead queue
- subject to the same scoring, offer matching, and outreach approval rules
