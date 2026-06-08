# VestBlock Outreach V2 Operating Model

VestBlock outreach is now quality-first. The goal is not 100 cold emails per day until the list quality proves it can support that safely.

## What Changed

- Daily quality target defaults to 20 emails, not 100.
- Leads must pass a V2 fit gate before send/review automation treats them as production-ready.
- Bounced, suppressed, government, nonprofit, placeholder, weak-fit, mismatched-domain, and generic webmail leads are held back.
- Restaurant and low-conversion food-service leads are not auto-sent unless a stronger signal is added later.
- Outreach copy must name the business, name VestBlock, include a soft reply CTA, include opt-out language, and avoid internal wording.

## Best-Fit Offers

- DealVault Records: agreement records, referral payouts, approvals, contractor milestones, partner/vendor records, proof trails.
- AI Receptionist: missed calls, booking requests, form follow-up, appointment-heavy service businesses.
- Search Visibility: weak website path, unclear CTA, missing trust/contact signals, local visibility gaps.
- Funding Prep: business profile cleanup, funding conversation prep, business credit/funding organization.

## Send Rules

- Use `npm run outreach:v2-audit` first.
- Only approve candidates that pass V2 and have a clear reason to care.
- Send a controlled batch.
- Check Gmail for bounces and replies.
- Suppress bad addresses immediately.
- Increase volume only after bounce rate stays low and replies appear.

## Scale Gates

- Stay near 20/day until bounce rate is below 3%.
- Move to 50/day only after repeatable replies or booked calls appear.
- Move toward 100/day only after lead source quality and follow-up handling can support it.

## Useful Commands

- `npm run outreach:v2-audit`
- `npm run outreach:v2-drafts -- --dry-run`
- `npm run outreach:v2-drafts -- --dry-run --replace-stale`
- `npm run outreach:v2-drafts`
- `npm run outreach:review`
- `npm run outreach:approve-safe`
- `npm run outreach:preflight`
- `npm run outreach:send:dry-run`
- `npm run outreach:send:small`
- `npm run outreach:scorecard`
