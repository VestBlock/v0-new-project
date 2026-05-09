# VestBlock Daily Intelligence Audit

Last updated: 2026-05-02

## What VestBlock already measures

VestBlock already has meaningful operating data spread across several systems:

- `leads`, `lead_scores`, `outreach_messages`, `outreach_send_events`
- `lenders`, `lender_outreach_messages`, `lender_matches`, `lender_performance`
- `buyers`, `buyer_outreach_messages`, `buyer_matches`, `buyer_performance`
- `user_profiles`, `credit_reports`, `analysis_jobs`, `payments`
- `content_assets`
- `target_markets`
- `improvement_runs`, `strategy_updates`, `daily_operator_reports`

## What existed before this upgrade

Before the daily intelligence engine, VestBlock had:

- separate admin dashboards for leads, lenders, buyers, and content
- a continuous-improvement report
- a daily content publisher
- market expansion and outreach automations
- email digests for some automation surfaces

But it did **not** yet have one clean report that tied all of these together every morning.

## Missing pieces this upgrade closes

The previous gap was not data collection. It was operator synthesis.

Missing before:

- one daily report covering leads, lenders, buyers, users, and SEO together
- a morning summary of what matters most today
- direct conversion of lead/lender/buyer demand into SEO opportunities
- an admin review surface for entity-driven SEO ideas
- a safe publishing model for generic city/service/category pages vs risky named-entity pages

## What is already publishable

VestBlock already has a working content system through `content_assets` and `/resources/[slug]`.

That means the following are already publishable once generated safely:

- city + service pages
- city + niche + service pages
- Spanish cluster pages
- real-estate help pages
- lender-category pages
- buyer-category pages

## What should become entity-driven SEO inputs

The best live inputs are:

- lead cities
- lead niches
- lead best offers
- Spanish-language lead signals
- seller / code-violation signals
- lender categories by city/state
- buyer categories by city/state
- recurring market winners from expansion

## What still requires review

These should **not** auto-publish:

- named lender pages
- named buyer pages
- named company pages
- comparison pages about third parties
- pages built from thin or weak evidence

Those can be generated as opportunities and held in review mode.

## Daily vs weekly improvement split

### Daily

- lead/lender/buyer/user/content summary
- best cities and niches
- new SEO opportunities
- safe auto-publishing
- operator action list

### Weekly

- broader trend reviews
- refresh candidates
- cluster expansion planning
- named-entity review backlog
- partner-network quality analysis
