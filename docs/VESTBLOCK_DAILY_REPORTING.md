# VestBlock Daily Reporting

## Purpose

The daily reporting engine gives VestBlock one morning operating report across:

- leads
- lenders
- buyers
- users
- SEO / content

## What the report includes

### Leads

- new leads today
- scored leads
- email-ready leads
- outreach-ready leads
- reply / send / approval summary
- top cities
- top niches
- top offers

### Lenders

- new lenders discovered
- lenders scored
- outreach drafted
- outreach approved
- responded lenders
- active partners
- strongest lender categories
- strongest lender markets

### Buyers

- new buyers discovered
- buyers scored
- outreach drafted
- active buyers
- property matches created
- top buyer categories
- top buyer markets

### Users

- new users
- uploads
- completed analyses
- paid users
- service requests
- stalled or no-upload users

### SEO / content

- pages published today
- pages queued
- best-performing clusters
- Spanish pages added
- new entity-driven opportunities
- next recommended clusters

## Daily report storage

The system stores:

- `daily_growth_reports`
- `daily_growth_report_sections`

## Admin surfaces

- `/admin/reports/daily`
- `/admin/reports/daily/[date]`

## Daily email digest

When `ADMIN_ALERT_EMAIL` is configured, the report can be emailed every morning with:

- best city
- best niche
- best SEO opportunity
- recommended actions

## Cron

- `/api/cron/daily-ops-report`

## Notes

This report is meant to help operators prioritize, not replace deeper dashboards for leads, lenders, buyers, or content editing.
