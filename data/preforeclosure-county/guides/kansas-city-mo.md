# kansas-city-mo

- County: Jackson County
- State: MO
- Priority: 1

## Source order

1. Jackson County Delinquent Land Tax Sale - https://www.jacksongov.org/Government/Departments/Collection/Delinquent-Land-Tax-Sale
   - County tax-sale trigger and auction timing.
2. 16th Circuit Delinquent Land Tax Sale Overview - https://www.16thcircuit.org/delinquent-land-tax-sale-overview
   - Circuit-court tax-sale overview and sale process.
3. Jackson County Sheriff Sales - https://www.jacksoncountyso.com/sheriff-sales
   - Foreclosure sale schedule, case numbers, addresses, and postponements.

## Intake rule

- Pull current filings, auction notices, postponements, and tax-sale context from these county/public sources first.
- Save cleaned rows into the raw CSV template in `data/preforeclosure-county/raw`.
- Then run `npm run distress:preforeclosure:county-osint -- --file=<raw csv> --apply-checklists --run-public-osint`.
- Use DealMachine only as a fallback contact path after county-trigger validation and public OSINT review.

## OSINT follow-through

- Verify mailing vs property address.
- Check owner entity/trust/LLC naming.
- Score owner-occupant sensitivity, bankruptcy, probate, vacancy, tax, and code stack.
- Route into subject-to, cash, novation, or referral before outreach.
