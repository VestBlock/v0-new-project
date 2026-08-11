# VestBlock Preforeclosure + Subject-To Strategy

## Objective

Build a preforeclosure acquisition lane that:

- finds fresh preforeclosure leads from county sources and DealMachine
- scores whether a lead is a real `subject_to` fit versus cash, novation, short sale, seller finance, or referral
- uses OSINT and public-record research before outreach
- does not rely only on DealMachine Contacts exports
- keeps outreach compliant for owner-occupant distress situations

This is an internal operating playbook, not a public marketing script.

---

## Hard rules

1. No foreclosure-stop promises.
2. No fake urgency.
3. No bank/government impersonation.
4. No cold SMS to skip-traced numbers without recorded consent.
5. No owner-occupant `subject_to` paperwork or promise path without attorney-reviewed language.
6. Do not tell people to ignore their lender, attorney, or HUD counselor.
7. Do not pitch `subject_to` as the only answer. Route the lead to the best exit.

The repo already encodes these rules:

- `scripts/lib/compliance-check.mjs`
- `lib/admin/commandCenter.ts`
- `docs/skip-trace-and-tools.md`

---

## Why we should not depend only on DealMachine exports

DealMachine is good for:

- list building
- associated contacts
- contact exports
- fast outreach queues

It is not enough by itself for preforeclosure.

Preforeclosure is a source-and-timing problem first, not a contact-export problem first.

We need county and OSINT signals because they tell us:

- when foreclosure was actually filed
- sale date / auction date
- whether sale was postponed
- whether the owner is likely owner-occupied or absentee
- whether there are stacked distress signals
- whether the lead fits `subject_to`, short sale, novation, cash, or referral

DealMachine should be one source inside the lane, not the whole lane.

---

## Target lead profile for `subject_to`

Good `subject_to` candidates usually have most of these:

- foreclosure filed or payment stress is real
- loan balance is attractive relative to value/rent
- arrears are manageable
- equity is thin to moderate, so a pure cash offer is weak
- property is habitable or rentable with limited rehab
- seller mainly needs speed, payment relief, or debt relief
- seller understands the loan stays in their name until refinance/payoff
- local rental demand is adequate

Bad `subject_to` candidates:

- owner expects a retail-price payout now
- arrears are too large for the spread
- title is messy and unresolved
- bankruptcy/probate is active and not cleared
- owner-occupant with high legal sensitivity and no attorney-reviewed workflow
- due-on-sale risk makes the structure impractical

Those should route to:

- cash
- novation
- short sale
- seller finance
- attorney/housing counselor referral
- lender rescue referral

---

## Best source stack

### Layer 1: County / court / public records

Use these first:

- foreclosure docket / court filing feed
- sheriff sale calendar
- auction postponement notices
- treasurer tax delinquency list
- code violations / nuisance / vacant registry
- probate filings
- recorder / deed history

What we want to capture per property:

- owner name
- property address
- mailing address
- filing date
- case number
- plaintiff/lender
- sale date if set
- postponement / cancellation signal
- tax delinquency
- code issues
- vacancy signal

### Layer 2: DealMachine

Use DealMachine to:

- build and save preforeclosure lists
- overlay distress motivators
- export contacts where available
- preserve a fast operator workflow

### Layer 3: OSINT / public business research

Use OSINT for verification and enrichment, not for shady personal stalking.

Safe uses:

- entity lookup for LLC / trust owner
- state business records
- public websites
- public business profiles
- public phone/email validation
- map/street-view/property-condition review
- public social/business presence when relevant
- mailing-address comparison

Do not use:

- breach dumps
- private-account scraping
- fake accounts
- evasion tools
- anything that looks like surveillance

---

## Recommended lead routing model

Every preforeclosure lead should be assigned one primary exit lane:

1. `subject_to`
2. `cash_offer`
3. `novation`
4. `short_sale`
5. `seller_finance`
6. `lender_rescue_referral`
7. `attorney_housing_referral`

The repo already has a foreclosure router:

- `lib/admin/commandCenter.ts`

That should remain the source of truth for the route decision.

---

## Suggested scoring for `subject_to`

Add or enforce a `subject_to_fit_score` with these components:

- foreclosure filed: +15
- auction date within 45 days: +10
- auction postponed: +8
- absentee owner: +8
- rental demand strong: +10
- manageable arrears: +12
- equity between 10% and 30%: +10
- property appears habitable: +10
- tax + code stack: +6
- buyer/rental demand match: +8

Subtract:

- owner occupied + legal sensitivity: -12
- active bankruptcy: -15
- unresolved probate: -10
- heavy rehab / uninsurable condition: -8
- high equity and retail-ready condition: -10

Interpretation:

- `70+`: review for `subject_to`
- `55-69`: needs analyst review
- `<55`: route elsewhere

---

## Messaging strategy

### What not to do

Do not send messaging like:

- "We can stop your foreclosure"
- "Foreclosure will ruin your life"
- "Take this deal or lose your house"
- "We guarantee we can save your credit"

That is weak positioning and creates legal exposure.

### Better message frame

The message should do four things:

1. acknowledge timing pressure
2. state there may be several options
3. invite a conversation without pressure
4. disclose that VestBlock is not promising foreclosure relief or legal advice

### Benefits to explain if `subject_to` is actually a fit

Explain plainly:

- faster resolution than waiting for a completed foreclosure
- possibility of bringing arrears current
- reduced pressure from missed payments
- chance to preserve some dignity, time, or relocation flexibility
- may be better than letting the file run all the way to sale

Also disclose plainly:

- the existing loan stays in the seller's name until payoff/refinance
- lender approval is not guaranteed
- this is not right for every owner
- seller should review with an attorney or housing counselor if owner-occupied

