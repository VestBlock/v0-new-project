# VestBlock Revenue Engine

**Branch:** `codex/revenue-engine`  
**Built on:** 2026-08-10  
**Production status:** Not deployed. Human approval is required.

## Purpose

The Revenue Engine gives VestBlock one commercial operating model across Deals, Capital, and Partners. It sits on top of the current tables and workflows, so the first release does not require a database rewrite.

It answers six questions:

1. What needs attention today?
2. What is moving money?
3. Where is each opportunity in its pipeline?
4. What ran, failed, or is stale?
5. Which agent or human owns the next action?
6. Which actions need policy or human approval?

## System shape

```text
Sources and integrations
  -> shared Contact + Asset + Opportunity + Match identities
    -> shared Activity + Scoring + Suppression + Approval rules
      -> Deals pipeline
      -> Capital pipeline
      -> Partners pipeline
        -> executive snapshot
          -> today's board
          -> money and pipeline
          -> automation registry
          -> daily brief
          -> weekly CEO review
```

## Shared contracts

| Contract | Job |
| --- | --- |
| Contact | Represents sellers, buyers, borrowers, lenders, investors, vendors, and referral partners with consent/suppression state. |
| Asset | Represents a property, business, capital request, or relationship. |
| Opportunity | Holds lane, stage, source, owner, value, score, confidence, next action, and timestamps. |
| Match | Connects an opportunity or asset to a candidate, with score, confidence, reasons, and review status. |
| Activity | Records a correlated source, score, stage, draft, approval, send, reply, suppression, match, funding, closure, or failure event. |
| Score | Produces an explainable 0–100 score, confidence, band, reasons, version, and preserved inputs. |
| Automation Registry | Records scheduler, owner, action class, risk, approval rule, disposition, status, source of truth, and rollback. |

The TypeScript contracts live in `lib/revenue-engine/types.ts`.

## Pipelines

### Deals

`discovered -> intake -> qualified -> analysis -> matched -> outreach -> engaged -> proposal -> contract -> closed`

Any non-terminal stage may move to `nurture` or `lost`. The pipeline defines stale thresholds for each active stage.

### Capital

`intake -> documents -> ready -> matched -> outreach -> engaged -> underwriting -> term_sheet -> committed -> funded`

Incomplete packages stay in `documents`; they do not become lender introductions.

### Partners

`discovered -> research -> qualified -> outreach -> engaged -> activated -> producing -> closed`

Partner criteria, replies, and production outcomes feed future matching and sourcing decisions.

Transition and staleness rules live in `lib/revenue-engine/pipeline.ts`.

## Scoring

The first scoring version uses six normalized inputs:

- fit;
- urgency;
- economics;
- readiness;
- engagement;
- data quality.

Each lane weights those inputs differently. Risk is a visible penalty, not a hidden override. Confidence comes from data quality and readiness. Low-confidence records route to review even when their raw fit looks strong.

The result includes the model version, score, confidence, band, strongest reasons, risk penalty, and original inputs. The logic lives in `lib/revenue-engine/scoring.ts`.

## Automation registry

The full audit contains 363 runnable or supporting records. The in-app control-plane registry starts with the 21 scheduler and webhook records that operators need to see first.

The registry does not trigger work. It reports:

- active, paused, blocked, and attention counts;
- Green, Yellow, and Red risk counts;
- owner, scheduler, schedule, and action class;
- approval policy;
- keep, modernize, merge, archive, or replace direction;
- source of truth and rollback.

The definitions live in `lib/revenue-engine/automationRegistry.ts`. The full evidence is in `docs/AUTOMATION_INVENTORY.json` and `docs/AUTOMATION_AUDIT.md`.

## Executive snapshot

`lib/revenue-engine/executiveSnapshot.ts` normalizes existing Command Center data into:

- attention and urgent counts;
- revenue and target progress;
- active deals and packets ready;
- Deals, Capital, and Partners lane cards;
- automation health;
- a daily operating brief;
- wins, risks, and decisions for the weekly CEO review.

The snapshot uses current Command Center values. It does not manufacture pipeline volume or financial outcomes.

## Paperclip organization

```text
Human owner / board
  -> VestBlock CEO
    -> VestBlock Revenue
      -> VestBlock Acquisitions
      -> VestBlock Capital
      -> VestBlock Growth
    -> VestBlock CTO
      -> VestBlock Frontend
      -> VestBlock Backend
      -> VestBlock QA
      -> VestBlock Reviewer
```

All ten operating agents are paused. Timer heartbeats are off. Their monthly ceilings total $100, and the current spend is $0. Paperclip project `Operation Revenue Engine` enforces isolated workspaces, a `codex/` branch prefix, pull requests, human approval before merge, and no production deployment.

## Action authority

| Risk | Default handling |
| --- | --- |
| Green | Read-only research, scoring, drafting, dedupe, internal summaries, and health checks may run with logs and bounded limits. |
| Yellow | Queueing, external email under existing consent, configuration changes, and pausing a failing worker require policy gates, a reason, an owner, and rollback. Ambiguous sends go to review. |
| Red | Payments, contracts, production deploys, bulk sends, secret changes, destructive data/schema operations, and new agents require human approval. |

## Verification

Run on the MacBook Pro:

```bash
pnpm test:revenue-engine
pnpm typecheck
pnpm exec eslint lib/revenue-engine components/admin/command-center/revenue-engine-overview.tsx scripts/test-revenue-engine.ts
pnpm build
```

The 2026-08-10 implementation passed the Revenue Engine test, TypeScript, targeted lint with no new errors, and a full Next.js production build.

## Next controlled migration

Choose one no-send family first: DealMachine discovery, export, ingestion, and dedupe. Run the shared path in shadow mode, compare results, select one scheduler owner, observe for seven days, and keep rollback ready. Do not change live outreach or payment paths in the first migration.
