# DealMachine Website Setup Checklist

Use this when building a new city list for outreach.

## 1. Build the list in DealMachine

In `Map`:
- search the city, ZIP, or county
- select the intended geography from DealMachine's dropdown, do not assume the typed text alone is enough
- if the map stays blank or says to zoom in more, zoom further into the target area until properties load
- apply the filters
- turn on `Match All` when combining distress filters
- click `Build List`

Notes:
- DealMachine lets you add up to 5 locations in one search flow
- saved filters do not save geography, so re-enter the city/county every time
- every new list built this way starts as a Smart List

Recommended seller filters:
- Off Market
- High Equity
- Tax Delinquent
- Preforeclosure
- Vacant
- Absentee / Out-of-State Owner
- Single Family or small residential

## 2. Freeze the list if needed

If the team is about to work the list:
- `Leads`
- `Open Lists`
- select the list
- `View` / `Open`
- `Convert to Static List`

Do this before export if you want a stable snapshot.

Do not export a Smart List for outreach if the list is still changing materially.

## 3. QA a few leads inside DealMachine

Open several leads and inspect `Associated Contacts`:
- confirm the city is correct
- confirm there are real phone numbers and emails
- confirm the list is not flooded with dead or irrelevant records

## 4. Export Contacts

From `Leads`:
- apply the list or filter
- `Select All`
- `Lead Actions`
- `Export Leads`
- choose `Contacts`

Recommended export options:
- owner type: `Likely Property Owners`
- deduplicate: on
- scrub DNC: on
- scrub landline: on

If you want textable mobile rows, do not scrub wireless.

Before exporting a full city:
- open 3-5 records inside `Associated Contacts`
- confirm the city and property type are correct
- confirm contacts are populated with real phones/emails
- confirm the list is not dominated by irrelevant owner types

## 5. Ingest locally

```bash
npm run distress:dealmachine:ingest-export
npm run distress:dealmachine:ingest-export:apply
```

## 6. Preview outreach

```bash
node --env-file=.env.local scripts/dealmachine-export-outreach.mjs \
  --market=<city-state> \
  --export-csv=data/dm-exports/<market>-YYYY-MM-DD.csv \
  --limit=150
```

Review the draft text file in `tmp/outreach/`.

## 7. Send only after review

```bash
node --env-file=.env.local scripts/dealmachine-export-outreach.mjs \
  --market=<city-state> \
  --export-csv=data/dm-exports/<market>-YYYY-MM-DD.csv \
  --limit=150 \
  --send
```

## Non-negotiables

- Do not use the DealMachine public API to build the city list.
- Do not use the API as the contact source.
- Do not send from old exports unless intentionally chosen.
- Do not use seller copy that mentions funding or DSCR.
- Do not treat a list shell as a completed list; only proceed after properties and contacts are visible in the website.
