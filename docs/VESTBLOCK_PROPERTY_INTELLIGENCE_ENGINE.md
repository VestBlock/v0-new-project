# VestBlock Property Intelligence Engine

## Purpose

VestBlock needs every seller lead and DealMachine lead to become useful deal inventory as soon as it enters the system. The property intelligence layer adds a rough value band, rent hint, equity/LTV estimate, cash review band, seller exit paths, and buyer/lender packet summaries.

This is internal operating intelligence, not a public appraisal or guaranteed offer.

## Where it runs

- Seller intake: `app/api/sell-lead/route.ts`
- Estimate logic: `lib/property/roughEstimate.ts`
- Admin lead view: `components/admin/lead-detail-client.tsx`
- DealMachine harvest exports: `scripts/dealmachine-market-harvest.mjs`
- DealMachine owner outreach packets: `scripts/dealmachine-export-outreach.mjs`

## Seller Intake Output

Each `/sell` submission stores `form_data.roughEstimate` on the unified lead record.

The payload includes:

- `estimateValue`
- `lowEstimate`
- `highEstimate`
- `rentEstimate`
- `equityEstimate`
- `ltvEstimate`
- `acquisitionRangeLow`
- `acquisitionRangeHigh`
- `suggestedExitPaths`
- `buyerPacketSummary`
- `lenderPacketSummary`
- `warnings`
- `disclaimer`

## DealMachine Export Output

The API harvest CSV now includes:

- `estimated_value_value`
- `rough_value_source`
- `rent_estimate`
- `estimated_ltv`
- `cash_review_low`
- `cash_review_high`
- `suggested_exit_paths`
- `buyer_packet_summary`
- `lender_packet_summary`
- `deal_fit_notes`

These fields give VestBlock a cleaner workflow:

1. Pull DealMachine leads by market.
2. Export contactable owners or Atlas-export-needed queues.
3. Send owner outreach with property-specific context.
4. Move replies into seller review.
5. Route reviewed opportunities to buyers and lending partners.

## External Data

If `RENTCAST_API_KEY` is present, seller intake attempts live AVM and rent estimates.

If not present, the engine still works from seller-supplied values and DealMachine fields. Confidence is lower, and the system keeps warnings on the lead so an operator knows to verify comps.

Environment variables:

- `RENTCAST_API_KEY`
- `RENTCAST_API_BASE_URL`
- `RENTCAST_VALUE_PATH`
- `RENTCAST_RENT_PATH`

## Exit Path Logic

The system suggests paths based on urgency, distress, equity, LTV, occupancy, and value spread:

- `fast_cash`: urgent, vacant, distressed, preforeclosure, tax/lien pressure
- `creative_structure`: high LTV, low equity, debt-heavy situation
- `novation`: equity with a cleaner condition or market-assisted opportunity
- `rental_hold`: tenant/rental/out-of-state-owner signals
- `lender_review`: value/rent/equity signal that may interest lending partners
- `manual_review`: always included because final judgment belongs to the operator

## Guardrails

- Do not present rough estimates as appraisals.
- Do not guarantee sale timelines, offers, funding approvals, or transaction outcomes.
- Verify title, comps, condition, occupancy, debt, owner authorization, and local compliance before routing externally.
- Keep seller-facing messages simple and property-specific.
