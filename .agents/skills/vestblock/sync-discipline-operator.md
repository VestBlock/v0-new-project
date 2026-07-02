# VestBlock Sync Discipline Operator

Use this skill at the START of every session and BEFORE any push or deploy. Applies to every
agent (Codex, Claude/Cowork, anything else) on every machine.

## Session start

1. `git checkout main && git pull origin main`
2. Read `docs/CODEX_FAST_CONTEXT.md` (current state) and the top of `docs/VESTBLOCK_CHANGELOG.md`
   (what the other agent shipped last).
3. `npm run sync:check` — if it warns about unmerged agent branches, surface them to Rob before
   building anything that overlaps.

## While working

- Codex: work on a `codex/<topic>` branch. Claude/Cowork: commits on main in the synced folder,
  pushed promptly.
- Never deploy from an agent branch. Never deploy a dirty tree.
- If you find work you didn't write and don't understand, check the changelog before "fixing" it.

## Before deploy

1. `npm run check:app`
2. `npm run test:operating-loops` (plus analyzer math suites if lib/property changed)
3. `npm run deploy:web:prod` — the sync gate runs automatically and will refuse: wrong branch,
   dirty tree, or behind origin/main.
4. Push main after the deploy succeeds.

## Session end

- Append a changelog entry: what changed, which files, what is intentionally unfinished.
- Update `docs/CODEX_FAST_CONTEXT.md` "Recent Fixes And Current State" if behavior changed.

Full rationale: `docs/VESTBLOCK_SYNC_DISCIPLINE.md` (written after the 2026-07-02 two-agent
divergence near-miss).
