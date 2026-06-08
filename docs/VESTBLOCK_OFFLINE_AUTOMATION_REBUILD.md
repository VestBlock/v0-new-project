# VestBlock Offline Automation Rebuild

Last updated: 2026-05-27

## Principle

VestBlock automation now runs as offline operator work, not website cron behavior.

No offline automation should add website cron routes, publish externally, send live email, charge customers, post to social media, or claim results without explicit approval in the active thread.

## Quality Bar

Outreach must optimize for buyer/partner replies like the Brad O'Neal thread:

- real buyer, lender, seller-side partner, contractor, or operator fit
- specific market, buy box, lending criteria, service area, or referral lane
- direct evidence from website, public listing, or reply context
- usable email with syntax, blocked-pattern, blocked-role, duplicate, ledger, and MX/domain checks
- role inboxes and scraped generic emails are review-only unless a human approves them
- no live send until a preview packet is reviewed

## Offline Jobs

- `VestBlock Daily Offline Outreach Orchestrator`: runs the daily expansion loop from real sources, not user-uploaded CSVs: small-business discovery, Latino funding discovery, V4 real-source scrape/enrichment, V4 approval, V4 send preview, and optional Kimi buyer augmentation only when CSVs already exist.
- `VestBlock Offline Buyer Lead Builder`: finds Brad-like real estate buyer, lender, and contractor partner leads; produces vetted artifacts and drafts only.
- `VestBlock Offline Small Business Lead Builder`: finds AI Receptionist and funding-prep small-business leads from real map listings, business websites, contact pages, and domain/email enrichment; produces vetted artifacts only.
- `VestBlock Offline Latino Funding Lead Builder`: separately finds Latino/Hispanic-owned or Spanish-speaking small-business leads for Spanish funding-prep outreach; produces vetted artifacts only.
- `VestBlock Offline Email Quality Guard`: processes bounces, updates suppression, and reports bad-domain patterns before any future send decision.
- `VestBlock Offline Outreach Draft Desk`: reviews vetted lead artifacts and prepares personal first-touch/follow-up drafts; does not send.
- `VestBlock Controlled Daily Outreach Sender`: sends up to the daily cap only after V4 workflow, approval, send preview, duplicate ledger, role-local, same-domain, opt-out, mailing-address, and provider checks pass.
- `VestBlock Offline SEO AEO Authority Builder`: improves owned SEO/AEO assets and proof packets offline; includes Brad-style buyer criteria work from `docs/VESTBLOCK_BRAD_BUYBOX_SEO_AEO.md`; no external posting.
- `VestBlock Offline PR Partnership Scout`: researches credible partner/PR opportunities and prepares pitch packets; no sending.
- `VestBlock Offline Grants Funding Scout`: finds grants/funding opportunities and prepares application notes; no applications or submissions.

## Send Rule

Live sends stay disabled by default. The safe path is:

1. Build lead artifact.
2. Verify email quality and domain deliverability.
3. Generate drafts.
4. Preview drafts.
5. Human approval in-thread.
6. Only then run a controlled send command with the daily ledger cap active.

## Small Business Lead Builder

Daily orchestrator command:

```bash
npm run outreach:daily-expand -- --target=75 --market-count=8
```

This is the default daily growth path. It does not depend on Kimi CSV uploads. Kimi buyer CSVs are treated as optional augmentation, not the primary lead source.

Command:

```bash
npm run leads:small-business -- --markets="Milwaukee, WI|Chicago, IL|Indianapolis, IN|Columbus, OH" --verticals=ai_receptionist,funding_prep --queries-per-vertical=4 --per-query=3 --website-limit=40
```

Market behavior:

- If no `--markets` list is passed, the builder rotates across the default market pool instead of always using the first cities.
- If an explicit `--markets` list is passed, the builder now uses the whole list by default. Pass `--market-count=<n>` only when intentionally limiting the run.
- Market selections are recorded in `artifacts/offline-automation/small-business-leads/market-history.json` and each run's `summary.json` under `marketRotation`.
- This fix prevents repeated Milwaukee/Chicago/Indianapolis/Columbus-only runs and makes Latino funding runs use the full configured list unless intentionally capped.

Outputs:

- `artifacts/offline-automation/small-business-leads/<date>/direct-email-ready.csv`
- `artifacts/offline-automation/small-business-leads/<date>/role-email-review.csv`
- `artifacts/offline-automation/small-business-leads/<date>/contact-form-only.csv`
- `artifacts/offline-automation/small-business-leads/<date>/summary.json`

Direct-ready means the lead has a usable non-role email on the business website domain with a valid MX domain check. Role inboxes, off-domain lead-router emails, and contact-form-only businesses are separated for manual review.

## Controlled Daily Sender

Live sending is allowed only through the V4 send-control path:

```bash
npm run outreach:v4-workflow -- --target=75
npm run outreach:v4-send-approved -- --limit=50 --daily-cap=50
npm run outreach:v4-send-approved:live -- --limit=50 --daily-cap=50
```

The sender must skip:

- role or operational inboxes such as `info@`, `sales@`, `support@`, `frontdesk@`, `website@`, `billing@`, `employment@`, `projects@`, `dispatch@`, `operations@`, `estimates@`, and similar
- placeholder addresses such as `email@address.com`, `filler@godaddy.com`, or example domains
- off-domain business emails that do not match the lead website domain, except common small-business mailbox domains such as Gmail
- duplicate recipients already in the V4 sent ledger
- domains that exceed the per-domain cap
- manual-only verticals

Funding-prep, Latino funding, Spanish funding, and distressed-house outreach are not auto-send lanes until their compliance copy and lead-quality rules are explicitly approved.

## Latino Funding Lead Builder

Command:

```bash
npm run leads:latino-funding -- --date=<date-label>
```

Default configured markets:

- Chicago, IL
- Milwaukee, WI
- Houston, TX
- Dallas, TX
- Phoenix, AZ
- Los Angeles, CA
- San Antonio, TX
- Miami, FL

Outputs use the same artifact shape under:

- `artifacts/offline-automation/latino-funding/<date-label>/direct-email-ready.csv`
- `artifacts/offline-automation/latino-funding/<date-label>/role-email-review.csv`
- `artifacts/offline-automation/latino-funding/<date-label>/contact-form-only.csv`

This lane must stay separate from the general funding list so Spanish-language outreach can be reviewed for tone, compliance, and actual Latino/Hispanic ownership or Spanish-speaking signals before any draft is approved.
