# VestBlock Real Estate Lead Engine

Priority order for seller inventory:

1. Failed listings
- Expired, withdrawn, cancelled, or failed retail listings.
- Usually the cleanest "owner already raised a hand" inventory.
- Best for: novation, creative finance, direct-seller follow-up.

2. Stale listings
- Active listings with 90+ days on market, especially with price cuts.
- Best for: novation, creative finance, selective cash.

3. Distress inventory
- Vacant, code-violation, heavy-repair, condemned, tax-pressure, or obvious pain cases.
- Best for: fast cash and heavier-distress buyers.

4. Absentee and tired-landlord inventory
- Non-owner-occupied rentals, out-of-state owners, long-term ownership, tenant fatigue.
- Best for: creative finance, subject-to, seller finance, portfolio buyers.

5. Probate / inherited / transition inventory
- Estate-transition properties where speed, cleanup, and simplicity matter.
- Best for: cash, novation, selective creative.

6. Financeable light-rehab inventory
- Cleaner properties, lower distress, better lender viability.
- Best for: DSCR, bridge, rehab, BRRRR, and lender-routing opportunities.

Supported CSV intake profiles:

- `stale_listing`
  Common fields: `property_address`, `city`, `state`, `zip`, `days_on_market`, `list_price`, `estimated_value`, `price_reduced`, `occupancy_status`, `listing_status`, `listing_url`

- `failed_listing`
  Common fields: `listing_status`, `days_on_market`, `price_reduced`, `listing_url`, `notes`

- `absentee_owner` / `tired_landlord`
  Common fields: `owner_name`, `owner_occupied`, `owner_state`, `years_owned`, `occupancy_status`, `equity_estimate`, `notes`

- `tax_delinquent`
  Common fields: `tax_delinquent_amount`, `lien_amount`, `owner_name`, `mailing_address`, `property_address`, `notes`

- `probate_inherited`
  Common fields: `probate_flag`, `deceased_owner`, `owner_name`, `mailing_address`, `property_address`, `notes`

- `vacant_distress`
  Common fields: `vacant_flag`, `occupancy_status`, `notes`, `estimated_value`, `list_price`

- `preforeclosure`
  Common fields: `preforeclosure_flag`, `lien_amount`, `owner_name`, `mailing_address`, `property_address`, `notes`

Strategy routing:

- `failed_listing`
  Use when listing status shows expired, withdrawn, cancelled, or failed.
  Outreach angle: compare a different sale path after the listing stalled.

- `creative_finance`
  Use when DOM is very high, seller flexibility appears likely, or terms language is present.
  Outreach angle: seller-finance, subject-to, or flexible exit conversation.

- `novation`
  Use when the property seems cleaner and the seller may want more than a low cash outcome.
  Outreach angle: compare novation versus direct investor sale.

- `fast_cash`
  Use when distress, condition, vacancy, or pain is obvious.
  Outreach angle: simple as-is cash conversation.

- `stale_listing_followup`
  Use when the listing is old but not clearly failed, creative, or distress-heavy yet.
  Outreach angle: practical direct-sale or investor-review follow-up.

Operational rule:
- Seller inventory comes to VestBlock first.
- Keep outreach basic and seller-facing.
- Until the internal buyer network is mature enough, distribute manually through the personal buyer network after VestBlock review.

Source routing rule:
- Zillow is only one input format.
- VestBlock should prioritize failed listings, absentee owners, tired landlords, tax pressure, probate, vacancy/distress, and preforeclosure data just as heavily as stale marketplace listings.
