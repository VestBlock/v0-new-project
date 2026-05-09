# VestBlock Outreach System

Last updated: 2026-05-01

## Purpose

VestBlock outreach is designed to help operators move quickly on new leads without sending reckless or unreviewed cold outreach.

The system separates:

- draft generation
- approval
- send logging
- follow-up scheduling
- admin alerts

## Channels

The outreach engine supports:

- `email`
- `sms`
- `facebook_dm`
- `instagram_dm`
- `phone_script`

The current automated send path is email-only.

SMS, DM, and phone-script outputs are generated and stored for operators to use manually or to connect to future sending systems.

## Message Structure

Each outreach record can include:

- `subject`
- `content`
- `cta`
- `compliance_note`
- `language`
- `variant_key`
- `status`
- `send_provider`
- `send_error`
- `approved_at`
- `sent_at`
- `last_generated_at`

## Message Status Flow

Outreach messages move through these statuses:

- `draft`
- `needs_review`
- `approved`
- `queued`
- `sent`
- `failed`
- `archived`

Lead records separately track:

- `outreach_status`
  - `not_started`
  - `draft_ready`
  - `needs_review`
  - `approved`
  - `queued`
  - `sent`
  - `followup_due`
  - `failed`
  - `do_not_contact`

## Generation Rules

Outreach generation uses:

- lead source
- category
- best offer
- website weakness
- property distress
- Spanish-language signals
- urgency and contactability

It can produce:

- general B2B growth messaging
- funding-growth messaging
- website/automation audit openers
- real-estate seller / code-violation openers
- Spanish funding / support variants

## Sending Architecture

### Transactional / operator notifications

Use Resend for:

- admin alerts
- system notifications
- workflow emails
- operator digest emails

### Outbound prospect email

Use Gmail / Google Workspace when available for:

- inbox-style one-to-one outreach
- warmer sender behavior
- future reply-thread workflows

If Gmail is not configured:

- the system can still approve outreach
- Resend can be used as a fallback if desired
- logs still capture that a send was skipped or failed

## Daily Automation

The daily lead follow-up cron can:

1. pick up approved email outreach
2. send approved messages only when `AUTO_SEND_ENABLED=true` or the legacy `LEADS_AUTO_SEND_APPROVED=true`
3. log send events
4. update lead contact status
5. schedule next follow-up dates
6. create admin tasks for leads that still need manual touch

### Human approval mode

Outbound email now stays in review by default.

No scraped lead is emailed automatically unless:

- `AUTO_SEND_ENABLED=true`
- the outreach message is approved
- the lead has a valid email
- the lead is not on the suppression list
- the lead score meets the threshold
- bounce risk is below the threshold

This keeps the lead engine compliant and operator-reviewed by default.

## Compliance Rules

Outreach should:

- avoid promises and guarantees
- avoid misleading approval language
- avoid pretending to know private financial information
- preserve opt-out language for email and SMS
- stay tied to public business or property lead data

Cold outbound should not auto-send at scale until:

- sender domain reputation is ready
- daily caps are tuned
- operators are reviewing copy quality

## Key Environment Variables

- `RESEND_API_KEY`
- `ADMIN_ALERT_EMAIL`
- `FROM_EMAIL`
- `OPENAI_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `GOOGLE_WORKSPACE_SENDER`
- `AUTO_SEND_ENABLED`
- `LEADS_AUTO_SEND_APPROVED`
- `LEADS_DAILY_SEND_LIMIT`
- `LEADS_DAILY_OUTREACH_LIMIT`

## Operator Workflow

1. import or scrape leads
2. score leads
3. generate outreach
4. filter by:
   - score
   - best offer
   - language
   - outreach status
5. approve high-fit outreach
6. let cron send approved email if enabled
7. work replies and follow-up tasks from admin

## Recommended Defaults

- keep auto-send off until reply handling and suppression review are dialed in
- use low daily send caps first
- review Spanish and seller outreach samples manually
- prioritize:
  - high-score new businesses
  - weak-website local businesses
  - code-violation seller leads
  - Spanish-speaking service businesses

## Current Production Notes

- Gmail OAuth is configured in production with:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_REFRESH_TOKEN`
  - `GOOGLE_WORKSPACE_SENDER`
- Google Places scraping is configured with a live `GOOGLE_PLACES_API_KEY`.
- `Places API (New)` is enabled in Google Cloud and the production daily market scrape is returning real Google Places lead batches.
- Website audits are intentionally deferred out of the daily Google scrape path so the Vercel cron can stay within runtime limits; scraped leads still enter scoring and outreach workflows immediately.
