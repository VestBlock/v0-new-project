# Outreach City Rotation Optimization

Last updated: 2026-05-14

## Desired Behavior

VestBlock outreach should rotate through cities and lead sources persistently instead of repeatedly scraping the same markets or overusing one source. The system should favor safe, signal-based outreach quality over raw send volume.

## Persistent City and Source Rotation

- Maintain rotation state by city, niche, source, and last-scraped date.
- Activate a daily mix of large metros, mid-size cities, and smaller cities or suburbs.
- Avoid re-scraping a city within 30 days unless its replies, booked calls, or safe-send yield justify an earlier return.
- Rotate niches inside each active city so one category does not dominate the queue.
- Track source performance separately so stronger sources are reused and weak sources are gradually deprioritized.

## Diversity Caps

- Cap daily sends by city, source, niche, offer, and language variant.
- Prevent one source, city, or template from filling the whole safe-send queue.
- Keep Spanish-language outreach measured separately from English outreach.
- Preserve offer diversity across DealVault, AI Receptionist, Search Visibility, and Funding Prep when enough qualified leads exist.
- Keep no-email or contact-form-only leads out of email automation and route them to manual queues.

## Daily Reporting

The daily report should make city/source rotation visible to operators.

- Active cities and niches for the day.
- Newly scraped leads by city, source, and niche.
- Email-ready, outreach-ready, approved, sent, replied, bounced, and suppressed counts.
- Best and weakest city/source/niche combinations.
- Rotation decisions made today, including cities re-queued, paused, or deprioritized.
- Guardrail blockers, such as low safe-send supply, high bounce risk, expired reply monitoring, or missing verification.

## Safe-Send Guardrails

- Default to human approval mode for cold outreach.
- Do not auto-send unapproved, ungrounded, or fabricated personalization.
- Honor suppressions and do-not-contact rules before draft generation and again before send.
- Deduplicate by email, phone, website, and business name plus city.
- Do not send to platform-hosted, placeholder, mismatched-domain, or low-quality generic addresses.
- Do not weaken fit, deliverability, or copy-quality rules to hit a daily send target.
- Increase send volume only when bounce risk is low, reply tracking works, and the safe-send queue has enough source diversity.

## Acceptance Checks

- A daily run cannot overfill sends from a single city, source, niche, offer, or language variant.
- The same city is not re-scraped inside 30 days unless performance data explicitly re-queues it.
- Daily reporting shows rotation state, source yield, replies, bounces, suppressions, and next recommended markets.
- Safe-send preflight blocks suppressed, duplicate, no-email, unverified, platform-hosted, or weak-fit leads.
- Reply and bounce outcomes feed back into city/source/niche prioritization without deleting baseline templates or historical variants.

## Implemented 2026-05-14

- Source refill now defaults to two markets per run instead of one.
- Active market selection no longer forces the Milwaukee / Chicago / Cincinnati fallback list to the front before rotation.
- Recently scraped markets are deprioritized unless their performance data justifies another pass.
- Maps and Apify/Yelp refill use separate offsets so they do not hit the same city in the same run by default.
- Apify/Yelp refill now records market run results, so successful Yelp-style source runs update `last_scraped_at`.
- Apify/Yelp niches now rotate instead of always slicing the first terms.
- Send queue ordering now round-robins email-ready candidates by city after service balancing, reducing same-city visible batches when alternatives exist.
- Send queue reports now include email-ready and sent city/source mix.
- Outreach scorecard now reports `cityMix`, `sendReadyCityMix`, `sendReadySourceMix`, `needsReviewCityMix`, and concentration warnings.
- V2 audit CSVs now include `city` and `state`, and V2 audit JSON now includes city/source-city concentration summaries.
