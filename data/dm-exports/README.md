DealMachine Contacts exports belong here.

Naming:
- `philadelphia-pa-YYYY-MM-DD.csv`
- `kansas-city-mo-YYYY-MM-DD.csv`
- `new-orleans-la-YYYY-MM-DD.csv`

Operating rule:
- Export `Contacts` from the DealMachine website into this folder.
- Run `npm run distress:dealmachine:ingest-export:apply` to copy fresh downloads here.
- Live outreach now requires an explicit export path:
  - `node --env-file=.env.local scripts/dealmachine-export-outreach.mjs --market=philadelphia-pa --export-csv=data/dm-exports/philadelphia-pa-YYYY-MM-DD.csv`
- Do not rely on files left in `~/Downloads/`.
