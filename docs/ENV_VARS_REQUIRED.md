# VestBlock Environment Variables

## Core app

- `OPENAI_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
  Canonical production site URL used by metadata, sitemap, and AEO audits.

## Admin and scheduled jobs

- `CRON_SECRET`
  Required in production so Vercel Cron and protected scheduled endpoints can run.
- `ADMIN_ALERT_EMAIL`
  Admin notification inbox and fallback admin identity for server-side checks.
- `ADMIN_ALERT_PHONE`
  Optional SMS destination for operational alerts.
- `SELLER_LEAD_ALERT_PHONE`
  Optional SMS destination for seller lead alerts. Falls back to `ADMIN_ALERT_PHONE`.

## Payments and email

- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` (or `RESEND_EMAIL`, `OUTREACH_FROM_EMAIL`, then `FROM_EMAIL`)
  Dormant emergency infrastructure only. Production `sendEmail` defaults to Outlook even when `TRANSACTIONAL_EMAIL_PROVIDER` is missing or mistyped, and never falls back across providers. A Gmail/Resend branch can be exercised only with `ALLOW_LEGACY_EMAIL_PROVIDER_OVERRIDE=true` in an explicit `development` or `test` process.
- `TRANSACTIONAL_EMAIL_PROVIDER=outlook`
  Outlook is the sole active email provider for transactional, consented marketing, and strictly verified B2B email. Every Graph attempt first claims a durable `transactional_email_dispatches` identity. Accepted and dispatch-ambiguous identities cannot send again; reconcile by the stored dispatch, Graph message, internet-message, and correlation IDs before retrying. There is no automatic provider fallback.
- `MICROSOFT_GRAPH_CLIENT_ID`, `MICROSOFT_GRAPH_CLIENT_SECRET`, `MICROSOFT_TENANT_ID`
  Application credentials for Outlook delivery. The Entra application requires Microsoft Graph `Mail.Send` and `Mail.ReadWrite` application permissions with admin consent.
- `OUTLOOK_ACQUISITIONS_MAILBOX`
  Exact mailbox used to create a draft with `POST /users/{mailbox}/messages`, durably record the returned Graph message ID and `internetMessageId`, and send that draft with `POST /users/{mailbox}/messages/{id}/send`. Graph `202 Accepted` means provider acceptance only, never delivery.

## Guarded outreach

- `OUTREACH_PROVIDER_PREFERENCE`
  Legacy compatibility setting only; it does not change the governed provider. Active email delivery is Outlook-only.
- Instantly is retired from the application: there is no enrollment cron, enqueue callsite, campaign command, source-governor lane, or automatic delivery dependency.
- Verified B2B Outlook delivery requires fresh, recipient-bound Hunter `status=valid` evidence (maximum age 72 hours) plus fresh affirmative business-contact evidence (maximum age 30 days). Hunter addresses must match the canonical business website domain. Free/webmail is eligible only when the exact address is visibly sourced on the canonical public business website with fresh source URL and confidence evidence. Seller/consumer cold-email lanes remain prohibited.
- The database-backed Outlook cold budget enforces at most 25 accepted/reserved attempts per rolling 24 hours, at most 2 per scheduler invocation, at most 2 per recipient domain per rolling 24 hours, deterministic fair shares across the eight eligible B2B/partner lanes, weekdays from 09:00 through 16:59 America/Chicago, and stable idempotency. A Graph `202` is provider acceptance, never delivery.
- `RESEND_WEBHOOK_SECRET`
  Dormant Resend webhook verification only; it is not an active Outlook delivery dependency.
- Marketing delivery cannot be authorized by a request boolean. The sender must load a current `next_move_questionnaires` consent record, including its consent timestamp and recipient match, immediately before routing. Deleted, revoked, stale, mismatched, boolean-only, and unavailable evidence fails closed.
- `OUTREACH_REPLY_TO_EMAIL`
  Monitored Outlook address used to correlate replies with the originating message. After trimming and lowercasing, this must exactly match `OUTLOOK_ACQUISITIONS_MAILBOX`; a mismatch blocks every live send even if the legacy reply-capture override is enabled.
- `MICROSOFT_GRAPH_CLIENT_ID`
- `MICROSOFT_GRAPH_REFRESH_TOKEN`
  Delegated Outlook mailbox authentication. For application authentication, use `MICROSOFT_GRAPH_CLIENT_SECRET` and `MICROSOFT_TENANT_ID` instead of a refresh token.
