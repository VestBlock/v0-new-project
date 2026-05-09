# Market Expansion Operator

Use this skill when VestBlock needs to grow beyond a single city or static market list.

## Goal

Keep the lead engine rotating into stronger cities and niches instead of repeatedly scraping the same places.

## Core tables

- `target_markets`
- `leads`
- `outreach_send_events`
- `lead_suppressions`

## Daily sequence

1. discover markets
2. activate:
   - 2 large metros
   - 3 mid-size cities
   - 5 smaller cities/suburbs
3. rotate niches per city
4. scrape active cities
5. score and route leads
6. review/send approved outreach
7. update market performance

## Guardrails

- avoid re-scraping cities within 30 days unless results are strong
- keep suppression checks active
- keep duplicate detection on:
  - email
  - phone
  - website
  - business name + city
- default to human approval mode

## Best signals

- strong reply/booked-call performance
- weak website density
- Spanish-business opportunity
- contractor/home-service density
- new LLC formation
- real-estate activity
