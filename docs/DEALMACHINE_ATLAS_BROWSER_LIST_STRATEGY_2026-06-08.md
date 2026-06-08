# DealMachine Atlas Browser List Strategy - 2026-06-08

## Diagnosis

The DealMachine API is not a reliable top-of-funnel prospecting source for new markets. It behaves like an account inventory lookup: if the account does not already have enough leads in a city, the API returns little or nothing even when the market should have distress. The website must become the lead builder/export source; local scripts should only clean, rescore, dedupe, and send outreach after a contact export is downloaded.

## Four Major Markets

Work these first:

1. Columbus, OH
2. Cleveland, OH
3. Indianapolis, IN
4. Memphis, TN

Columbus is first because open city compliance data already produced a strong source-led seed file. Cleveland, Indianapolis, and Memphis are major investor markets where DealMachine website filters should surface more inventory than the API exposed.

## Website Filter Stacks

Build one list per city per lane. Keep the lanes separate so outreach can be measured by motivation type.

### Lane A - Saveable Distress

Goal: owners likely still have options, not already gone.

- Location: target city boundary or urban-core ZIP set.
- Property type: Single family, duplex, triplex, fourplex.
- Status: Off market.
- Exclude: Sold, bank owned, REO, auction completed, failed listing.
- Distress filters: Preforeclosure OR notice of default OR tax delinquent.
- Equity: 25%+ equity or $40,000+ estimated equity.
- Owner: Individual owner preferred; include absentee only if contactable.
- Last sale: older than 2 years.

Export name:

`dm_<city>_<state>_saveable_distress_contacts_2026-06-08.csv`

### Lane B - Vacant Equity

Goal: nuisance/maintenance problem with enough equity to negotiate.

- Location: target city boundary or urban-core ZIP set.
- Property type: Single family, duplex, triplex, fourplex.
- Status: Off market.
- Distress filters: Vacant.
- Equity: 35%+ equity or $50,000+ estimated equity.
- Owner: Absentee, out-of-state, or corporate/LLC owner.
- Exclude: bank owned, REO, sold, auction completed.
- Optional: high ownership tenure, code violation, tired landlord, or mail return if available.

Export name:

`dm_<city>_<state>_vacant_equity_contacts_2026-06-08.csv`

### Lane C - Tired Landlord

Goal: rental owner with operational pressure.

- Location: target city boundary or urban-core ZIP set.
- Property type: Single family, duplex, triplex, fourplex.
- Owner: Absentee, out-of-state, or owns multiple properties.
- Ownership tenure: 7+ years.
- Equity: 30%+ equity.
- Distress overlays: code violation, tax delinquent, vacant, liens, eviction-adjacent if available.
- Exclude: recently sold, listed for sale, bank owned, large institutional owners.

Export name:

`dm_<city>_<state>_tired_landlord_contacts_2026-06-08.csv`

### Lane D - Failed Listing With Equity

Goal: seller showed intent but did not solve the problem.

- Location: target city boundary or urban-core ZIP set.
- MLS/listing: failed, expired, cancelled, or withdrawn within the last 24 months.
- Status: Off market now.
- Equity: 20%+ equity.
- Exclude: currently listed, sold, bank owned, REO.
- Overlay: vacant, absentee, tax delinquent, or code violation when possible.

Export name:

`dm_<city>_<state>_failed_listing_equity_contacts_2026-06-08.csv`

## Outreach Rules

Use the same message family for every lane: no novation language, no foreclosure scare language, no overpromising.

Core message:

`Hi {firstName}, this is Rick with VestBlock. I was checking on {address}. If you are open to it, we can look at the property and walk through several options. Would you be open to a quick conversation today?`

Lane-specific subject lines:

- Saveable Distress: `Quick question about {address}`
- Vacant Equity: `Checking on {address}`
- Tired Landlord: `Question about your property`
- Failed Listing: `Still considering options for {address}?`

## Export Processing

After each Contacts Export downloads:

1. Save the file in `/Users/mrsanders/Downloads`.
2. Combine it into the local export pool.
3. Run the local scoring pass so contactability is delivery only, not motivation.
4. Outreach order:
   - Saveable Distress
   - Vacant Equity
   - Tired Landlord
   - Failed Listing With Equity
5. Send emails first, then texts only for rows with strong motivation and a valid phone.

## Failure Signals To Watch

- A lane with many records but few contact exports means DealMachine has addresses but poor contact enrichment.
- A lane with many bank-owned/sold records means the excludes are not tight enough.
- A lane with many deceased/heir records should be separated into a probate/heirs campaign, not mixed into immediate seller outreach.
- A lane with weak replies after 100+ contacts should be rewritten before scaling.

## Immediate Execution

Start in Atlas browser with Columbus, OH:

1. Build Saveable Distress and Vacant Equity lists.
2. Export contacts.
3. Run local outreach against the downloaded CSVs.
4. Repeat for Cleveland, Indianapolis, and Memphis.
