# VestBlock — Distress Stack Builder

Wholesaling lead engine that **stacks two distress signals** — tax-delinquent **AND** code-violation on the same property — and outputs an address list for enrichment/outreach. Starts in a couple of areas and **expands daily** via an area queue.

## Why stack
A property that is both **behind on taxes** and **cited for code violations** signals a financially stretched, disengaged owner = a motivated seller. Far higher conviction than either list alone.

## Data sources (all public records, read-only)
| Signal | Source | Notes |
|---|---|---|
| Code violations | City of Cincinnati Code Enforcement (Socrata API `cncm-znd6`) | Daily refresh; open cases; carries property `full_address` |
| Tax delinquent | Hamilton County CAGIS parcel attributes (`HCE/Cadastral/MapServer/2`, `DELQ_TAXES>0`) | Carries **situs address** + `DELQ_TAXES`, `DLNQDT`, `FORECL_FLAG`, owner |

The intersection is done on **normalized property address** (both sources carry situs address), so it's a true same-property match.

## Run it
```bash
# process the next 2 areas in the Cincinnati queue
npm run distress:stack
# or directly, a specific neighborhood:
node scripts/distress-stack-builder.mjs --market=cincinnati --area="AVONDALE"
```

## Output (per run, in `data/distress-leads/`)
- `cincinnati-<date>.csv` — all code-violation distress leads for the areas processed
- `cincinnati-<date>-BOTH-SIGNALS.csv` — **the stacked list**: properties that are tax-delinquent *and* code-cited, with `address`, `violation`, `violation_date`, `delinquent_amount`, `foreclosure_flag`, `delinquent_owner`, `delinquent_parcel`

These addresses feed enrichment (skip-trace / owner contact) and the seller-outreach flow.

## DealMachine handoff

The stacked list can now be handed to DealMachine two ways:

```bash
# dry run + writes a full DealMachine-ready CSV
npm run distress:dealmachine

# read-only API auth check
npm run distress:dealmachine:pull

# safest first live API write: only the top 25 by delinquent amount
npm run distress:dealmachine:push25
```

Files:
- `data/distress-leads/dealmachine-import.csv` — manual DealMachine import file, sorted by highest delinquent amount first
- `data/distress-leads/dealmachine-pushed.json` — local dedupe log for API pushes

The API sync uses DealMachine's official `public/v1` API with Bearer auth from `DEALMACHINE_API_KEY`. It creates leads and notes only; it does **not** start a mail sequence. If `DEALMACHINE_LIST_IDS`, `DEALMACHINE_TAG_IDS`, or `DEALMACHINE_LEAD_STATUS_ID` are set, the script can attach list/tag/status metadata after lead creation.

## Daily expansion
- An **area queue** (`data/distress-sources/<market>-area-queue.json`) lists every neighborhood ordered by open-violation volume. Each run advances 2 areas and wraps around to refresh once all are covered.
- Install the daily LaunchAgent (macOS, runs 7:05 AM):
  ```bash
  npm run distress:stack:install        # installs + loads io.vestblock.distress-stack
  # stop it:
  launchctl unload ~/Library/LaunchAgents/io.vestblock.distress-stack.plist
  ```
- Logs: `data/distress-leads/logs/`.

## Adding markets
Each market needs a code-violation source (with address) and a delinquency source (with address). Add an entry to `MARKETS` in `scripts/distress-stack-builder.mjs`:
- `violationsUrl(area)` — open code-violation API filtered to one area
- `delinquentCagis` (or an equivalent address-bearing tax-delinquent feed)

Then add the market name to the `MARKETS` array in `scripts/distress-stack-daily.sh`. Good next markets (address-native on both signals): Detroit (blight + parcels), and other ArcGIS/Socrata counties that expose `DELQ_TAXES` on a parcel layer.

## Live markets
- **Cincinnati** — tax-delinquent × code-violation (neighborhood queue)
- **Milwaukee** — tax-delinquent × vacant building (whole-city)
- **Toledo** — nuisance grass-mowing × tax-delinquent (Lucas AREIS). Note: AREIS taxdue layer is partial (~1.4k current-due), so the 6,170 city-mowed nuisance list is the stronger standalone signal.
- **Detroit** — tax-delinquency NOT available as free bulk data (Wayne County is per-parcel lookup only; the Detroit parcel file carries taxability, not delinquency). Alternatives: blight-ticket × absentee-owner stack, or a paid delinquency source (Regrid/ATTOM).

## Compliance
Public-records data only (county tax + city code enforcement). No protected data, no scraping of gated sites. Contacting distressed/pre-foreclosure owners is regulated (TCPA/DNC for calls/texts; some states have foreclosure-consultant/equity-purchaser disclosure laws) — handle outreach accordingly.
