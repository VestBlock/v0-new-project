# VestBlock Growth Backlog

This backlog is for compounding business improvements found by the daily Growth + Product Optimization Loop. Keep it strict: only add work that can improve revenue, trust, visibility, or operational reliability.

## Priority 1: Revenue Conversations

- Expand qualified outreach supply for AI Receptionist, DealVault, Search Visibility, and Funding Prep without weakening safety rules.
- Add email verification before attempting sustained 100/day outreach volume.
- Resolve `outscraper_http_402` (credits/billing) or temporarily bias sourcing to `google_places` so market coverage does not silently collapse.
- Increase V4 real-provider volume for the real-estate lanes (partners + contractors) so daily runs are not dominated by `dry_run_vertical_scraper` acceptance counts that can’t convert into sends.
- Restore trustworthy reply monitoring through Gmail re-authentication or a Google OAuth token with Gmail read-only scope.
- Improve admin review speed by surfacing the best 25 candidates with reason, offer fit, email quality, and next action.
- Close the V4 daily gap to 50 approved drafts by scaling market rotation + enrichment (do not lower compliance guardrails).

## Priority 2: Proof And Sales Assets

- Capture fresh screenshots for DealVault demo, proof certificate, milestone tracking, and payout split examples.
- Add a simple proof packet for AI Receptionist: missed call, intake capture, booking/follow-up, and owner notification.
- Add a simple proof packet for Search Visibility: page created, indexed, prompt target, proof hub, off-site listing status.
- Create one short buyer-facing social post per core offer each week.

## Priority 3: SEO/AEO Compounding

- Keep Search Console and IndexNow push running after important content changes.
- Add comparison pages only when they answer a real buyer question.
- Keep `/llms.txt`, sitemap, proof hub, and service pages aligned.
- Track prompt tests weekly and create pages for missing buyer questions.

## Priority 4: Website Conversion

- Keep the homepage focused on three core paths: DealVault, AI Receptionist, and Search Visibility.
- Place proof before pricing and contact forms.
- Remove internal wording when found: system, workflow, infrastructure, operator, signal, readiness, entity, AEO, pilot, MVP.
- Make CTAs consistent: request demo, get visibility plan, see DealVault demo, talk through funding prep.

## Priority 5: Technical Reliability

- Keep daily checks targeted: scorecards first, typecheck/build only after code changes.
- Update `docs/CODEX_FAST_CONTEXT.md` when system behavior changes.
- Do not run live sends, paid blockchain transactions, or charges without explicit approval.
- Make Outreach V4 Daily Sender always write `artifacts/outreach-v4/YYYY-MM-DD/` with `approved-drafts.json` + `send-results.json` (or a structured “no-op” status) so the daily loop can report sent/approved/skips/failures without guesswork.
- Make `npm run outreach:scorecard` support an offline/fixture mode for restricted environments (or document the required networked runner) so the daily loop can always produce a scorecard.
