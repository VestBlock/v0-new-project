# VestBlock Outreach Autopilot Operator

Use this skill for ANY daily outreach operation. It supersedes the retired cron-route loop and
the manual multi-command V4 sequence.

## Goal

Run the whole daily outreach machine with one command chain, keep every send review-gated, and
make sure replies/outcomes feed back into lane decisions.

## The daily loop (in order)

1. `npm run outreach:autopilot`
   - Phase 0 syncs Gmail replies into attribution (fails soft without gmail.readonly scope)
   - Stages Monday reactivation, verifies emails, computes the learning audit
   - Checks all 144 rotation lanes (12 strategies × 12 markets) for export freshness
   - Writes `data/operating-loops/morning-brief-latest.md` with blockers + THE ONE DECISION
2. `npm run outreach:export-pipeline`
   - Builds today's 2 empty lanes in DealMachine, requests Contacts exports, watches Gmail,
     downloads + ingests the CSVs. Rerun later with `--skip-build` if exports are slow.
3. The send — HUMAN ONLY, after reviewing the brief:
   - Reactivation batch: `npm run outreach:send-reactivation` (preview) then `:live`
   - Primary lanes: stage 30/lane in the command center, send through the guarded sender
4. Log anything the sync missed: `npm run outreach:log-reply -- --email=... --status=...`
5. After analyzer/negotiation calls: `npm run outreach:log-offer-outcome -- --address=... --outcome=...`

## Hard rules

- NEVER run a `--live` or `:live` command autonomously. Sending is the operator's decision.
- Never exceed OUTREACH_DAILY_CAP (50) or 30/lane. The 2026-05-19 overrun is why.
- Only send batches that passed `outreach:verify-emails` (send the `-verified.csv` only).
- Seller distress lanes send via Resend from acquisitions@; Instantly is for B2B partner lanes
  only; Gmail is for replies. Do not cross these.
- Do NOT recreate retired cron routes (`leads-scrape`, `send-outreach`, etc.).

## Weekly

- Monday: reactivation runs automatically inside the autopilot.
- Friday: `npm run outreach:learning-audit` review — promote reply lanes, pause opt-out lanes,
  one line in `docs/VESTBLOCK_DAILY_LEARNING_LOG.md`.
- No-email owners: `npm run outreach:direct-mail-batch` → DealMachine mail engine → `--commit`.