- `OUTLOOK_ACQUISITIONS_MAILBOX`
  Outlook mailbox address read by Microsoft Graph for reply capture. Configure the actual mailbox explicitly; unverified reply-to aliases are not accepted as equivalent.
- `OUTREACH_MAILING_ADDRESS`
  Physical business mailing address that must render in every marketing or cold email. The guarded Outlook adapter also requires a rendered opt-out instruction before reserving or sending.
- `OUTREACH_REQUIRE_REPLY_CAPTURE=true`
- `OUTREACH_ALLOW_WITHOUT_REPLY_CAPTURE=false`
  These two settings fail closed if the monitored reply path is unavailable.
- `OUTREACH_REPLY_CAPTURE_MAX_AGE_MINUTES=120`
  Maximum age of a successful whole-mailbox sync before live sending closes.
- `VESTBLOCK_DAILY_OUTREACH_TARGET=1000`
  Canonical daily production-output target shared across all 24 strategy lanes. Allocation is 41 per lane plus one rotating output for 16 lanes each Chicago business day. Sixteen seller lanes plus the listing-agent intermediary lane direct roughly 70% of the plan toward real-estate acquisition. It governs sourcing, qualification, and draft preparation; it is not a promise that 1,000 emails will be accepted or delivered. Provider capacity, consent, channel policy, and delivery health independently cap delivery.
- `OUTREACH_DISPATCH_CRON_SEND`
- `AUTO_SEND_ENABLED=true`
- `LEADS_AUTO_SEND_APPROVED=true`
  The cron switch controls provider delivery, not sourcing, enrichment, scoring, or drafting. Keep it `false` until a compliant provider pool has proven capacity; preparation continues live. Review-only strategies still require a recorded human approval before scheduled delivery.
- `OUTREACH_DISPATCH_PER_RUN=30`
  Maximum lead attempts requested by each admitted 15-minute dispatch run. The database governor applies the lower global, lane, sender-stage, and trailing-24-hour limits.
- `PARTNER_PIPELINE_CRON_SEND`
  Master provider-delivery switch for the scheduled partner pipeline. Discovery, enrichment, scoring, and drafting continue when it is `false`; a lane still requires its own switch before delivery.
- `BUYERS_PIPELINE_CRON_SEND`, `LENDERS_PIPELINE_CRON_SEND`, `INVESTORS_PIPELINE_CRON_SEND`
  Independent buyer, lender, and investor provider-delivery switches. They do not disable preparation work.
- `BUYER_AUTO_SEND_ENABLED`, `LENDER_AUTO_SEND_ENABLED`, `INVESTOR_AUTO_SEND_ENABLED`
  Independent send gates. Delivery health, suppression, content validation, and daily caps still apply.
- `OUTREACH_DELIVERY_MIN_SAMPLE`, `OUTREACH_MAX_BAD_DELIVERY_RATE`
  Minimum telemetry evidence and maximum bad-delivery rate for automatic sending.
- `OUTREACH_CANARY_ENABLED`
  Enables only the explicitly requested manual recovery canary. Do not schedule this route automatically.
- `HUNTER_API_KEY`
  Domain contact enrichment for buyers, lenders, and investors. A `valid` deliverability result is required for B2B enrollment but does not by itself prove consent or that an address is a business contact.
- `BUYER_ENRICHMENT_PREFER_FREE=false`
  Explicitly enables paid Hunter only after public website analysis fails to find a usable buyer address. Missing or any value other than `false` fails closed to free enrichment.
- `BUYERS_DAILY_HUNTER_LOOKUP_LIMIT`, `BUYERS_SCORING_CONCURRENCY`
  Database-backed global paid-buyer lookup cap (default `10`, hard maximum `25`, resets at midnight `America/Chicago`) and website-scoring concurrency (default `4`, hard maximum `5`). Every provider request is reserved before it starts, so concurrent or retried scoring routes share one daily allowance. Failed lookups retry after six hours; terminal results cool down for 30 days.
- `BUYERS_PIPELINE_SCORE_LIMIT_CAP`
  Caps buyer records processed inside the shared partner cron. Defaults to `30` and has a hard maximum of `50`.
