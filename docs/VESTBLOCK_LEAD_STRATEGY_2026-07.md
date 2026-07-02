# VestBlock Lead Strategy — July 2026

Last updated: 2026-07-02

## The one number that reframes everything

The campaign ledger shows 3,848 tracked email sends. 3,406 of them (88%) went to `dealmachine-seller-options` and `on-market-lowball` — the two lanes now paused by policy. The twelve high-intent stacked lanes (tax-code-stack, portfolio-landlord, probate-vacant-equity, etc.) have only ~440 combined sends, spread so thin that no lane has a statistically meaningful test.

Conclusion: VestBlock does not have a "cold email doesn't work" problem yet. It has a "the good strategy was never given the volume" problem. Before adding new tools or channels, run the existing priority rotation at real volume with reply logging on.

## DealMachine API: verdict (already researched, stands)

`docs/DEALMACHINE_API_STRATEGY_2026-06-08.md` settled this: the public API only adds/updates leads — it cannot build lists or export contacts. The website-token scripts (`dealmachine-export-*`, `dealmachine-market-harvest`, etc.) are the correct architecture. Do not rebuild an API integration; it would be automation theater. The two legitimate API uses if ever needed: pushing VestBlock-sourced leads INTO DealMachine for driving-for-dollars/mail, and tagging lead status. Neither is a lead source.

## Channel strategy (ranked by expected reply rate per hour of operator time)

1. **Second-touch reactivation (new, live now)** — `npm run outreach:reactivation-queue`. 437 eligible contacts already paid for, one touch, no reply, not suppressed. A polite follow-up to a cold list reliably outperforms a first touch to a fresh list. Zero acquisition cost.
2. **Agent-facing email (stale listings)** — the one lane where email is the native channel of the recipient. Agents live in their inbox; homeowners don't. `stale-listing-creative-finance` staged 30 in the reactivation queue; keep this lane fed weekly.
3. **High-intent stacked lanes at real volume** — run the 12-lane priority rotation at 30/lane with fresh DealMachine Contacts exports until each lane has 100+ sends and logged replies. Only then rank lanes.
4. **DealMachine native direct mail** — for the highest-equity, no-email records (the leads currently exported as "no email"). Mail is the proven channel for distressed owners and DealMachine already prints/sends it. Start with one 100-piece test on tax-code-stack records.
5. **SMS via the existing DNC-scrubbed queue** — `build-dealmachine-sms-queue.mjs` exists. Keep volume small, review-first, and only on wireless-scrubbed exports. TCPA risk means this stays a manual review lane, never automated sending.
6. **Buyer-first reverse wholesaling** — flip the funnel: confirmed buyer/builder buy boxes (Buyer Demand Loop) define the sourcing filters, so every seller conversation already has a disposition path. The command center already tracks `partnerBuyBoxesConfirmed`; make it the sourcing input, not a side metric.

## What NOT to spend on next

- New paid lead sources (Outscraper/Apify expansion) before the reply loop proves which existing lane converts.
- Any auto-sending automation. Review-first is the moat — deliverability and compliance survive because a human gates every batch.
- API integrations that duplicate the working website-export path.

## Weekly operating rhythm

1. Monday: `outreach:reactivation-queue` → review → send strongest 60.
2. Tue-Thu: fresh exports for 2-3 priority-rotation lanes → stage 30/lane → send.
3. Every reply, same day: `outreach:log-reply`.
4. Friday: `outreach:learning-audit` → promote the lane with replies, pause the lane with opt-outs, write one line in the daily learning log.

## Gate before scaling past ~60/day

Email verification (ZeroBounce/NeverBounce-class) on every outbound batch. This was already flagged in CODEX_FAST_CONTEXT as the missing scale layer; it stays the hard gate.