### Better first-touch email

Subject:

- `Question about the property on [Street]`
- `Open to reviewing options on [Street]?`

Body:

Hi [Name],

I’m reaching out because public records suggest there may be time-sensitive issues around [property].

VestBlock reviews off-market options with owners when a property may not be a fit for a traditional sale timeline. Depending on the situation, that can mean a direct purchase, a creative structure, or simply helping you understand whether a quick investor route is even worth discussing.

If you are open to a short conversation, reply `yes` and I will keep it straightforward. If not, no problem, and I will close the file on my side.

VestBlock does not guarantee foreclosure relief, legal outcomes, lender approval, or closing.

[signature + mailing address + opt-out]

### Better first-touch phone / voicemail script

Short version:

`Hi [Name], this is Robert with VestBlock. I’m calling about [address]. Public records suggest there may be some timing pressure around the property, and we review off-market options when a traditional sale may not be the best fit. If you want to compare options, call or text me back at [number].`

No pressure language. No `save your house` language.

---

## Operating workflow

### Daily

1. Pull new county foreclosure filings and sale updates.
2. Pull sheriff sale changes and postponements.
3. Overlay tax/code/vacancy/probate signals.
4. Match against DealMachine property rows where possible.
5. Create research checklist records.
6. Score and route each lead.
7. Only outreach from `ready` or `approved`.

### Analyst review checklist

Before outreach, confirm:

- actual foreclosure signal is current
- owner name and mailing address match
- owner occupancy guess is reasonable
- sale date or timing pressure is real
- title complexity not obviously disqualifying
- exit route is correct
- outreach copy matches route

---

## Better skip-trace strategy

### Current problem

The team has leaned on DealMachine Contacts exports because they are fast and already structured.

That is fine for some lanes, but for preforeclosure it leaves money on the table when:

- county lead appears before DealMachine contact coverage
- an LLC owner needs entity research
- mailing address differs from property address
- there is a better public source for a business phone/email

### Better model

Use a tiered contact strategy:

#### Tier 1: Existing contact data

- DealMachine Contacts export
- prior CRM records
- prior seller replies

#### Tier 2: Public-record contact anchors

- tax mailing address
- recorder mailing address
- secretary of state / entity manager info
- registered agent

#### Tier 3: Public OSINT enrichment

- public business websites
- public broker/investor pages
- public directory evidence
- email pattern inference + validation

#### Tier 4: Paid skip trace

Only after:

- the lead is actually worth it
- the lane is approved
- a human approves spend

This matches the existing repo posture in `scripts/skip-trace-prep.mjs`.

---

## Repo tools we should be using more

### Already in the repo

- `scripts/dealmachine-research-checklists.mjs`
- `lib/osint/*`
- `docs/VESTBLOCK_RESEARCH_CHECKLIST.md`
- `scripts/outscraper-real-estate-discovery.mjs`
- `scripts/skip-trace-prep.mjs`
- `lib/admin/commandCenter.ts`

### Practical use

1. County lead enters system.
2. Create research checklist row immediately.
3. Attach county evidence and source links.
4. Run route logic.
5. Pull public owner/entity evidence.
6. Use DealMachine export if available.
7. If still weak, prepare a manual skip-trace batch only for approved leads.

---

## What should change operationally

### Change 1

Stop treating all preforeclosure leads as the same seller lane.

Required split:

- owner-occupant sensitive foreclosure
- absentee landlord foreclosure
- investor-owned distressed property
- auction-postponed / failed sale
- surplus follow-up

### Change 2

Stop pitching `subject_to` first.

Pitch `reviewing options` first.  
Route to `subject_to` after diligence.

### Change 3

Use county sources as the trigger, not just DealMachine.

DealMachine stays in the loop for:

- contact exports
- mobile workflow
- list management

### Change 4

Only pay for skip tracing on scored leads.

That means:

- foreclosure filed
- route likely `subject_to`, novation, or high-value cash
- contact gap remains after public research

---

## Implementation plan

### Phase 1: Immediate

1. Create a dedicated `preforeclosure_subject_to` operating lane.
2. Reuse the existing research checklist workflow for county leads.
3. Add `subject_to_fit_score` to the checklist payload.
4. Create route-specific outreach copy for:
   - owner-occupant review
   - absentee landlord review
   - investor owner review
5. Keep `subject_to` copy separate from cash and novation.

### Phase 2: This week

1. Add county source adapters for the first target counties.
2. Ingest leads into internal checklist rows.
3. Build dashboard view:
   - new foreclosure filings
   - auction within 45 days
   - postponements
   - `subject_to_fit_score >= 70`
4. Add a manual-review gate before any owner-occupant send.

### Phase 3: Next

1. Build a contact waterfall:
   - DealMachine contact
   - county/public mailing contact
   - entity lookup
   - public OSINT
   - paid skip trace only if approved
2. Add reporting:
   - source by county
   - route by exit
   - contact rate
   - reply rate
   - appointment rate
   - conversion by lane

---

## Recommended first counties

Start where the repo already has county foreclosure logic and command-center support:

- Milwaukee County
- Waukesha County
- Lucas County
- Cuyahoga County
- Wayne County

These are already referenced in `lib/admin/commandCenter.ts`.

---

## Bottom line

The right model is:

- county-first signal detection
- DealMachine as one contact/export source
- OSINT for verification and enrichment
- route first, outreach second
- `subject_to` only where the numbers and legal posture actually fit

The main mistake to avoid is turning preforeclosure into a generic fear-based `save your house` campaign. That is weak, non-differentiated, and legally noisy.

The better system is an evidence-backed routing engine that decides whether the lead should receive:

- cash
- novation
- subject-to
- seller finance
- short sale
- referral

before anyone sends a message.
