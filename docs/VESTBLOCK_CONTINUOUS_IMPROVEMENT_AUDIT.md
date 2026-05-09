# VestBlock Continuous Improvement Audit

Last updated: 2026-05-01

## What VestBlock already automates

VestBlock already has real operating systems for:

- lead scraping, scoring, outreach generation, and market rotation
- content publishing and topic seeding
- credit-report analysis and dispute-letter follow-up
- funding readiness scoring and sequence tracking
- paid-service deliverable generation
- admin tasks, alerts, and event logging

That means the app is no longer missing automation. The main gap before this pass was that the automation mostly ran forward, but did not consistently learn backward from outcomes.

## What was already measured

These signals already existed in the database and could be reused:

- `leads`
  - lead status
  - outreach status
  - delivery status
  - score
  - offer fit
  - city, niche, and language segment
- `outreach_messages`
  - channel
  - variant key
  - generation timestamps
- `outreach_send_events`
  - send success or failure
  - per-channel delivery logging
- `target_markets`
  - city scores
  - performance JSON
  - scrape recency
- `content_assets`
  - draft / ready / published state
  - language
  - service cluster
- `funding_profiles`, `funding_recommendations`, `funding_sequence_items`
  - readiness scores
  - path recommendations
  - sequence stalls / approvals
- `dispute_letters`
  - letter type
  - mailed state
  - follow-up timing
  - response timing
- `service_deliverables`
  - generation state
  - sent state
- `admin_tasks`
  - queue pressure
  - overdue work

## What was not measured well enough

Before this pass, VestBlock did not persist a clean learning layer for:

- daily “what worked / what failed” summaries
- market snapshots by run
- dispute or funding method performance snapshots
- queued strategy changes
- approved vs auto-applied improvements
- research summaries tied to operational weak spots
- experiment winners for outreach or scoring
- prompt / message versioning
- service deliverable view and response signals
- content refresh recommendations

## What should become feedback signals

The strongest daily signals are:

- reply rate by city and niche
- bounce rate by segment
- best-performing offer by lead type
- outreach angle performance
- stalled funding sequences
- mailed vs unmailed dispute letters
- overdue admin work by task lane
- published content vs refresh-needed content
- service deliverables sent vs viewed vs responded

The strongest weekly signals are:

- strongest cities and niches over rolling windows
- score adjustments that materially improve qualification
- outreach variants that outperform baselines
- Spanish content clusters that deserve expansion
- workflow bottlenecks in funding or credit flows

## What needs approval instead of blind automation

These areas should stay approval-based:

- customer-facing legal or compliance wording
- dispute timing changes
- funding recommendation-path changes
- content-cluster expansion that materially changes public claims
- aggressive score-threshold shifts
- new outreach angles for sensitive segments

## What can improve daily automatically

Low-risk areas that can safely auto-improve:

- market re-queue priority
- active score adjustments for clear winning offer segments
- outreach opener/body guidance for proven segments
- research brief creation
- operator daily reports
- market and method snapshot recording

## Recommended cadence

Daily:

- summarize yesterday’s outcomes
- queue strategy updates
- auto-apply low-risk adjustments
- generate research briefs
- update outreach variants
- send operator digest

Weekly:

- review winning and losing segments
- prune weak variants
- review queued medium-risk changes
- plan next content expansion and workflow adjustments
