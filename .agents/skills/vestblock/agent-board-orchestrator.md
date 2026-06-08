# VestBlock Agent Board Orchestrator

Use this skill when Rob asks to coordinate multiple agents, optimize the whole website, run a board-of-directors style review, or decide which specialist should own a VestBlock improvement.

## Goal

Coordinate specialist agents without creating chaos. The board should improve revenue, trust, speed, clarity, and operational safety while reusing existing VestBlock systems.

## Board Roles

1. Chair: `nexus-sprint-orchestrator`
   - Chooses the single biggest bottleneck and keeps the sprint small enough to verify.

2. Revenue Director: `revenue-operations-operator`
   - Checks offers, CTAs, pricing clarity, payment paths, and lead-to-sale continuity.

3. Conversion Director: `agentic-conversion-operator`
   - Checks public page flow, forms, thank-you states, and buyer next steps.

4. Design Director: `website-weakness-audit`
   - Checks hierarchy, clickability, mobile polish, trust placement, and premium feel.

5. Visibility Director: `ai-citation-growth-operator`
   - Checks SEO/AEO/GEO pages, entity clarity, llms.txt, sitemap, proof pages, and indexing.

6. Outreach Director: `signal-based-outbound-operator`
   - Checks lead quality, outreach copy, approval queues, reply handling, and 100/day readiness.

7. DealVault Director: `dealvault-revenue-operator`
   - Checks demo proof, contract language, milestones, payout records, and sales assets.

8. Funding Director: `funding-lead-automation`
   - Checks funding-prep funnel, intake, compliance-safe language, and follow-up.

9. Performance Director: `production-launch-verification`
   - Checks build, route health, bundle weight, cron load, and Vercel deploy safety.

10. Security Director: `security-privacy-audit`
   - Checks secrets, auth boundaries, private data, compliance claims, and risky routes.

## How To Run The Board

1. Read `docs/CODEX_FAST_CONTEXT.md`, `docs/CODEX_TASK_PLAYBOOK.md`, and `docs/vestblock-agent-board.json`.
2. Pick the board members needed for the task.
3. If Rob explicitly asks for agents, spawn independent explorer/worker agents with disjoint scopes.
4. Do not delegate live sends, payments, chain transactions, or secret handling.
5. Main Codex integrates, patches, verifies, and reports.

## Swarm Modes

- Read-only explorer swarm: use when several systems need investigation in parallel. Each agent gets one narrow question and edits nothing.
- Disjoint worker swarm: use only when write ownership is clear, such as one worker on docs, one on UI, one on scripts. Tell workers not to revert others.
- Board review: use when Rob asks for whole-site or whole-business optimization. Each director reviews one layer and reports the bottleneck.
- Integration owner: the main Codex thread owns final code integration, conflict resolution, verification, and truthful status.
- Banned delegated actions: live email sends, payments, blockchain transactions, secret/env handling, deleting broad folders, or production deploys.

## Default Website Layers

- Message: headline, offer hierarchy, customer language, proof, CTA.
- Design: visual hierarchy, motion, cards, clickability, mobile, accessibility.
- Funnel: forms, thank-you pages, lead routing, admin follow-up, speed to lead.
- Visibility: metadata, schema, sitemap, llms.txt, AEO pages, proof assets.
- Performance: hydration, client bundles, heavy imports, cron load, static caching.
- Trust: disclaimers, compliance-safe wording, screenshots, demos, proof records.
- Revenue: packages, pricing, payment links, admin queue, follow-up.

## Verification

- Docs only: JSON parse and no TypeScript needed.
- Code/shared routes: targeted `npx eslint <files>`, `npm run typecheck`, `npm run build`.
- Live deployment: `npx vercel@latest deploy --prod --yes`, then route 200 checks.
- Outreach: `npm run outreach:scorecard`, `npm run outreach:preflight`, and no live sends unless approved.
