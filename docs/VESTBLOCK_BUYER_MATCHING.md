# VestBlock Buyer Matching

## Purpose

Property-to-buyer matching helps VestBlock route seller and distressed-property opportunities to real buyers instead of treating every investor as interchangeable.

## Inputs used

The matching engine can use:

- property address
- city
- state
- ZIP
- asset type
- occupancy
- distress level
- code-violation level
- rehab level
- asking price
- estimated value or ARV
- landlord or tenant signal
- seller motivation
- timeline urgency
- creative-finance openness
- language preference
- market tag

## Matching logic

The engine ranks buyers using:

- market coverage
- asset-type fit
- price-band fit
- distress tolerance
- code-violation tolerance
- occupancy preference
- tenant or landlord tolerance
- creative-finance openness
- closing-speed fit
- buyer confidence score
- referral value
- language support

Each stored match includes:

- confidence score
- fit summary
- fit explanation
- next info needed
- fallback buyer categories

## Current integration points

- `/api/buyers/match`
- `/api/sell-lead`
- `/api/real-estate-lead`

## How to use it

### For admin

1. Open `/admin/buyer-matches`.
2. Review top buyer matches for a property lead.
3. Open the buyer detail page to inspect outreach, buy-box criteria, and relationship status.

### For intake-driven real-estate leads

1. Submit a seller or real-estate funding intake.
2. Let the system persist buyer matches automatically.
3. Review and route the strongest buyer options inside admin.

## Guardrails

- Matches are not guaranteed offers.
- Weak-fit matches are filtered out below a minimum confidence threshold.
- Stored matches are upserted per buyer/property combination to reduce noisy duplication.
- Fallback categories are still stored so operators can route honestly when the ideal buyer is not yet in the network.
