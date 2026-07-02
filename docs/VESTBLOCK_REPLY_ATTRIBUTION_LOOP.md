# VestBlock Reply Attribution Loop

Last updated: 2026-07-02

## Why this exists

Every audit since May flagged the same bottleneck: sends were tracked, replies were not. `replies` was hardcoded to `0` in campaign rollups, opt-out counting silently read the suppression file with the wrong shape, and the learning audit pointed at a hardcoded scorecard date. The system could measure volume but not signal, so lane decisions (pause/scale) were narrative instead of data.

This loop closes that gap with real, observable data — no automation theater.

## The loop

1. **Send** — existing lanes (DealMachine export outreach, stale-listing sweep) write result artifacts to `tmp/outreach/`.
2. **Log the reply** — when any reply lands in the inbox, run one command:
   - Positive: `npm run outreach:log-reply -- --email=owner@x.com --status=replied --note="wants offer"`
     (statuses: `replied`, `interested`, `qualified`, `closed_won`)
   - Negative: `npm run outreach:log-reply -- --email=owner@x.com --status=opt_out --note="said unsubscribe"`
     (statuses: `opt_out`, `wrong_owner`, `bounced`)
3. **Attribution happens automatically**:
   - Positive replies update the Supabase lead status (feeds `replySignals7d` everywhere) and append to `data/operating-loops/reply-log.jsonl` (works even if Supabase is unreachable).
   - Negative replies append to `data/outreach-suppressions.json` in the production format and set the lead to `do_not_contact`.
   - `lib/admin/operatingLoops.ts` joins ledger recipients against replied emails, so `/admin/command-center` strategy lanes now show **real per-lane reply counts**, reply-aware statuses, and reply-first next moves.
4. **Learn** — `npm run outreach:learning-audit` is now fully computed: it auto-discovers the latest V4 scorecard, reads the regenerated campaign summary (with real replies/opt-outs), and derives `winning`, `pauseOrReviewOnly`, `keepTesting`, and `blockedLanes` from the data.

## Decision rules the audit now enforces

- A lane with sends and zero attributed replies is **not proven** — it is either unlogged or unproductive. Log replies before scaling.
- Lanes earn `keepTesting` only under 30 sends with zero failures/opt-outs/blocks.
- Lanes with opt-outs and no replies go to `pauseOrReviewOnly` automatically.
- Reply-producing lanes sort to the top of every rollup and get follow-up-first next moves.

## Where each piece of automation belongs

- **In-app (Next.js/command center)**: rollups, statuses, next moves, lane triage — anything the operator looks at.
- **Operator scripts (node)**: reply logging, learning audit, send scripts — actions that need human judgment or touch live email.
- **Supabase**: lead status is the single source of truth for reply state; local JSONL is the offline/fallback trail.
- **Make.com**: only justified later for inbox → `log-reply` bridging (Gmail/Outlook trigger → webhook that runs the same status update). Do not build it before the Gmail read-only scope question is settled; the manual command is 10 seconds per reply and produces identical data.
- **Manual review queue**: negative replies and wrong-owner cases — a human should always confirm suppression context.

## Files

- `scripts/log-reply.mjs` — operator CLI (`npm run outreach:log-reply`)
- `scripts/outreach-learning-audit.mjs` — computed audit (`npm run outreach:learning-audit`)
- `lib/admin/operatingLoops.ts` — per-strategy reply join + suppression-format fix
- `lib/admin/commandCenter.ts` — passes reply-positive leads into loop telemetry
- `data/operating-loops/reply-log.jsonl` — local reply trail
- `data/operating-loops/outreach-learning-audit-latest.json` — latest audit output
