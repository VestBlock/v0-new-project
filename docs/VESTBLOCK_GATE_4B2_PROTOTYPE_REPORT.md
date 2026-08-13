# VestBlock Gate 4B.2 — Isolated Experience Prototype

Date: 2026-08-12

Baseline: `797a3b6b55297d2d136914742b451e5e12810756`

Branch: `codex/operation-rebrand-final`

Status: PASS

## Scope

Gate 4B.2 produced an isolated, production-quality prototype at `/dev/gate-4b2-prototype`. It does not replace the live homepage, appear in production navigation, or enter the sitemap. In a production runtime it returns not found unless `ENABLE_GATE_4B2_PROTOTYPE=true` is explicitly set.

This gate did not deploy, alter production environment variables, activate n8n, write customer data, send outreach, or change a live workflow.

## Prototype decisions

- Navigation is limited to Capital, Real Estate, Opportunity, DealVault, Join, and Sign in.
- The hero uses one owned mobile edit across breakpoints so the Black business owner and the same AI assistant remain visually consistent.
- Localized gradients protect the reading column without uniformly dimming the scene.
- The assistant boundary is explicit: it organizes context; people and providers make decisions.
- Guidance progresses from objective to criteria to next path through visitor scroll, not arbitrary video timing.
- The hero evidence panel resolves through a continuous visual seam into the five-choice scenario selector.
- Each scenario discloses VestBlock’s role, the external decision-maker, required context, and access conditions.
- The proof section uses inspectable controls rather than invented customer counts, approval rates, or testimonials.
- DealVault remains the continuity layer for active agreements, evidence, milestones, permissions, and payout references.
- Typography uses the application’s loaded Inter family; a neutral system stack and editorial specimen remain available only inside the isolated comparison lab. Tracking and mobile metadata sizes were corrected.

## Verification

All code, build, media, and browser verification ran on the Mac Pro from an isolated worktree at the approved Gate 4B.1 baseline.

- Optimized Next.js production build: PASS (`DEoy4DEeN40dI6wjNXpX0`)
- Production-runtime Playwright suite: 9/9 PASS
- Viewports: 320, 390, 768, 1024, and 1440 CSS pixels
- Horizontal overflow: PASS at every tested viewport
- Console errors: zero at every tested viewport
- Five scenario choices and local prototype routing: PASS
- Mobile navigation, Escape close, and focus recovery: PASS
- Pause/play: PASS
- Reduced-motion still composition: PASS
- Responsive CTA, disclosure, readout, and assistant collision review: PASS after correction

Final screenshots are retained locally under ignored QA output at `output/playwright/gate-4b2-final/`.

## Review disposition

The separate design review and fresh-eyes comprehension/trust review initially identified four major issues: duplicate assistant treatments, video-timed copy not grounded in the scene, a decorative hero handoff, and invalid typography comparison. Those were corrected. Both reviews then identified one shared responsive collision at 1024 and 768 pixels; the hero spacing and evidence-panel position were corrected and the production suite rerun. The final independent design review and final fresh-eyes comprehension/trust review both returned PASS with no remaining major or critical findings.

## Locked next step

Do not deploy or replace the homepage under this gate. The required next command is:

`APPROVE GATE 4B.3`
