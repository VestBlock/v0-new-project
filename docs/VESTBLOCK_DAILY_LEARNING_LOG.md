# VestBlock Daily Learning Log

This is the short memory file for the daily Growth + Product Optimization Loop. Each run should record what changed, what failed, and what tomorrow should do differently.

## 2026-05-13 Baseline

### Business Readiness Grade

B-

VestBlock has a stronger public product stack than the outreach numbers currently show: DealVault, AI Receptionist, Search Visibility, and Funding Prep are coherent revenue offers. The main gap is not the website existing; it is proving and distributing the offers consistently enough to create qualified conversations.

### Website Checked

- Primary public routes to monitor daily: `/`, `/services`, `/pricing`, `/dealvault`, `/dealvault/demo`, `/smart-contracts`, `/visibility-expansion`, `/ai-assistant`, `/funding`, `/get-started`.
- Current quality focus: make each page answer what it is, who it helps, what problem it solves, and what action to take.
- Do not keep re-auditing admin/dashboard pages for public copy unless a public visitor can see the text.

### SEO/AEO Visibility Status

- `npm run visibility:aeo-scorecard` passed at `10/10`.
- Search Console and IndexNow automation are now part of the visibility stack.
- Sitemap, robots, LLM feed, proof assets, comparison/best-for topics, prompt tests, and indexing push are present.
- What this means: crawler/indexing infrastructure is in place.
- What this does not mean: ChatGPT or Google rankings are guaranteed or instant.

### Outreach Status

- `npm run outreach:scorecard` shows the system is under the 100/day target.
- Daily target: `100`.
- Sent in last 24h: `23`.
- Gap: `77`.
- Production send-ready messages: `0`.
- Fresh production-eligible email leads: `0`.
- Production eligible already sent: `100`.
- Excluded by production rules: `803`.
- Bottleneck: `qualified_pool_exhausted`.

### What We Learned

- The current outreach problem is qualified lead supply, not willingness to send.
- Lowering guardrails would create spam risk instead of revenue.
- The daily loop should force source-quality fixes, enrichment fixes, and proof-backed messaging before volume.
- Visibility infrastructure is strong enough to keep compounding if proof pages, screenshots, comparisons, and off-site mentions keep shipping.

### What Not To Repeat

- Do not chase 100/day by emailing excluded, no-email, bad-fit, or contact-form-only leads.
- Do not assume Search Console indexing equals ranking.
- Do not rerun a full repo audit when the fast context files already identify the right starting points.
- Do not make broad redesigns when the daily task is conversion or proof placement.

### Tomorrow's Best Fix

Grow the qualified outreach pool: run lead/source audit, identify the highest email-yield source, improve enrichment, generate safe V2 drafts, and only then attempt a controlled send.

## 2026-05-14 Daily Loop

### Business Readiness Grade

B-

No major product regression detected today. Visibility/indexing automation is still healthy. The main operational risk remains outreach volume being constrained by qualified lead supply (unable to verify today due to network limits in this run).

### Website Checked

- Checked copy/CTAs on `/`, `/services`, `/pricing`, `/dealvault`, `/smart-contracts`, `/visibility-expansion`, `/ai-assistant`, `/get-started`.
- Small homepage trust/visibility copy tightened in the metrics section to keep language more buyer-facing.

### SEO/AEO Visibility Status

- `npm run visibility:aeo-scorecard` passed at `10/10` (score `100/100`).
- `npm run visibility:indexing-dry-run` succeeded with no blockers (dry-run only; no submissions performed).

### Outreach Status

- `npm run outreach:scorecard` failed in this environment with `TypeError: fetch failed` (Supabase unreachable due to restricted outbound network access).
- Last known bottleneck (from baseline 2026-05-13): `qualified_pool_exhausted`.

### What We Learned

- The visibility system can be verified locally via scorecards even when indexing submissions are guarded.
- Outreach scorecard currently requires Supabase network access; daily runs in restricted environments need either an offline mode or a “run where network is allowed” handoff.

### Tomorrow's Best Fix

Run `npm run outreach:scorecard` in an environment with outbound network access to Supabase, then address the exact lead-supply bottleneck (source yield + email verification) before attempting higher send volume.

## 2026-05-18 Daily Loop

### Business Readiness Grade

B

### Website Checked

- Reviewed core public revenue routes listed in `docs/CODEX_FAST_CONTEXT.md`, focusing on CTA clarity, proof placement, and obvious trust/mobile friction.
- Fixed a broken CTA jump: multiple pages linked to `/dealvault/demo#dealvault-demo`, but the destination anchor did not exist.

### SEO/AEO Visibility Status

- `npm run visibility:aeo-scorecard` passed at `10/10` (score `100/100`).
- `npm run visibility:indexing-dry-run` succeeded; no env/config blockers surfaced in dry-run mode.

### Outreach Status (V4 Only)

- `npm run outreach:v4-dry-run` produced `29` draft-ready messages for `2026-05-18` (target `50`, gap `21`).
- `npm run outreach:v4-approve -- --date=2026-05-18 --limit=50` approved `29/29` and rejected `0`.
- Bottleneck remains `quality_gate_blocks_or_missing_verified_email` (not enough safe, email-verified leads per day yet).
- Reliability fix: V4 workflow no longer hard-fails the entire run on provider timeouts; it records failures and proceeds to approvals when possible.

### What We Learned

- The V4 approval gate can be the bottleneck if real-source provenance is not carried through the artifacts consistently; keeping provenance detectable prevents “false rejection” cascades.
- Provider timeouts are expected; treating them as partial failures (not fatal) keeps daily output usable.

### Tomorrow's Best Fix

