# Outreach V3 Reset Plan

Last updated: 2026-05-13

## Current Truth

VestBlock did not reach 100 quality emails/day with the current outreach strategy.

- Current 24-hour send count: 23.
- Current safe send queue: 0.
- Database reply/booked signals: 0.
- Gmail connector status: reconnect needed; connector token is expired.
- Local Gmail OAuth can send, but the current token cannot read inbox because it lacks Gmail read scopes.
- Main bottleneck: fresh qualified, email-ready lead supply.
- Tool audit command: `npm run outreach:v3-tools`.

The sending system is not the primary blocker anymore. The blocker is source quality and enrichment.

## Why The Current Strategy Fails

- Too many leads come from sources that are low-email or not direct buyers.
- Public-record and directory sources create volume, but not enough decision-maker emails.
- OutScraper can find businesses, but larger searches are too slow for a 60-second Vercel cron.
- V2 guardrails correctly reject weak, mismatched, no-email, already-sent, and bad-fit leads.
- Lowering guardrails would create more emails but weaker prospects, higher bounce risk, and lower trust.

## V3 Strategy

V3 should be source-first, not send-first.

1. Find better buyers.
2. Enrich decision-maker or public business emails.
3. Verify deliverability.
4. Generate short offer-specific copy.
5. Send only clean, compliant batches.
6. Track replies and follow-ups.

## Required Tool Stack

### Must Have

- Gmail read access or Gmail connector re-authentication for reply tracking.
- One email-rich B2B lead source, such as Apollo-style company/contact search.
- One enrichment provider, such as Hunter-style domain email discovery.
- One verification provider, such as ZeroBounce/NeverBounce-style validation.
- One offline/local scraping path that is not limited by Vercel function timeouts.

### Current Local Tool Reality

- Hunter is configured locally and already integrated into website/domain email enrichment.
- Apify is configured locally and can support local service-business list building.
- OutScraper is configured locally and can support map/business discovery, but large runs should not depend on Vercel time limits.
- Gmail can send locally, but reply tracking is blocked until read scope or connector auth is repaired.
- Email verification is the missing scale-safety layer before sustained 100/day sending.

### Useful Next

- Apify/Yelp for local service businesses.
- Serper/Google Custom Search for website discovery and niche lists.
- CSV import path for manually sourced or purchased compliant business lists.
- Sheet export for no-email/contact-form-only leads.

## Target Daily Mix

- 30 AI Receptionist / Website Conversion leads.
- 25 Search Visibility leads.
- 25 DealVault / agreement-record leads.
- 20 Funding Prep / contractor-government-readiness leads.

This requires roughly 150-250 raw prospects/day before filtering, because only a portion will be email-ready and safe.

## Buyer Profiles To Prioritize

- Home service businesses with missed-call or booking pain.
- Med spas, dental clinics, clinics, salons, and appointment-heavy providers.
- Property managers, restoration companies, contractors, and subcontractor-heavy businesses.
- Private lenders, hard money lenders, funding brokers, and referral-heavy deal businesses.
- Local companies with outdated websites and clear service demand.

## What To Stop Doing

- Do not chase no-email public-record leads for email automation.
- Do not rely on Vercel cron for large scraping jobs.
- Do not weaken V2 safety rules just to hit a send number.
- Do not treat contact-form-only leads as email-send-ready.
- Do not keep using “100/day” as the goal unless the source stack can produce safe supply.

## Immediate Implementation Path

1. Re-authenticate Gmail connector or create a read-only Gmail token for reply monitoring.
2. Run `npm run outreach:v3-tools` to confirm which source/enrichment/verification tools are currently usable.
3. Use Apify/OutScraper locally to create 150-250 raw prospects/day across the target daily mix.
4. Run Hunter enrichment only on businesses with real websites/domains.
5. Add ZeroBounce/NeverBounce-style verification before scaling beyond small controlled batches.
6. Generate V2/V3 drafts only after enrichment and verification.
7. Send in controlled batches only after the scorecard shows enough safe supply.

## Daily Gate

Do not run a 100-email send day unless all of these are true:

- `npm run outreach:scorecard` shows the 24-hour gap and a real safe queue.
- `npm run outreach:preflight -- --limit=100` shows safe sends available.
- `npm run outreach:v3-tools` shows source discovery, enrichment, compliant address, sending, reply monitoring, and verification are ready.
- No-email/contact-form-only leads have been exported for manual/offline review instead of email automation.
- A human can review the first sample of each offer angle before the batch goes out.

## Success Criteria

- 100 safe sends/day without relaxing guardrails.
- Bounce/failed rate remains low.
- Reply tracking is visible daily.
- At least one positive reply or booked task is captured and routed.
- Source report shows which source produced sent emails and replies.
