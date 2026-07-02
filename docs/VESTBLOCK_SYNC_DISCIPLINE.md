# VestBlock Sync Discipline

Last updated: 2026-07-02

## Why this exists

On 2026-07-02, two AI agents (Claude in the synced folder, Codex in a separate clone) produced
two divergent lines of work; production was deployed from an agent branch (`c1cb888`) while a
larger body of work (`b3b87a1`) sat unpushed in the other clone. Nothing broke — but only by luck.
These rules make that structurally impossible instead of luck-dependent.

## The rules

1. **One source of truth: `origin/main` on GitHub.** A machine's local clone is a workspace,
   never the reference.
2. **Agents work on branches, humans merge to main.** Codex pushes to `codex/*` branches;
   Claude/Cowork commits land on `main` in the synced folder and get pushed promptly. Any agent
   branch merges to main before its work is considered "done."
3. **Deploys ship from `main` only, from a committed tree only, never while behind
   `origin/main`.** Enforced mechanically: `npm run deploy:web:prod` now runs
   `scripts/sync-check.mjs` first and refuses otherwise.
4. **Gate before deploy:** `npm run check:app` (typecheck + build) and
   `npm run test:operating-loops` at minimum. If analyzer code changed, also the two math suites.
5. **Push after deploy.** A deployed commit that isn't on GitHub is invisible to the other machine
   and the other agent. `sync-check` warns when HEAD is ahead of origin.
6. **Read `docs/CODEX_FAST_CONTEXT.md` before starting work** — every agent, every session.
   It carries the current-state ledger so agents stop rediscovering (or re-breaking) each other's work.
7. **Session end = changelog entry.** Every working session appends to `docs/VESTBLOCK_CHANGELOG.md`.
   That file is how the two agents talk to each other across sessions.

## Daily commands

- `npm run sync:check` — run any time to see branch/dirty/behind/agent-branch status
- `npm run deploy:web:prod` — sync check runs automatically first
- After deploying from one Mac: `git pull origin main` on the other before any new work there

## Escape hatches (use loudly, never silently)

`--allow-branch`, `--allow-dirty`, `--skip-fetch` on sync-check exist for genuine emergencies.
If one is used, say so in the changelog entry.
