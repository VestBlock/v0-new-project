# VestBlock Credit Boost Stack

Last updated: 2026-04-30

## Purpose

This stack is for users who need more positive reporting, better credit mix, and cleaner payment-history momentum before they chase broader funding or premium-card approvals.

## Core logic

- Add positive reporting carefully, not chaotically.
- Use autopay from day one.
- Protect utilization while the new accounts season.
- Verify reporting after the first statement cycle.
- Reassess before opening more accounts.

## Primary stack

1. Self Credit Builder Account
   - Installment-style builder for payment history and credit mix.
   - Best for thin files and rebuilders.

2. Kikoff Credit Account
   - Controlled revolving-builder option.
   - Best for users who need a safer revolving tradeline.

3. Boom Rent Reporting
   - Optional for renters when payment verification is actually available.
   - Useful for thin files without mortgage-style history.

4. TomoCredit
   - Alternative-underwriting card path.
   - Best for users blocked by stricter FICO-first issuers.

## 90-day sequence

- Week 0-1: activate only the right builders and turn on autopay
- Week 2-4: let first statements cut and confirm reporting starts
- Week 5-8: keep utilization low and avoid redundant new applications
- Week 9-12: reassess score, disputes, utilization, and next approval readiness

## Risk controls

- Do not open multiple similar builder products just because approval is easier.
- Do not carry high statement balances while trying to improve scores.
- Do not rely on rent reporting until verification is confirmed.
- Do not promise score jumps or approvals.

## Product wiring in VestBlock

- `lib/credit/recommendation-engine.ts`
  - builds deterministic boost-pack, card, side-hustle, and roadmap enrichment
- `app/api/job-status/[jobId]/route.ts`
  - enriches completed AI analysis with boost-pack logic before saving results
- `components/credit-boost-pack.tsx`
  - renders the user-facing boost-pack workflow in analysis results
- `components/analysis-result-client-view.tsx`
  - now shows a dedicated `Boost Pack` tab and always renders card/side-hustle guidance

## Compliance posture

- Educational and organizational only
- No guaranteed score improvement claims
- No guaranteed approvals
- No advice to misstate information
