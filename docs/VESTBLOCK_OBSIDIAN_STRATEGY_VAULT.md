# VestBlock Obsidian Strategy Vault

## Decision

Obsidian is useful as a local, linked thinking surface for VestBlock strategy. It is not a replacement for Supabase, the Command Center, approval controls, or campaign attribution.

The implemented vault is a **derived, read-only projection**. It exports strategy and aggregate experiment data only. It does not export leads, customers, email addresses, phone numbers, property addresses, credentials, or message bodies.

## Installed on the Mac Pro

- Obsidian `1.13.6`
- `obsidian-markdown`
- `obsidian-bases`
- `json-canvas`
- `obsidian-cli`

The skills were installed from `kepano/obsidian-skills` at commit `a1dc48e68138490d522c04cbf5822214c6eb1202` after confirming that the selected skill folders contained Markdown/reference files and no executable payloads.

The Obsidian application and vault are installed, registered, and open on `00 - Home.md`. The built-in CLI is enabled and verified. Agents should use the guarded repository command instead of raw destructive or publishing commands:

```bash
pnpm run obsidian:agent -- status
pnpm run obsidian:agent -- refresh
pnpm run obsidian:agent -- read --path "00 - Home.md"
pnpm run obsidian:agent -- search --query "strategy"
pnpm run obsidian:agent -- append-founder --text "Decision or observation"
```

## What the vault contains

- `00 - Home.md`: operating index and real record counts
- `Lanes/`: Today, Pipeline, Growth, AI Brain, and System
- `Strategies/`: linked strategy decision records from `strategy_updates`
- `Experiments/`: aggregate attribution records from `experiment_results`
- `Dashboards/`: Obsidian Bases for the decision queue and experiment memory
- `Maps/`: JSON Canvas map of the five-lane operating system
- `Notes/Founder Notes.md`: human-owned and never overwritten
- `Templates/Decision Note.md`: human-owned decision template
- `.vestblock-export-manifest.json`: provenance, counts, warnings, and safety boundaries

The real VestBlock monogram is copied into `Assets/` when available.

## Run it

From the primary Mac Pro repository:

```bash
pnpm run obsidian:vault:export
```

The default vault location is `~/Documents/VestBlock Strategy Vault`. Override it with `VESTBLOCK_OBSIDIAN_VAULT=/absolute/path`.

Run the deterministic safety test without touching live data:

```bash
pnpm run test:obsidian-vault
```

## First live proof

The first Mac Pro export completed without warnings and produced a valid seven-node/five-edge Canvas, 361 aggregate content records, and the latest 250 strategy-run rows. There were no current `vestblock_strategy` candidates or attributed strategy experiments, so the vault correctly showed empty strategy-memory states instead of inventing records. A pattern scan found no email addresses or phone numbers in the vault.

## Operating boundary

Generated strategy, experiment, lane, Base, Canvas, and home files are overwritten on export. Durable human thinking belongs under `Notes/`.

The vault cannot approve a strategy, launch a campaign, publish content, send outreach, deploy code, or spend money. Those actions remain in the VestBlock application and its existing approval gates.
