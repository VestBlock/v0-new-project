# DealMachine v2 strategy automation

## Runtime

VestBlock uses DealMachine's official v2 API at `https://api.v2.dealmachine.com/v1`. The client serializes requests above one second apart, retries rate limits and transient failures, enforces request timeouts, redacts credentials, and rejects prefix-only or legacy keys.

The daily Vercel route is `/api/cron/dealmachine-v2-acquisition`, scheduled at 12:15 UTC. It records a durable `strategy_source_events` report and is idempotent by Central-time date.

## Strategy lanes

The runner rotates each lane to a different configured city every day:

1. `preforeclosure-equity` - preforeclosure plus an active mortgage; review only.
2. `tax-code-stack` - tax-delinquent candidate; county code-enforcement evidence is required before qualification.
3. `tax-remote-equity-rotation` - tax delinquency, remote owner, and equity.
4. `lien-equity` - active lien and equity.
5. `probate-vacant-equity` - pre-probate, vacancy, and equity; review only.
6. `portfolio-landlord` - absentee owner with additional investment property.
7. `small-multifamily-portfolio` - 2-20 unit portfolio ownership.
8. `builder-infill-teardown` - rotating infill-land and vacant-teardown variants.
9. `land-wholesale` - vacant land and development sites.
10. `vacant-equity` - vacant residential property with equity.
11. `seller-finance-free-clear` - free-and-clear properties.
12. `subject-to-low-equity` - active mortgage and low equity; review only.
13. `hybrid-equity-bridge` - active mortgage and mid-range equity.
14. `novation-retail-equity` - stale active listing with retail equity; review only.
15. `absentee-equity-creative` - absentee ownership and equity.
16. `active-stale-creative` - active listing over 45 days, priced from $50,000 to $1,000,000.
17. `active-stale-lowball` - 120+ day distressed listing; review only and capped below 5% of DealMachine acquisition.

Candidate-only records never receive a primary strategy assignment. Review-only records are held for an operator. DealMachine contact discovery never grants SMS consent; phone data remains manual-review-only.

## Commands

```bash
# Account, usage, filters, fields, locations, list, and export-history readiness
pnpm distress:dealmachine:api-capabilities

# Free count/cost plan for all standard lanes
pnpm distress:dealmachine:v2:plan

# Bounded search; add --include-lowball to include the capped review lane
pnpm distress:dealmachine:v2:search -- --include-lowball

# Search and write qualified records to VestBlock
pnpm distress:dealmachine:v2:search:apply -- --include-lowball

# Export small, bounded lanes; conditional-cash export is intentionally refused
pnpm distress:dealmachine:v2:export:apply
```

## Controls and evidence

- `DEALMACHINE_DAILY_CREDIT_BUDGET` defaults to 250 credits.
- `DEALMACHINE_DAILY_ROWS_PER_STRATEGY` defaults to 10 standard rows per lane.
- Paid runs are deduplicated in `data/operating-loops/dealmachine-v2-strategy-state.json`.
- Local run reports are written to `reports/dealmachine-v2/`.
- Downloaded and normalized artifacts are written under `data/dm-exports/v2/<date>/`.
- Production cron reports are stored in `strategy_source_events` with per-lane market, cost estimate, fetched count, status, and blocker.

No run should be called successful based on a saved-list request or fallback CSV alone. Success requires authenticated v2 access, a completed search/export, valid contact ingestion, and recorded evidence.