Run `npm run outreach:v4-workflow` and validate `approved >= 50` without changing guardrails; if still below target, expand real-source coverage to additional verticals (Search Visibility + DealVault) before attempting any live sending.

## 2026-05-20 Daily Loop

### Business Readiness Grade

B-

### Scorecards Run (Safe)

- `npm run visibility:aeo-scorecard`: `10/10` (score `100/100`)
- `npm run visibility:indexing-dry-run`: ok (dry-run only; no pushes performed)
- `npm run revenue:command`: grade `B-` (no revenue/reply signals yet; outreach supply looks healthy)

### Outreach Status (V4 Only)

- V4 artifacts reviewed (no workflow re-run; no legacy scripts).
- Approved drafts: `56` total (`26` + `30`) from `artifacts/outreach-v4/2026-05-20-*`
- Sent: `50` via `artifacts/outreach-v4/2026-05-20-realestate-partnership-50/send-results.json`
- Skips: `0` (send run)
- Failures: `0` (send run)
- Bottleneck (dry-run scorecard): `quality_gate_blocks_or_missing_verified_email` (ready-to-send `44`, gap `6`)
- Notable source risk: repeated `outscraper_http_402` events in the dry-run summary (provider credit/billing issue blocks some market pulls).

### Website Issues Found / Fixed (Small + Safe)

- Removed internal wording from public conversion copy:
  - Services page: “rollout path” → “next step”
  - Real estate funding: “Borrowing Entity / Vesting Name” → “Borrower Name (LLC or personal)”

### What We Learned

- Outreach throughput is no longer the approval gate; send-ready volume is. Missing/verified email coverage and provider availability are the limiting factors.
- Outscraper billing/credits can silently crater market coverage; the daily scorecard will still look “ok” even while a provider lane is impaired.

### Tomorrow's Best Fix

Fix the Outscraper `402` blocker (credits/billing) or bias V4 sourcing to `google_places` until that lane is healthy, then push dry-run `readyToSend >= 50` (gap `0`) without relaxing guardrails.

## 2026-05-21 Daily Loop

### Business Readiness Grade

B-

### Scorecards Run (Safe)

- `npm run visibility:aeo-scorecard`: `10/10` (score `100/100`)
- `npm run visibility:indexing-dry-run`: ok (dry-run only; no pushes performed)
- `npm run revenue:command`: grade `B-` (V4 `sendReady=5`, `freshProductionEligibleEmailLeads=270`, `replySignals7d=0`)

### Outreach Status (V4 Only)

- V4 artifacts reviewed (no workflow re-run; no legacy scripts).
- Approved drafts: `5` (`artifacts/outreach-v4/2026-05-21/approved-drafts.json`)
- Sent: `0` (no `send-results.json` present for `2026-05-21` yet)
- Skips: n/a (no send run)
- Failures: n/a (no send run)
- Bottleneck (scorecard): `quality_gate_blocks_or_missing_verified_email` (ready-to-send `5`, gap `45`)
- Notable signal: most accepted leads came from `dry_run_vertical_scraper` (64/78), which does not produce send-ready emails; real-provider volume is too small for a 50/day send goal.

### Website Issues Found / Fixed (Small + Safe)

- Proof hub keyword tightened to buyer language: “AI search readiness” → “AI search visibility”

### What We Learned

- Today’s outreach gap is not approval; it’s a lack of real-provider, email-verified volume (only `5` send-ready in the dry run).
- The daily workflow is still dominated by dry-run vertical scrapers; it should be treated as a coverage/adapter maturity gap, not a reason to relax guardrails.

### Tomorrow's Best Fix

Increase real-provider volume and verified-email yield for the real-estate lanes (real estate partners + contractors) until the V4 scorecard shows `readyToSend >= 50` without lowering compliance rules, then run the sender automation with `--limit=50`.

## 2026-05-25 Daily Loop

### Business Readiness Grade

B-

### Scorecards Run (Safe)

- `npm run visibility:aeo-scorecard`: `10/10` (score `100/100`)
- `npm run visibility:indexing-dry-run`: ok (dry-run only; no pushes performed)
- `npm run revenue:command`: grade `B-` (V4 `sendReady=122`, `freshProductionEligibleEmailLeads=270`, `replySignals7d=0`, `leadEmails24h=0`)

### Outreach Status (V4 Only)

- Current-date artifacts missing: `artifacts/outreach-v4/2026-05-25/` not found (sender automation has not produced today’s run output yet).
- Last available V4 run dir: `artifacts/outreach-v4/2026-05-21/`
  - Approved drafts: `0` (no `approved-drafts.json` present)
  - Sent: `0` (no `send-results.json` present)
  - Accepted: `51` (`accepted-leads.csv`)
  - Quarantined: `580` (`quarantine.csv`)
  - Sent ledger (last 24h): `0` (`artifacts/outreach-v4/sent-ledger.jsonl`)
- Bottleneck: sender automation not run for `2026-05-25` + no approved-drafts artifact in the latest available run dir, so daily send/approval throughput cannot be reported from V4 artifacts.

### Website Issues Found / Fixed (Small + Safe)

- Learn page CTA copy: “Request A Visibility Review” → “Request a visibility review”

### What We Learned

- The safe scorecards show visibility posture is stable (AEO `100/100`), and outreach supply exists (`sendReady=122`) but daily operations are blocked by missing current-date V4 sender artifacts and absent approval output in the latest run dir.

### Tomorrow's Best Fix

Run the Outreach V4 Daily Sender automation to generate `artifacts/outreach-v4/2026-05-25/` (and ensure it writes `approved-drafts.json` / `send-results.json` when applicable), then send `50` from the existing `sendReady` pool without changing guardrails.
