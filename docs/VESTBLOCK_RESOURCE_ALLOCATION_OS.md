# VestBlock Resource Allocation OS

Updated: 2026-06-17

## Core Rule

VestBlock should not use every tool for every job. Each resource has a lane:

- DealMachine: seller supply, property-owner filters, saved lists, DNC-aware phone/export handoff.
- Outscraper/DataPipe: business/entity discovery, county-record source discovery, builders, developers, property managers, lenders, contractors, code/public-record overlays.
- Instantly: buyer, lender, developer, acquisition-manager, wholesaler, and operator network growth. It is not the primary motivated-seller source.
- Supabase: memory, CRM, deal twins, routing, buyer/lender profiles, source performance, suppression ledger.
- Mac Pro: always-on operator machine for revenue ops, exports, QA, local reports, and repeatable scripts.
- Air/mobile: command surface only. Send instructions to the Pro instead of rebuilding context locally.

## Daily Operating Loops

### 1. Morning Revenue Control

Run:

```bash
npm run revenue:ops
npm run instantly:doctor
npm run revenue:resource-plan
```

Decision:

- If Instantly is warming only, keep email volume conservative and focus on buyer/developer/lender lead loading.
- If DealMachine lanes are waiting for exports, watch email and ingest exports before building more lists.
- If SMS queue has reviewed mobile candidates, text only after DNC/textability review.

### 2. Demand-First Network Build

Primary resource: Instantly.

Goal: create more buyers before seller opportunities arrive.

Daily targets while warming:

- 25-50 new buyer/developer/lender records loaded or prepared.
- 10-20 safe warm-start emails if sender health allows.
- No seller outreach through Instantly until deliverability is stronger.

High-value buyer lanes:

- Fire-damage rehab buyers and builders.
- Small multifamily cash-flow buyers.
- DSCR lenders and private lenders.
- Local builders buying infill lots or teardown houses.
- Property managers who know active landlords buying rentals.
- Wholesalers/dispo managers with active buyer lists.
- 1031 and out-of-state investor operators.

### 3. Seller Supply Build

Primary resource: DealMachine.

Goal: build owner lists with property distress and owner motivation signals, then export contacts in rotation.

Do not mix strategy lanes. Each CSV/export must preserve:

- strategy key
- market
- list source
- export date
- DNC/textability fields
- owner/property address fields
- outreach copy lane

Seller stack priorities:

1. Tax delinquent + code violation + absentee/out-of-state owner.
2. Vacant + equity + absentee owner.
3. Small multifamily landlord with multiple properties + deferred maintenance/code/tax signal.
4. Fire-damage or insurance-loss property + builder/rehab buyer demand check.
5. Land/infill lots near permit/developer activity.
6. Stale on-market listings with agent outreach, not owner CSV outreach.
7. Preforeclosure + equity where compliant data is available.
8. Lien/equity owners with clear source records.
9. Rental exhaustion: eviction activity, code complaints, and owner portfolio concentration where legally usable.
10. LLC mailing mismatch: local property, remote owner mailing, old acquisition date, equity.

Avoid age, health, race, family status, or other protected-class targeting. Use property, ownership, and public-record signals.

### 4. Public-Record/OSINT Overlay

Primary resource: Outscraper/DataPipe plus public portals.

Use for:

- Finding official county data source URLs.
- Builder/developer company lists around target ZIPs.
- Code-enforcement departments and datasets.
- Permit activity neighborhoods.
- Fire restoration contractors and rehab contractors.
- Property manager/operator discovery.
- Lender/broker/entity discovery.

Do not use Outscraper as the main seller contact source unless DealMachine is blocked. It is best as a signal/source and partner/buyer tool.

### 5. Matchmaking Before Outreach

Before sending seller offers, check buyer demand:

- Is there a buyer lane for this property type?
- Are there 10+ plausible buyers/lenders/developers in market?
- Can VestBlock create a redacted teaser quickly?
- Is the assignment fee thesis visible before negotiating?

If buyer demand is weak, run buyer/developer/lender discovery first.

## Outreach Rules

- Email seller owners only from approved, lane-specific CSVs.
- Text only review-approved mobile candidates with DNC/textability confirmed.
- Listing agents get agent-specific language; do not use seller-owner copy.
- Builders/developers get demand-check language, not seller-offer language.
- Buyer/lender outreach should ask for buy box and current appetite, not pitch every deal.
- Every send must leave a ledger trail so repeats and opt-outs are suppressed.

## Better Strategy Mix

### Strategy A: Buyer-Backed Fire Damage

Use when: fire-damaged seller lead appears.

Steps:

1. Run property analysis and redacted teaser.
2. Use Outscraper/Instantly to find local builders, fire restoration rehabbers, cash buyers.
3. Ask if they buy fire-damaged properties in that exact market.
4. Only negotiate hard once buyer demand is confirmed.

### Strategy B: Infill Land + Developer Activity

Use when: land or teardown lots in growing neighborhoods.

Signals:

- nearby permits
- builder/developer businesses
- land bank activity
- new construction comps
- zoning flexibility

Offer thesis: 30-50% of realistic value only when buyer/developer demand exists.

### Strategy C: Small Multifamily Portfolio Pull

Use when: 2-20 unit owners with multiple buildings.

Signals:

- older ownership
- tax/code stress
- out-of-state mailing
- rent under market
- multiple properties
- property manager contact clues

Outreach angle: portfolio review, as-is sale, one or multiple buildings.

### Strategy D: Code + Tax + Absentee Stack

Use when: city has code/public data and DealMachine owner filters.

Priority: code hit + tax delinquency + absentee/out-of-state + equity.

This should be the main seller engine until we have more direct referrals.

### Strategy E: Demand Network Flywheel

Use daily regardless of seller supply.

Build buyers/lenders/developers first, then seller deals are easier to dispo and assignment fees can grow.

## Operating Metrics

Daily:

- New buyer/developer/lender contacts loaded.
- New seller list lanes created.
- Export lanes waiting.
- CSV lanes ready to send.
- SMS candidates reviewed.
- Replies by lane.
- Suppressions/complaints.
- Buyer demand by asset type/market.

Weekly:

- Reply rate by strategy.
- Conversion from reply to call.
- Buyer appetite by market.
- Best assignment-fee opportunities.
- Tool cost per usable contact.
- Tool cost per reply.

## Immediate Next Moves

1. Stop creating more DealMachine lists until the 13 waiting export lanes are either delivered, retried, or marked failed.
2. Use Instantly for demand network only while warmup is active.
3. Use Outscraper for builders/developers/lenders and code/source overlays.
4. Keep SMS as manual review-only until compliance fields are reliable.
5. Make every daily run produce a resource plan so the Boss Agent has one next move, not ten vague ones.
