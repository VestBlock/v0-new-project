# DealMachine Native Operating Model
**Updated:** 2026-06-08

This file replaces the old API-first process.

## What the official DealMachine docs say

- The **public API is limited**. DealMachine’s own API docs say the API is mainly for adding and updating leads, not for full contact-export workflows: [docs.dealmachine.com](https://docs.dealmachine.com/).
- **List Builder lives in the website/app**, not the public API. Official help docs say list creation starts in **Map**, where you choose geography, apply motivators, and click **Build List**: [How to build your own List of properties using DealMachine's List Builder](https://help.dealmachine.com/en/articles/6125128-how-to-build-your-own-list-of-properties-using-dealmachine-s-list-builder).
- **Smart Lists update automatically**. DealMachine says every list built through List Builder is a Smart List that updates as properties enter or leave the criteria set: [Understanding Smart Lists](https://help.dealmachine.com/en/articles/8568428-understanding-smart-lists).
- If you want a fixed export snapshot, convert the Smart List to a **Static List** before exporting or deleting: [I don't want my lists to be Smart Lists](https://help.dealmachine.com/en/articles/8568526-i-don-t-want-my-lists-to-be-smart-lists).
- For contact outreach, the right export is **Contacts Export** from the website. Official docs say Contacts Export includes names, phone numbers, emails, mailing addresses, demographics, owner-type filters, DNC/landline/wireless scrub options, and deduplication: [Export leads to a spreadsheet](https://help.dealmachine.com/en/articles/1905945-export-leads-to-a-spreadsheet).
- DealMachine also states that **exporting is how you get the usable contact data**, and that phone numbers may not be accessible from the API path: [Export specific lists from DealMachine](https://help.dealmachine.com/en/articles/3321492-export-specific-lists-from-dealmachine).
- Inside a lead, **Associated Contacts** shows the actual people data, including phone number carrier/type and emails, which is useful for manual QA before export: [Associated Contact Information](https://help.dealmachine.com/en/articles/8588629-associated-contact-information).
- Saved filters are useful, but **location is not saved** with them. DealMachine says you must re-enter the city/ZIP/county each time: [How to Save Filters](https://help.dealmachine.com/en/articles/8779699-how-to-save-filters).

## New rule set

1. **Do not use the public API to build fresh-city lists.**
2. **Do not use the public API as a contact source.**
3. **Build lists natively in DealMachine Map/List Builder.**
4. **Export Contacts from the website.**
5. **Use local scripts only after the Contacts export exists on disk.**

## New workflow

### 1. Build the list in DealMachine

In `Map`:
- Search the city, ZIP, or county.
- Select the exact geography from the dropdown result.
- If the map does not populate, zoom further into the target area until properties load.
- Apply motivators.
- Click `Build List`.

Important behavior from DealMachine:
- multiple quick filters default to broad matching unless you enable **Match All**
- typing a location alone is not enough; you must choose the city/county/ZIP from DealMachine's suggestion list
- List Builder can include up to 5 cities, ZIPs, or counties in one search flow
- saved filters do **not** save the geography
- every new List Builder list starts as a **Smart List**

Recommended seller filters for VestBlock:
- Off Market
- High Equity
- Tax Delinquent
- Preforeclosure
- Vacant
- Absentee / Out-of-State Owner
- Single Family / small residential only

Use `Match All` when you want narrower, higher-intent lists.

### 2. Freeze the list if you need a stable export

If the list will be worked by outreach this week:
- Open `Leads`
- `Open Lists`
- select the list
- `View List`
- `Convert to Static List`

This prevents Smart List churn while we review and export.

### 3. Export Contacts, not Properties

From `Leads`:
- apply the list or filters
- `Select All`
- `Lead Actions`
- `Export Leads`
- choose `Contacts`

Recommended export settings for outreach:
- owner type: `Likely Property Owners`
- deduplicate: on
- scrub DNC: on
- scrub landline: on
- scrub wireless: off for text campaigns, on only if you intentionally want to exclude mobile numbers
- include property info columns as needed

The recommendation on scrub settings is our operating choice based on the options DealMachine exposes in Contacts Export.

### 3a. Website QA before export

Before exporting any new city:
- open 3-5 leads inside the target list
- inspect `Associated Contacts`
- confirm the city and property type are correct
- confirm actual phones/emails are present
- confirm the list is not flooded with irrelevant owner types or dead records

If those checks fail, adjust the geography or filters before exporting.

### 4. Download and ingest

Save the CSV, then run:

```bash
npm run distress:dealmachine:ingest-export
npm run distress:dealmachine:ingest-export:apply
```

That places the export in:

```text
data/dm-exports/<market>-YYYY-MM-DD.csv
```

### 5. Preview outreach

Before sending, create internal Research Checklist records from the same export:

```bash
npm run distress:dealmachine:research-checklists -- \
  --market=philadelphia-pa \
  --export-csv=data/dm-exports/philadelphia-pa-2026-06-08.csv \
  --limit=150
```

Dry run is default. To write internal records for review:

```bash
npm run distress:dealmachine:research-checklists -- \
  --market=philadelphia-pa \
  --export-csv=data/dm-exports/philadelphia-pa-2026-06-08.csv \
  --limit=150 \
  --apply
```

Review `/admin/research-checklists` before live outreach.

```bash
node --env-file=.env.local scripts/dealmachine-export-outreach.mjs \
  --market=philadelphia-pa \
  --export-csv=data/dm-exports/philadelphia-pa-2026-06-08.csv \
  --limit=150
```

### 6. Send

```bash
node --env-file=.env.local scripts/dealmachine-export-outreach.mjs \
  --market=philadelphia-pa \
  --export-csv=data/dm-exports/philadelphia-pa-2026-06-08.csv \
  --limit=150 \
  --send
```

## What we removed

These were part of the broken process and should stay dead:

- synthetic Atlas/API list-building
- API contact scouting as a primary tactic
- requiring a local queue file before working a real DealMachine Contacts export

## Operational notes

- Re-exporting the same lead in the same billing cycle does not count again according to DealMachine’s export article.
- Multiple contacts tied to one property still count as one exported property.
- Deleting a list does **not** delete the leads inside it. Delete leads first if you need capacity back.
- Smart Lists can repopulate unless converted to Static Lists first.

## The boundary

Use DealMachine for:
- list creation
- smart/static list management
- associated contacts
- contact exports

Use our local scripts for:
- file ingest
- internal research checklist creation
- message generation
- send throttling
- mobile-only phone filtering
- dedupe across prior sends
