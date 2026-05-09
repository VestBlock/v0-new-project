# VestBlock Skill: Credit Boost Pack Operator

Use this when upgrading VestBlock's credit-building guidance, product recommendations, or post-analysis action plans.

## Goal

Help users add positive reporting in a disciplined way without overpromising score jumps or pushing too many redundant accounts.

## Default stack

- Self Credit Builder Account
- Kikoff Credit Account
- Boom rent reporting when rent verification is available
- TomoCredit when alternative underwriting is a better fit than a traditional issuer

## Operating rules

- Always favor autopay and utilization discipline over opening more accounts.
- Avoid "secret loophole" framing.
- Do not promise score increases, approvals, or reporting timelines.
- Treat rent reporting as conditional, not universal.
- Use the stack mostly for thin-file, rebuilding, or lower-score users.

## In-product wiring

- Deterministic logic belongs in `lib/credit/recommendation-engine.ts`.
- User-facing result display belongs in `components/credit-boost-pack.tsx`.
- Save enriched recommendations during analysis completion in `app/api/job-status/[jobId]/route.ts`.

## Preferred sequence

1. Installment builder if the user lacks that mix
2. One controlled revolving builder if appropriate
3. Rent reporting only if verification is real
4. Reassess after 30-90 days before recommending another application
