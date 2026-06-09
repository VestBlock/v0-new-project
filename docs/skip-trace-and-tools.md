# DealMachine Contact Workflow

This repo no longer treats the DealMachine public API as the main skip-trace or list-building path.

## The working model

- Build lists in the **DealMachine website/app**
- Review people data in **Associated Contacts**
- Export **Contacts**
- Ingest the CSV locally
- Draft and send outreach from the export

## What still matters locally

- `npm run distress:dealmachine:ingest-export`
- `npm run distress:dealmachine:ingest-export:apply`
- `npm run distress:dealmachine:export-outreach -- --market=<city-state> --export-csv=<path>`

## What is no longer the primary path

- API-first list creation
- API-first contact discovery
- synthetic list-builder replay through Atlas

## Official-product constraint

DealMachine’s own product docs make the boundary clear:
- list building is done in `Map` / `List Builder`
- contacts are exported from `Leads`
- saved filters do not preserve geography
- Smart Lists update automatically unless converted to Static Lists

See:
- [docs/DEALMACHINE_API_STRATEGY_2026-06-08.md](/Users/mrsanders/Downloads/Codex%20Folder/docs/DEALMACHINE_API_STRATEGY_2026-06-08.md)

## Practical operating advice

1. Build seller lists with `Match All` when combining distress motivators.
2. Convert the list to **Static** before exporting if the team needs a frozen outreach snapshot.
3. Export `Contacts`, not `Properties`, for phone/email campaigns.
4. Scrub DNC and landlines before text/call work.
5. Keep the export file itself as the source of truth. Do not wait on API enrichment to start outreach.
