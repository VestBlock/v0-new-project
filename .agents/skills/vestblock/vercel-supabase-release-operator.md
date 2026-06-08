# Vercel Supabase Release Operator

Use this skill when changing VestBlock production env vars, Supabase project connections, Vercel domains, or release deployment settings.

## Required Production Env Vars

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `RESEND_API_KEY`
- `ADMIN_ALERT_EMAIL`
- `FROM_EMAIL`
- `NEXT_PUBLIC_SITE_URL`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`
- `PAYPAL_ENV`

## Supabase Safety

- Decode JWT metadata only to verify `ref` and `role`; never print full secrets.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` should have role `anon`.
- `SUPABASE_SERVICE_ROLE_KEY` should have role `service_role`.
- Both should match the same project ref.
- Never deploy after switching public Supabase URL if the service role still points to an old project.

## Vercel Release Flow

1. Verify env vars.
2. Run local build when code changed.
3. Deploy production.
4. Confirm Vercel deployment is `READY`.
5. Smoke test public pages and protected APIs.
6. Verify custom domain assignment.

## Monitoring Loop

Use this loop when Rob asks if production is healthy:

1. Check latest deployment status and production URL.
2. Review recent function errors, especially cron routes, lead routes, payment routes, and admin APIs.
3. Verify cron health for outreach, visibility indexing, daily reports, and content publishing.
4. Check env drift between local `.env.local` expectations and Vercel env presence without printing secrets.
5. Verify domain status for `vestblock.io` and `www.vestblock.io`.
6. Escalate only real blockers: failed deploys, missing env vars, repeated function errors, broken domains, or auth leaks.

## Domain Move Rules

- Move `vestblock.io` and `www.vestblock.io` from `vest-block-pro` to `v0-vest-block-rebuild`.
- Preferred primary: `www.vestblock.io`.
- Apex `vestblock.io` may redirect to www.
- If CLI/API reports alias conflict, inspect both project domain settings in Vercel dashboard.

## Do Not Do

- Do not print secrets.
- Do not overwrite PayPal production keys without confirmation.
- Keep `PAYPAL_ENV=sandbox` for test credentials; use `PAYPAL_ENV=live` only with live PayPal credentials and live webhook ID.
- Do not delete the old project until the upgraded app has been live and verified.
