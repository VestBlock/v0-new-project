# VestBlock Rebrand Baseline

Recorded on 2026-08-10 before Operation Rebrand implementation.

## Execution environment

- Authoritative machine: MacBook Pro (`MacBookPro18,1`), Apple M1 Pro, 10 CPU cores, 16 GB memory.
- Repository: `/Users/mrsanders/VestBlock Codex Sync/Codex Folder`
- Branch: `codex/operation-rebrand-final`
- Starting commit: `ea40945357a5ff0a10ee4165ee5b4dc738669b12`
- Framework: Next.js 15.5.18, React 19.2.5, TypeScript 5, Tailwind CSS 3.4.
- The starting worktree already contained extensive tracked and untracked work. Those changes are owner work and are preserved. This operation must not reset, stash, or overwrite unrelated files.

## Safety rules

1. Existing public URLs, database tables, API contracts, environment-variable names, auth/RLS policies, payment paths, and production configuration remain stable unless a documented migration is required.
2. No production deployment is authorized by this branch. Build, tests, screenshots, and PR-ready changes are allowed; production remains a human approval gate.
3. No database reset, destructive migration, blind `.env` edit, mainnet contract deployment, or live outreach/send command may be run as part of the rebrand.
4. Preserve the dirty starting worktree. Before changing an already modified file, inspect and retain its current behavior.
5. Implement incrementally and re-run the proportional checks after each major phase.

## Route and system baseline

- Page files: 103
- Public/non-admin page files: 68
- Admin page files: 35
- Dashboard page files: 9
- API route handlers: 186
- All route handlers, including non-API handlers: 188
- Production build generated 244 static pages, including 106+ learning pages and multiple market/service pages.
- The app includes auth, payments, PostHog and Google Ads analytics, Supabase/Postgres, OpenAI, Resend, PayPal, DealVault contracts, lead/outreach automation, cron jobs, Inngest, property intelligence, buyer/lender networks, funding, credit, grants, SEO/AEO, and admin command systems.

The detailed classification is in `docs/VESTBLOCK_PRODUCT_INVENTORY.md`.

## Build and test baseline

| Check | Result | Notes |
| --- | --- | --- |
| `npm run typecheck` | Pass | No TypeScript errors. |
| `npm run lint` | Pass with warnings | 89 warnings, 0 errors. Major categories are effect-state patterns, unused values, hook dependencies, JSX in `try`, and image optimization. |
| `npm run build` | Pass | Compiled in 49 s on the MacBook Pro. Build itself skips type and lint validation, so both were run separately. |
| `npm run test:smoke` | Pass | 5/5: public pages, guest auth gates, health, and protected APIs. |
| Deal analyzer math | Pass | `deal-analyzer-math: ok`. |
| Property opportunity analysis | Pass | `property-opportunity-analysis: ok`; standalone test reports OpenAI disabled because the script does not load `.env.local`. |
| Command center ops | Pass | `command-center-ops: ok`. |
| Operating architecture | Pass | `operating-architecture: ok`. |
| Operating loops | Pass | `operating-loops: ok`. |
| Command center autopilot | Pass | `command-center-autopilot: ok`. |
| Source cost governor | Pass | `source-cost-governor: ok`. |
| Smart contracts | Pass | 4/4 Hardhat tests: DealVaultRealEstate, MilestoneVault, PartnerPay, ProofVault. |
| Deal memory | Existing failure | Fixture expected `965 North Ave, Macon, GA`; existing memory returned `Milwaukee 10-Unit Duplex Portfolio (5 duplexes)`. Treat as data-isolation/fixture debt, not a rebrand regression. |

## Homepage performance baseline

Lighthouse was run against the MacBook Pro production server at `http://127.0.0.1:3210`.

| Measure | Baseline |
| --- | ---: |
| Performance | 38 |
| Accessibility | 100 |
| Best practices | 96 |
| SEO | 100 |
| First Contentful Paint | 1.1 s |
| Largest Contentful Paint | 19.9 s |
| Total Blocking Time | 4,460 ms |
| Cumulative Layout Shift | 0 |
| Speed Index | 6.9 s |
| Homepage route JS | 201 kB |
| Homepage first-load JS | 350 kB |

Artifacts:

- `output/playwright/rebrand-baseline/pro-home-desktop.png`
- `output/playwright/rebrand-baseline/pro-home-mobile.png`
- `output/playwright/rebrand-baseline/lighthouse-pro-home.json`

## Visual and conversion findings

- The current brand reads as a real-estate partner network, not the broader capital + deals + opportunity platform.
- The homepage stacks video, GSAP, Framer Motion, Lenis, and several Three.js experiences. The result is cinematic in places but expensive and fragmented.
- Full-page captures expose very long blank or near-blank animated regions because essential content depends on scroll/in-view animation state.
- Mobile hero text is clipped in the baseline capture, and the long empty sections are more severe on a narrow viewport.
- The top navigation exposes seven peer destinations before account actions. It mirrors the accumulated product catalog instead of routing a first-time visitor.
- Cyan, blue, violet, amber, gradients, glass, glows, pill labels, rounded cards, and repeated centered sections compete for attention.
- The current hero has three CTAs but no single primary decision and does not present the required three strategic doors.
- Legitimate accessibility and SEO foundations are strong and must be preserved.

## Baseline decision

Preserve the platform engines and URLs. Replace the homepage and primary navigation architecture, consolidate visual tokens, create three clear doorway pages, and limit the heavy homepage rendering to one progressively enhanced opportunity-network scene. Existing secondary systems remain reachable through their correct doorway, dashboards, direct routes, SEO pages, or admin surfaces.
