# VestBlock Changelog

## 2026-04-26 Operations Upgrade

## Files Changed

- `app/admin-panel/page.tsx`
- `app/api/admin/dashboard/route.ts`
- `app/api/admin/credit-reports/status/route.ts`
- `app/api/upload-credit-report/route.ts`
- `app/api/create-order/route.ts`
- `app/api/capture-order/route.ts`
- `lib/auth/admin.ts`
- `lib/email/sendEmail.ts`
- `lib/system/logEvent.ts`
- `lib/supabase/admin.ts`
- `lib/workflows/creditRepairWorkflow.ts`
- `lib/aeo/topics.ts`
- `db/migrations/020-vestblock-ops-automation.sql`
- `docs/VESTBLOCK_SYSTEM_AUDIT.md`
- `docs/VESTBLOCK_AUTOMATION_ROADMAP.md`
- `docs/VESTBLOCK_AEO_PLAYBOOK.md`
- `.agents/skills/vestblock/*.md`

## Features Added

- Protected admin dashboard data API.
- Admin overview metrics.
- Credit Repair Command Center.
- Manual credit report status updates.
- User management table.
- Alerts and notifications panel.
- Recent activity feed.
- Payment and funding lead visibility.
- Resend email utility.
- Upload received emails.
- Analysis completed emails.
- Failure alert emails.
- New paid customer alert.
- System event logging wrapper.
- Central credit repair workflow status module.
- AEO topic starter registry.
- Codex operator skills for future sessions.

## Env Vars Required

- `RESEND_API_KEY`
- `ADMIN_ALERT_EMAIL`
- `FROM_EMAIL`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`

Optional legacy compatibility:

- `NEXT_PUBLIC_ADMIN_EMAIL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `RESEND_EMAIL`
- `WEB_HOST_URL`

## Database Changes Required

Run `db/migrations/020-vestblock-ops-automation.sql` in Supabase.

It adds:

- Credit report workflow columns.
- `email_events`
- `admin_activity`
- Admin RLS helper and policies.
- Profile role/subscription columns if missing.

## Manual Setup Steps

1. Add env vars in Vercel.
2. Run the Supabase migration.
3. Set at least one admin profile to `role = 'admin'`.
4. Verify Resend domain/from email.
5. Confirm PayPal return URL points to the intended dashboard/upload route.

## Known Issues

- `background-analyzer` still contains placeholder logic and should be refactored before being used as the canonical analysis worker.
- Supabase generated TypeScript types are stale relative to migrations.
- Debug routes remain publicly routable unless separately gated.
- `npm run lint` opens the Next.js ESLint setup prompt because no ESLint config is committed.
- `npx tsc --noEmit` currently fails on broad pre-existing type errors across unrelated routes/components.
- `npm run build` requires production-like env vars because some existing API routes instantiate OpenAI/Supabase during build collection.

## Verification

- `git diff --check` passed.
- `npm run build` passed when run with local dummy env values for Supabase, OpenAI, PayPal, and Resend.
- `npm run build` without env values failed on missing `OPENAI_API_KEY` in an existing biz-credit API route.

## Next Recommended Tasks

- Regenerate Supabase types.
- Add admin detail pages.
- Gate debug routes.
- Add cron for stuck report statuses.
- Add abandoned checkout and upload reminder automations.
