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
  Optional locally, required for `npm run distress:dealmachine:pull`, `npm run distress:dealmachine:push25`, and `npm run distress:dealmachine:push`. Uses DealMachine Bearer auth.
- `DEALMACHINE_LIST_IDS`
  Optional comma-separated DealMachine list ids to attach after API lead creation.
- `DEALMACHINE_TAG_IDS`
  Optional comma-separated DealMachine tag ids to attach after API lead creation.
- `DEALMACHINE_LEAD_STATUS_ID`
  Optional DealMachine lead status id to set after API lead creation.

## Property intelligence

- `RENTCAST_API_KEY`
  Optional. Enables live AVM and rent estimates during seller intake. Without it, VestBlock still stores seller-supplied and DealMachine-derived rough estimates.
- `RENTCAST_API_BASE_URL`
  Optional. Defaults to `https://api.rentcast.io/v1`.
- `RENTCAST_VALUE_PATH`
  Optional. Defaults to `/avm/value`.
- `RENTCAST_RENT_PATH`
  Optional. Defaults to `/avm/rent/long-term`.

## Analytics

- `NEXT_PUBLIC_POSTHOG_KEY`
  Use the PostHog project API key for client-side product analytics.
- `NEXT_PUBLIC_POSTHOG_HOST`
  Optional. Defaults to `https://us.i.posthog.com`.
- `POSTHOG_API_KEY`
  Optional server-side override. Falls back to `NEXT_PUBLIC_POSTHOG_KEY` if omitted.
- `POSTHOG_HOST`
  Optional server-side override for the PostHog host.

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
