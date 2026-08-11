# little-rock-ar

- County: Pulaski County
- State: AR
- Priority: 1

## Source order

1. Pulaski County Circuit Clerk Auctions and Foreclosures - https://pulaskiclerkar.gov/auction-about/
   - Judicial foreclosure sales handled by the clerk.
2. Pulaski County Upcoming Auction Notices - https://pulaskiclerkar.gov/auction-about/auction-notices/
   - Upcoming notice feed with filed notices and sale dates.
3. Pulaski County Collector - https://www.pulaskicollector.com/
   - Current and delinquent real-estate tax context.
4. Pulaski County Real Estate Records - https://www.arcountydata.com/county.asp?county=Pulaski
   - Assessor-backed parcel and ownership verification.

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
