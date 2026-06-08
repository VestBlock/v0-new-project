# VestBlock Entity SEO Expansion

## Purpose

The entity SEO expansion engine converts live operating signals into new SEO opportunities.

Instead of publishing pages from guesswork alone, VestBlock can now look at:

- lead demand
- lender demand
- buyer demand
- city concentration
- Spanish-language demand
- real-estate distress signals

It also runs a small proactive city/service rotation so VestBlock does not wait forever for lead volume before building useful coverage for core offers.

and turn those into content opportunities.

## What the engine generates

Examples:

- city + niche + service pages
- city funding pages
- Spanish business funding pages
- seller help pages
- code-violation help pages
- lender-category pages
- buyer-category pages
- proactive city pages for AI Receptionist, Search Visibility, DealVault, and Funding Prep

## Auto-publish safe

The engine can auto-publish:

- city + niche + service pages
- city + category + help pages
- Spanish cluster pages
- city funding pages
- city real-estate help pages
- curated proactive city/service pages when they use safe claims and pass the daily limit

## Queue for review

The engine queues instead of auto-publishing:

- named lender pages
- named buyer pages
- named company pages
- third-party comparison pages
- thin-evidence pages

## Proactive city expansion

The proactive path creates a few daily city/service opportunities from curated markets and high-intent service templates.

Defaults:

- `ENTITY_SEO_PROACTIVE_CITY_ENABLED=true`
- `ENTITY_SEO_PROACTIVE_CITY_LIMIT=6` queued candidates per run, capped at 12
- `ENTITY_SEO_AUTO_PUBLISH_LIMIT=3` total auto-published opportunities per run

Guardrails:

- Do not claim local demand unless the page came from lead/lender/buyer signals.
- Proactive pages use a separate body template with safe expectations.
- Do not guarantee rankings, AI citations, leads, funding, legal outcomes, payouts, or customer results.
- Use the existing `entity_seo_opportunities` queue, slug dedupe, `/resources/[slug]`, sitemap, and indexing flow.

## Storage

The system stores:

- `entity_seo_opportunities`
- `entity_seo_runs`
- `entity_seo_performance_snapshots`

## Admin surface

- `/admin/seo-opportunities`

## Cron

- `/api/cron/entity-seo-expansion`
- `/api/cron/entity-seo-expansion?dryRun=true&proactiveCityLimit=6`

## Integration with content

Safe opportunities can create or publish `content_assets` automatically. Those pages then flow through:

- `/resources/[slug]`
- sitemap generation
- normal content-asset reporting

## Performance feedback

Published opportunities can be snapshotted over time so VestBlock can learn which city, niche, and service combinations deserve more expansion.
