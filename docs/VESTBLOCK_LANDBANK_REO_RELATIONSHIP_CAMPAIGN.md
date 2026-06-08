# VestBlock Land Bank And REO Relationship Campaign

This campaign is for building repeat inventory relationships with:

- county land banks
- municipal land banks
- metro / regional land banks
- state land banks
- bank special-assets teams
- REO asset managers
- servicer disposition contacts

## Goal

VestBlock should not depend only on random inbound seller flow. It should also build supply-side relationships with institutions that control distressed, transitional, publicly held, surplus, tax-sale, and bank-owned inventory.

## What we are telling them

VestBlock is building a disciplined inventory and partner-routing platform for real estate. The message is:

- we are not trying to be a noisy blast list
- we are not pitching fake certainty
- we are building a repeatable relationship for qualified inventory
- we can route opportunities toward actual buy-box fit
- we can line up rehab, rental, redevelopment, and capital conversations more intentionally
- we want to learn their process, not force ours

## Campaign assets

- Targets CSV: [data/relationship-campaigns/landbank-reo-targets.csv](/Users/mrsanders/Downloads/Codex%20Folder/data/relationship-campaigns/landbank-reo-targets.csv)
- REO template CSV: [data/relationship-campaigns/bank-owned-asset-targets-template.csv](/Users/mrsanders/Downloads/Codex%20Folder/data/relationship-campaigns/bank-owned-asset-targets-template.csv)
- Sender script: [scripts/landbank-reo-relationship-campaign.mjs](/Users/mrsanders/Downloads/Codex%20Folder/scripts/landbank-reo-relationship-campaign.mjs)

## Cadence

1. `initial`
   - explain VestBlock clearly
   - ask for the right intake path
   - ask about buyer / developer / operator qualification
   - ask what inventory is hardest to move

2. `followup_1`
   - reinforce seriousness
   - ask for the correct contact, process, or approved-buyer path

3. `followup_2`
   - final polite follow-up
   - leave the door open

## Commands

Dry run:

```bash
node --env-file=.env.local scripts/landbank-reo-relationship-campaign.mjs
```

Live send:

```bash
node --env-file=.env.local scripts/landbank-reo-relationship-campaign.mjs --send --daily-cap=6
```

Only land banks:

```bash
node --env-file=.env.local scripts/landbank-reo-relationship-campaign.mjs --only-types=county_land_bank,municipal_land_bank,metro_land_bank,state_land_bank
```

Only REO / bank-owned targets after the template is populated:

```bash
node --env-file=.env.local scripts/landbank-reo-relationship-campaign.mjs --csv=data/relationship-campaigns/bank-owned-asset-targets-template.csv --send --daily-cap=4
```

## Artifacts

Drafts and send results are written under:

- `artifacts/offline-automation/relationship-campaigns/<date>/landbank-reo`

State is stored at:

- `data/relationship-campaigns/landbank-reo-state.json`

Sent ledger is stored at:

- `artifacts/offline-automation/relationship-campaigns/landbank-reo-sent-ledger.jsonl`

## Guardrails

- keep volume small and intentional
- no misleading claims about owned inventory
- no fake promises about guaranteed buyers or closings
- respect public institution workflows
- use official contact paths first
