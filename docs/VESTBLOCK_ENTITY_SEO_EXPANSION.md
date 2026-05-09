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

## Auto-publish safe

The engine can auto-publish:

- city + niche + service pages
- city + category + help pages
- Spanish cluster pages
- city funding pages
- city real-estate help pages

## Queue for review

The engine queues instead of auto-publishing:

- named lender pages
- named buyer pages
- named company pages
- third-party comparison pages
- thin-evidence pages

## Storage

The system stores:

- `entity_seo_opportunities`
- `entity_seo_runs`
- `entity_seo_performance_snapshots`

## Admin surface

- `/admin/seo-opportunities`

## Cron

- `/api/cron/entity-seo-expansion`

## Integration with content

Safe opportunities can create or publish `content_assets` automatically. Those pages then flow through:

- `/resources/[slug]`
- sitemap generation
- normal content-asset reporting

## Performance feedback

Published opportunities can be snapshotted over time so VestBlock can learn which city, niche, and service combinations deserve more expansion.
