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

## Workflow automation

- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`
- `INNGEST_DEV`

## Distress leads and DealMachine

- `DEALMACHINE_API_KEY`
  Full official v2 secret (`dm_sk_live_*`) or OAuth access token (`dm_at_live_*`). Prefix-only values are rejected before any API request.
- `DEALMACHINE_DAILY_CREDIT_BUDGET`
  Maximum credits reserved by the daily acquisition run. Defaults to `250`.
- `DEALMACHINE_DAILY_ROWS_PER_STRATEGY`
  Requested rows per standard strategy. Defaults to `10`; the conditional-cash lane is separately capped below 5% of total acquisition.
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
