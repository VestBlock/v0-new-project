# VestBlock Rebrand QA Report

Date: August 10, 2026  
Execution host: MacBook Pro (`MacBookPro18,1`, Apple M1 Pro, 10 cores, 16 GB)  
Branch: `codex/operation-rebrand-final`  
Production deployment: **not performed**

## Release decision

The rebrand candidate passes the scoped desktop, tablet, mobile, accessibility,
SEO, build, lint, type, smoke, domain, and contract checks. It is suitable for
human review on the feature branch. Production remains gated on explicit human
approval.

## Lighthouse comparison

Lighthouse was run against the production build on the MacBook Pro.

| Metric | Baseline | Final | Change |
| --- | ---: | ---: | ---: |
| Performance | 38 | 85 | +47 |
| Accessibility | 100 | 100 | Maintained |
| Best practices | 96 | 96 | Maintained |
| SEO | 100 | 100 | Maintained |
| First Contentful Paint | 1.1 s | 0.9 s | -0.2 s |
| Largest Contentful Paint | 19.9 s | 3.3 s | -16.6 s |
| Total Blocking Time | 4,460 ms | 330 ms | -4,130 ms |
| Cumulative Layout Shift | 0 | 0 | Maintained |
| Speed Index | 6.9 s | 2.1 s | -4.8 s |

The final homepage bundle is 3.84 kB of route JavaScript and 178 kB first-load
JavaScript, down from the 201 kB route and 350 kB first-load baseline.

## Browser and responsive coverage

The purpose-built rebrand suite passed 8/8 tests in Chromium and 8/8 tests in
WebKit. Coverage includes:

- Homepage headline, navigation, and the Capital, Deals, and Opportunity doors.
- The `/capital`, `/deals`, and `/opportunities` destination routes.
- DealVault live proof and demo content.
- Get Started, login, and registration labels without submitting user data.
- A 390 px mobile viewport with no horizontal overflow.
- Mobile navigation open, Escape close, and body scroll restoration.
- Reduced-motion content availability.

Screenshots and the Lighthouse JSON are in
`output/playwright/rebrand-final/`.

## Repository checks

| Check | Result |
| --- | --- |
| Production build | Passed; 247 static pages generated |
| TypeScript | Passed |
| ESLint (entire repository) | Passed; 0 errors, 0 warnings |
| Rebrand Playwright — Chromium | 8/8 passed |
| Rebrand Playwright — WebKit | 8/8 passed |
| Existing critical smoke suite | 5/5 passed |
| Deal analyzer math | Passed |
| Property opportunity analysis | Passed with OpenAI intentionally disabled |
| Command-center operations | Passed |
| Operating architecture | Passed |
| Operating loops | Passed |
| Command-center autopilot | Passed |
| Source-cost governor | Passed |
| Solidity contracts | 4/4 passed |

## Known, non-blocking environment notes

- The local browser run reports PostHog asset/config request failures because
  external analytics endpoints are not authenticated in the local environment.
  Product paths and assertions pass.
- WebKit may cancel speculative Next.js RSC prefetches because of access-control
  checks, then use the browser fallback. The tested routes still pass.
- Lighthouse completed successfully but noted that Node 22.14 is older than its
  preferred Node 22.19 runtime.
- The pre-existing `test:deal-memory` fixture is not isolated from persisted
  local data. Its known failure expects `965 North Ave, Macon, GA` but reads an
  existing `Milwaukee 10-Unit Duplex Portfolio (5 duplexes)` record. The rebrand
  does not modify that data path.
- Paperclip database backup health remains in warning state until the newly
  created local instance completes its first scheduled hourly backup.

## Human release gate

Before any production release:

1. Review the screenshots and branch diff.
2. Approve copy, visual direction, and the three-path information architecture.
3. Confirm analytics credentials and consent behavior in the target environment.
4. Run the same build and browser suites in the deployment environment.
5. Merge and deploy only after explicit human approval.
