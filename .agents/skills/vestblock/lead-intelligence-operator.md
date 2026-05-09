# VestBlock Lead Intelligence Operator

Use this skill when expanding or operating VestBlock's lead engine.

## Goal

Find, score, route, and follow up with leads for:

- business funding
- business credit
- AI receptionist
- website upgrades
- real estate sellers
- code violation properties
- Spanish-speaking businesses
- government contract readiness
- new business formation

## Source Priority

1. Public filings and open data first.
2. Official APIs second.
3. Public search surfaces third.
4. Never scrape private, login-only, or prohibited data.

## Current Lead Sources

- `wisconsin_dfi_new_businesses`
- `cincinnati_code_enforcement`
- `milwaukee_accela_enforcement`
- `google_places_businesses`
- `outscraper_google_maps_businesses`
- `sam_contract_opportunities`

## Maps Provider Rules

- Prefer `outscraper` when `OUTSCRAPER_API_KEY` is available.
- Fall back to `google` when `GOOGLE_PLACES_API_KEY` is available.
- Use `provider: auto` in `/api/leads/scrape/google-places` to let the app choose.
- Outscraper is useful when richer listing fields, extended place data, or broader batch results are needed.

## Safe Scraping Rules

- Respect robots and published usage terms where applicable.
- Prefer APIs and open-data portals over brittle HTML scraping.
- Preserve `source_url` for every imported lead.
- Keep request volume conservative and log every scrape run.
- Do not collect bank logins, SSNs, card numbers, or non-public personal data.

## Lead Quality Signals

Score leads on:

- urgency
- business age
- funding likelihood
- website weakness
- Spanish-language fit
- real-estate distress
- SAM / contract fit
- contactability
- expected VestBlock value

## Offer Matching

Map high-fit leads to one primary offer:

- Business Funding
- Business Credit Builder
- AI Receptionist
- Website Upgrade
- Gov Contract Readiness
- Real Estate Seller Lead
- Spanish Funding Assistance
- Grant/Funding Roadmap
- New Business Formation

## Operator Checklist

When making lead-engine changes:

1. Update schema or migrations if source metadata changes.
2. Keep `lib/leads/types.ts` and `lib/leads/schemas.ts` in sync.
3. Test no-key public sources first:
   - new businesses
   - code violations
4. Test provider-backed routes with env keys:
   - maps
   - SAM
5. Confirm:
   - scrape run saved
   - leads upserted
   - score written
   - outreach can generate
   - admin pages still load

## Admin Surfaces

- `/admin/leads`
- `/admin/leads/[id]`
- `/admin/lead-sources`
- `/admin/scrape-runs`

## QA Notes

- `npx tsc --noEmit`
- `corepack pnpm lint`
- `corepack pnpm build`
- start the app with real envs and test the routes that do not require hidden provider keys
- if maps or SAM keys are missing, the UI should make that obvious instead of silently failing
