# VestBlock Strategy Lab

Last updated: 2026-07-02

## What this is

A standing weekly loop where Claude (Rob's AI cofounder, embedded via the Cowork scheduled task
`vestblock-strategy-lab`) studies the machine's own data and proposes exactly ONE new strategy
experiment. Proposals are appended below; Rob approves, and the approved ones get built.

The lab exists so strategy generation compounds like the rest of the system: every week the
proposal is informed by another week of ledger data, replies, offer outcomes, and lane results.

## Rules

1. One proposal per week, never more. Focus beats volume.
2. Every proposal must be grounded in a number from the machine's own data (ledger, reply log,
   learning audit, offer outcomes, lane-fill state, buy-box inventory) — cited in the proposal.
3. Every proposal names: the asset it leverages, the segment, the copy angle, the implementation
   sketch, the success metric, and the kill criterion (when to stop the experiment).
4. Proposals must obey the standing guardrails: review-first sending, verified emails only,
   caps, suppression discipline, no invented claims, no fake automation.
5. The lab NEVER sends, deploys, or modifies code. It writes proposals. Humans decide.
6. Rejected proposals stay in the log with the reason — negative knowledge is knowledge.

## Active lane portfolio (context for proposals)

Core rotation: 12 distress strategies × 12 markets (see strategy-rotation-plan).
Differentiated lanes: Demand-Match (live), Listing Post-Mortem / Transparent Underwriting (live),
Backup-Offer Registry (live at /backup-offer), Reactivation second-touch (live),
Direct mail for no-email owners (live), Proof-Backed Credibility (gated until real closes).

## Proposal log

<!-- The weekly lab run appends proposals below this line. Format:
## YYYY-MM-DD — <proposal name>  [PROPOSED | APPROVED | REJECTED: reason | KILLED: result]
-->

## 2026-07-05 — Inbox Reply Audit: First-Signal Recovery  [PROPOSED]

**Motivating data point:** The learning audit (2026-07-05) shows 3,848 tracked sends and **0 attributed replies** across all lanes, all-time. The reply-log.jsonl file does not exist. The audit explicitly flags: *"Either nobody replied (source/copy problem) or replies are not being logged — run outreach:log-reply on every inbox reply before drawing conclusions."* Morning brief confirms the same: "Zero replies logged all-time." Every lane-level decision right now is made with zero signal.

**VestBlock asset leveraged:** The `outreach:log-reply` command already exists and is ready to use. No build required. The sending inboxes (used for the June 13 – July 5 campaigns) already hold whatever replies arrived.

**Target segment:** Internal ops — the sending inbox(es), not a new owner segment.

**Copy angle:** N/A. This is an attribution recovery experiment, not a new send.

**Implementation sketch:**
1. Open each sending account used across all campaigns (seller-options, DealMachine seller-options, on-market sweep, small multifamily, stale-listing, portfolio-landlord, builder-infill, novation, tax-remote, tax-code-stack).
2. Search for any replies from the ~3,848 contacts sent since June 13.
3. For each reply found, run: `npm run outreach:log-reply` with the reply's sender email and the originating lane.
4. Re-run `npm run outreach:learning-audit` immediately after. The morning brief will now show real reply rates per lane.
5. Establish standing habit: check inbox and log any replies before each new send day.

Reuses existing scripts only — zero new code.

**Success metric:** At least 1 reply attributed and visible in the next learning audit within 7 days. Lane reply rates appear in morning brief instead of zero across the board.

**Kill criterion:** If the inbox audit confirms no replies were ever received (not just un-logged), the bottleneck shifts to copy/source. Next proposal then: a subject-line A/B test on the highest-volume lane (seller-options, 1,885 sends) to generate measurable open/reply differentiation before scaling further.
