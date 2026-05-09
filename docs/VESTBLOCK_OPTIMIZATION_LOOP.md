# VestBlock Optimization Loop

Last updated: 2026-05-01

## Daily loop

VestBlock now has a daily continuous-improvement sequence that runs after the morning growth automation.

### Scheduled jobs

- `/api/cron/improvement-review`
- `/api/cron/research-digest`
- `/api/cron/optimize-outreach`
- `/api/cron/optimize-markets`
- `/api/cron/optimize-content`
- `/api/cron/optimize-credit-funding`

## What each job does

### Improvement review

Analyzes the latest operating window and stores:

- improvement run record
- daily summary
- top wins
- biggest losses
- recommended actions
- market snapshots
- method snapshots
- queued strategy updates
- daily operator report

### Research digest

Creates curated research briefs tied to:

- current weak spots
- strongest wins
- next likely expansion opportunities

### Optimize outreach

Reviews send and reply patterns, then promotes:

- better outreach variants
- experiment records
- active guidance for winning offer segments

### Optimize markets

Suggests stronger city rotation based on recent performance.

### Optimize content

Queues content-cluster recommendations for:

- SEO expansion
- Spanish expansion
- refresh candidates

### Optimize credit and funding

Flags workflow bottlenecks in:

- dispute completion
- funding-sequence stalls
- readiness follow-up

## Auto-applied vs review-required

### Auto-applied

- low-risk market re-queue changes
- low-risk score adjustments
- low-risk outreach variants

### Requires approval

- content expansion strategy
- medium/high-risk workflow changes
- customer-facing method changes
- credit/funding logic changes that alter timing or recommendations

## Admin surfaces

- `/admin/improvement`
- `/admin/research`
- `/admin/experiments`

## Daily report

The daily operator report stores:

- best city
- best niche
- best offer
- best outreach angle
- top SEO opportunity
- top Spanish opportunity
- top credit/funding opportunity
- top wins
- biggest losses
- recommended operator actions

It is stored in `daily_operator_reports` and can also be emailed to `ADMIN_ALERT_EMAIL`.
