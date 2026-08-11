# tulsa-ok

- County: Tulsa County
- State: OK
- Priority: 1

## Source order

1. Tulsa County June Real Estate Auction - https://www2.tulsacounty.org/treasurer/properties-for-sale/june-real-estate-auction/
   - Annual county real-estate tax auction.
2. Tulsa County Properties for Sale - https://www2.tulsacounty.org/treasurer/properties-for-sale/county-properties/
   - County-held inventory and sale pipeline.
3. Tulsa County Sheriff Property Auctions - https://tcso.org/resources/property-auctions/
   - Sheriff foreclosure/property auction schedule.
4. Tulsa County Assessor - https://assessor.tulsacounty.org/
   - Parcel verification, value context, and owner/address cross-checks.

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
