# VestBlock Pro Primary Cutover

This workspace is now configured so the Pro should be the only machine allowed to run:

- live DealMachine export orchestration
- live seller outreach autopilot
- launchd-based distress-stack loops

The Air should stay command-center/review only.

## What changed

- `config/primary-machine.json` now defines:
  - `primaryHostname`
  - `commandCenterHostname`
  - `freshExportMaxAgeDays`
- `scripts/require-primary-machine.mjs` blocks live execution on non-primary machines.
- Live outreach now rejects stale DealMachine CSVs older than 2 days unless explicitly overridden with `--allow-stale-export`.
- Air-side Codex automations were paused so they stop acting like production.

## On the Pro

1. Put the same repo/workspace on the Pro.
2. Make sure the Pro hostname matches `config/primary-machine.json`.
3. If the Pro hostname differs, update:

```json
{
  "primaryHostname": "YOUR-PRO-HOSTNAME.lan"
}
```

4. Confirm the guard passes:

```bash
node scripts/require-primary-machine.mjs
```

5. Re-enable the paused automations from the Pro-side Codex app.
6. Run fresh export orchestration from the Pro only:

```bash
npm run distress:dealmachine:export-orchestrator:apply
```

7. Build fresh lists from the latest strategy package in:

`tmp/outreach/dealmachine-list-builder-expansion-*.md`

8. After fresh Contacts CSV exports arrive, ingest them:

```bash
pnpm run distress:dealmachine:ingest-export:apply -- --file=/path/to/dealmachine-contacts.csv --split-by-market
```

9. Only after fresh exports are ingested, run live outreach:

```bash
node --env-file=.env.local scripts/seller-outreach-autopilot.mjs --send --daily-cap=500
```

## Fresh strategy pack created today

Generated file set:

- `tmp/outreach/dealmachine-list-builder-expansion-2026-07-07T16-16-31-577Z.csv`
- `tmp/outreach/dealmachine-list-builder-expansion-2026-07-07T16-16-31-577Z.md`
- `tmp/outreach/dealmachine-list-builder-expansion-2026-07-07T16-16-31-577Z.json`

Markets included:

- Dayton, OH
- Akron, OH
- Buffalo, NY
- Omaha, NE
- Des Moines, IA
- Syracuse, NY
- Rochester, NY
- Youngstown, OH

Strategies included:

- divorce-separation
- relocation-job-transfer
- out-of-state-heir
- seller-finance-equity
- tired-landlord
- code-violation-distress
- preforeclosure-equity
- probate-inheritance

## Rule going forward

No more live outreach from stale local June exports.
Fresh exports first, Pro execution second, Air review third.
