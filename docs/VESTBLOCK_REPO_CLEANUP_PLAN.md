# VestBlock Repo Cleanup Plan

Last updated: 2026-05-09

This is the cleanup checklist for turning the current large worktree into a maintainable production release without losing active app work.

## Current State

- Branch: `main`
- Worktree: large in-progress feature branch state with hundreds of modified and untracked entries.
- Safe generated output found locally: `.next/`, `node_modules/`, `.vercel/`, and `tsconfig.tsbuildinfo`.
- Customer-facing additions that should be preserved: DealVault, smart contracts, visibility services, pricing, get-started, upgraded public pages, and the new `/dealvault/demo` funnel.
- Internal additions that should be preserved but kept guarded: admin dashboards, diagnostics, lead/outreach automation, PR engine, lender/buyer engines, and cron routes.

## Keep

- `app/`, `components/`, `lib/`, `db/migrations/`, `contracts/`, `scripts/`, `public/`, `supabase/`, `test/`, and `tests/` when they are part of the app, automation, contracts, QA, or public website.
- `docs/VESTBLOCK_CURRENT_SYSTEM.md` as the source of truth.
- `.agents/skills/vestblock/` as local operating instructions for Codex-powered QA, revenue operations, outreach, and improvement loops.
- PostHog analytics because it is actively wired into payments, leads, chat, uploads, dashboards, and health checks.

## Archive

- Dated prospect-segment docs after their lessons are copied into the active outreach strategy.
- Old sprint notes that explain history but are no longer the current release plan.
- Handoff prompts that are useful for future agents but not part of active app behavior.

## Delete Or Ignore

- Generated files and folders: `.next/`, `node_modules/`, `.vercel/`, `tsconfig.tsbuildinfo`, cache folders, build output, local automation result JSON files, and logs.
- One-off screenshots, throwaway exports, or scratch files if they are not referenced by routes, docs, tests, or scripts.
- Use `npm run clean:local` after local QA to remove generated build/cache files without touching source code.

## Review Before Removing

- Any route under `app/`.
- Any shared UI component under `components/`.
- Any automation, Supabase, blockchain, payment, or lead code under `lib/`.
- Any migration under `db/migrations/`.
- Any smart contract deployment file under `deployments/`.

## Suggested Commit Order

1. Cleanup and platform config: `.gitignore`, `package.json`, `tsconfig.json`, `vercel.json`, middleware, auth access helpers, and shared UI primitives.
2. Public website and revenue funnel: homepage, services, pricing, DealVault, smart contracts, visibility expansion, AI assistant, shared marketing components, sitemap, robots, metadata, and public assets.
3. DealVault and smart contracts: dashboard routes, APIs, blockchain helpers, contracts, scripts, deployments, tests, certificates, and DealVault docs.
4. Lead/outreach/revenue automation: lead APIs, cron routes, buyer/lender/PR engines, outbound copy, no-email export, scorecards, and automation docs.
5. Admin and operations: admin dashboards, diagnostics, reports, internal navigation, admin APIs, and operations docs.
6. Funding, credit, and customer tools: funding dashboard, credit tools, dispute letters, grants, upload flows, and related APIs.
7. Database and generated types: Supabase migrations, `types/supabase.ts`, and schema docs.
8. Final QA docs: production readiness, security, external audit readiness, and current system docs.

## Release Gate

Run these before a production deploy:

```bash
npm run check:app
npm run check:contracts
npm run check:release
npm run clean:local
```

Use `npm run check:app` for website/app-only edits. Use `npm run check:contracts` when smart contracts, blockchain helpers, deployments, or contract tests change.

Contract tooling note: the repo is pinned to Node 22 LTS with `.nvmrc` and `.node-version`. Use Node 22 for production blockchain work.

## Current Cleanup Decision

Do not mass-delete untracked files. The repo has many active untracked production files from recent sprints. Clean by grouping, verifying, then staging intentionally.