- `LENDER_ENRICHMENT_PREFER_FREE=false`
  Explicitly enables paid Hunter for a lender only after public website analysis fails to find a usable address. Missing or any value other than `false` fails closed to free enrichment.
- `LENDERS_DAILY_HUNTER_LOOKUP_LIMIT`, `LENDERS_HUNTER_CONCURRENCY`
  Database-backed global paid-lender lookup cap (default `10`, hard maximum `25`, resets at midnight `America/Chicago`) and bounded scoring concurrency (default `4`, hard maximum `5`). Concurrent and retried runs share one allowance; provider errors retry after six hours, active claims become recoverable after two hours, and terminal results cool down for 30 days.
- `LENDERS_PIPELINE_SCORE_LIMIT_CAP`
  Caps lender records processed inside the shared partner cron. Defaults to `30` and has a hard maximum of `50`; the standalone lender-scoring entry point is also hard-capped at `50` records per invocation.
- `INVESTORS_DAILY_HUNTER_LOOKUP_LIMIT`
  Database-backed global paid-investor lookup cap. Defaults to `20`, has a hard maximum of `25`, and resets at midnight in `America/Chicago`. Every Hunter request reserves its slot before the provider call, so overlapping partner and standalone invocations share one daily allowance. State that cannot be loaded or initialized, or is malformed, future-dated, or too contended, fails closed without calling Hunter.
- `INVESTORS_HUNTER_CONCURRENCY`
  Bounded Hunter lookup concurrency. Defaults to `4` and is capped at `5`; active per-investor claims become recoverable after two hours, failed lookups retry after six hours, and terminal results cool down for 30 days.

## Workflow automation

- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`
- `INNGEST_DEV`

## Distress leads and DealMachine

- `DEALMACHINE_API_KEY`
  Full official v2 secret (`dm_sk_live_*`) or OAuth access token (`dm_at_live_*`). Prefix-only values are rejected before any API request.
- `DEALMACHINE_DAILY_CREDIT_BUDGET`
  Maximum credits reserved by the daily acquisition run. Defaults to `250`.
- `DEALMACHINE_AUTOMATION_DAILY_CREDIT_CAP`
  Optional autonomous override for the daily DealMachine cap. The scheduler partitions it across deterministic Central-time slots.
- `DEALMACHINE_DAILY_ROWS_PER_STRATEGY`
  Requested rows per standard strategy. Defaults to `10`; the conditional-cash lane is separately capped below 5% of total acquisition.
- `DEALMACHINE_CONTACT_REVEAL_ROWS_PER_STRATEGY`
  Maximum top-ranked non-candidate properties per strategy to re-query for owner contacts after contact-free property discovery. Defaults to `3`.
- `DEALMACHINE_CONTACT_CREDIT_RESERVATION_PER_PROPERTY`
  Conservative local credit reservation for each exact-ID owner-contact lookup. Defaults to `3` and is capped at `10`.
- `N8N_DEALMACHINE_SOURCE_LEASE_MINUTES`
  Lease for an in-flight source slot before a crashed `received` event may be reclaimed. Defaults to `15` and is capped at `120`.
- `DEALMACHINE_SOURCE_ENABLED`
  Enables DealMachine acquisition inside the broader strategy engine. The dedicated daily v2 cron only requires a valid key.
- `DEALMACHINE_SYNC_ENABLED`
  Enables the authenticated manual DealMachine sync action in Property Intelligence.
- `DEALMACHINE_WEBHOOK_SECRET`
  HMAC secret for signed DealMachine export webhook ingestion.

## Property intelligence

No external property-valuation API is required for the current VestBlock analyzer path. The baseline estimate engine uses local math plus operator inputs and should be tightened with real comps before pricing or routing.

## Monitoring

- `NEXT_PUBLIC_SENTRY_DSN`
  Optional. Enables browser-side Sentry tracking.
- `SENTRY_DSN`
  Optional. Enables server and edge Sentry tracking.
- `SENTRY_AUTH_TOKEN`
  Optional. Used for authenticated Sentry build-time workflows such as sourcemap uploads. This does not replace the DSN values above.

## QA helpers

- `PLAYWRIGHT_BASE_URL`
  Optional. Base URL for local or preview smoke tests. Defaults to `http://127.0.0.1:3000`.
