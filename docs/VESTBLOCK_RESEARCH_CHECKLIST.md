# VestBlock Research Checklist

## Purpose

The Research Checklist is an internal diligence workflow. It helps VestBlock review property context, owner/entity details, contact quality, partner fit, and outreach readiness before any seller, buyer, lender, investor, contractor, developer, land bank, or bank-owned asset follow-up.

This is not a public website feature and should not be marketed as a customer-facing product.

## Safe Sources

Use legal, public, and business-appropriate sources only:

- public property records
- county and city datasets
- business/entity records
- mapping and street-view sources
- public websites and public business profiles
- email and phone validation
- DealMachine data already exported by VestBlock
- RentCast estimates when environment variables are configured

## Prohibited Sources

Do not use or recommend:

- fake identities
- throwaway accounts
- darknet sources
- breach dumps or credential leaks
- evasion tools
- private-account scraping
- bypassing platform protections
- anything that would look like spying on a person

## Workflow

1. Source a property/contact from seller intake, DealMachine, investor discovery, buyer/lender intake, land bank research, or bank-owned asset outreach.
2. Create an internal Research Checklist record.
3. Review property, owner/entity, contact quality, maps, fit criteria, risk flags, and opportunity flags.
4. Set a recommended lane.
5. Set outreach status to `ready` or `approved` only after review.
6. Send outreach only from approved workflows.
7. Record replies, next actions, and follow-up dates.

## Scoring

The confidence score is 0-100:

- Property verified: 15
- Owner/entity verified: 15
- Contact quality reviewed: 20
- Public/source links attached: 10
- Fit/buy box/lending/partner criteria reviewed: 15
- Map/condition context reviewed: 10
- Risk reviewed: 10
- Next action selected: 5

## Outreach Readiness

Use `isResearchOutreachReady(checklist)` before live sends where practical.

A checklist is outreach-ready only when:

- outreach status is `ready` or `approved`
- confidence score is at least 60
- status is not `do_not_contact`
- email or mobile phone is present
- recommended lane is not `no_outreach`

## DealMachine Usage

After exporting Contacts from DealMachine and ingesting the CSV, create internal checklist records before outreach:

```bash
npm run distress:dealmachine:research-checklists -- \
  --market=<city-state> \
  --export-csv=data/dm-exports/<market>-YYYY-MM-DD.csv
```

Dry run is the default. To write records:

```bash
npm run distress:dealmachine:research-checklists -- \
  --market=<city-state> \
  --export-csv=data/dm-exports/<market>-YYYY-MM-DD.csv \
  --limit=100 \
  --apply
```

Then review `/admin/research-checklists` before sending seller outreach.

## RentCast Usage

If `RENTCAST_API_KEY` and related property estimate settings are present, property estimates can be attached to the checklist context by future enrichment jobs. Missing RentCast configuration should never block checklist creation.

## Daily Operating Process

- Review new DealMachine exports.
- Convert fresh export rows into Research Checklist records.
- Clear `needs_review` rows by checking owner/entity, contact quality, and property context.
- Mark only reviewed rows as `ready` or `approved`.
- Keep `do_not_contact` rows suppressed.
- Use follow-up dates to keep partner and seller conversations moving.
- Do not commit raw lead CSVs.
