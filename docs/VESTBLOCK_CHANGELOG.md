# VestBlock Changelog

## 2026-04-27 Lifecycle Follow-Up Monitor

## Files Changed

- `app/api/cron/lifecycle-monitor/route.ts`
- `app/api/cron/credit-repair-monitor/route.ts`
- `lib/system/cronAuth.ts`
- `lib/admin/tasks.ts`
- `lib/system/logEvent.ts`
- `vercel.json`
- `docs/VESTBLOCK_AUTOMATION_ROADMAP.md`
- `.agents/skills/vestblock/user-lifecycle-automation.md`
- `.agents/skills/vestblock/support-retention-operator.md`

## Features Added

- Added protected daily lifecycle cron for follow-up automation.
- Creates admin tasks for signups older than 48 hours with no credit report upload.
- Creates high-priority admin tasks for paid customers older than 24 hours with no upload.
- Creates admin tasks for new leads older than 24 hours without follow-up.
- Logs lifecycle follow-up events to `admin_activity`.
- Extracted shared `CRON_SECRET` authorization helper for scheduled routes.

## 2026-04-26 Credit Workflow Monitor

## Files Changed

- `app/api/cron/credit-repair-monitor/route.ts`
- `vercel.json`
- `lib/admin/tasks.ts`
- `lib/system/logEvent.ts`
- `lib/openai-server.ts`
- `next.config.mjs`
- `docs/VESTBLOCK_AUTOMATION_ROADMAP.md`
- `.agents/skills/vestblock/credit-report-workflow.md`

## Features Added

- Added daily Vercel cron for stalled credit repair workflow checks.
- Added token-protected `/api/cron/credit-repair-monitor` route.
- Creates high-priority admin tasks when reports remain in `uploaded`, `extracting_text`, `text_extracted`, or `analyzing` longer than expected.
- Logs `credit_analysis_stalled` events to `admin_activity`.
- Uses existing admin task duplicate protection to avoid repeat queue spam.
- Cleaned the server OpenAI client initialization so builds and production logs are quieter.
- Merged duplicate Next.js `experimental` config keys so all intended settings are active.

## 2026-04-26 Production Logging Cleanup

## Files Changed

- `lib/supabase/server.ts`
- `app/api/upload-credit-report/route.ts`
- `app/api/webhook/route.ts`
- `app/api/paypal-webhook/route.ts`
- `app/dashboard/page.tsx`
- `docs/VESTBLOCK_SYSTEM_AUDIT.md`

## Features Added

- Removed Supabase cookie/session dump logging from the server client helper.
- Normalized the server Supabase helper to prefer `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Removed dashboard logging of PayPal return tokens and approval links.
- Removed raw credit report text, extracted negative items, profile rows, PayPal webhook bodies, PayPal headers, and PayPal secrets from logs.

## 2026-04-26 Debug Route Hardening

## Files Changed

- `middleware.ts`
- `app/api/execute-sql/route.ts`
- `app/api/run-db-setup/route.ts`
- `app/api/setup-database/route.ts`
- `docs/VESTBLOCK_SYSTEM_AUDIT.md`
- `.agents/skills/vestblock/security-privacy-audit.md`

## Features Added

- Added `/admin/test` and `/api/execute-sql` to admin-only middleware protection.
- Added route-level admin checks to the SQL console and database setup APIs.
- Disabled raw SQL execution unless `ENABLE_ADMIN_SQL_CONSOLE=true`.
- Disabled legacy database setup APIs unless `ENABLE_DATABASE_SETUP_ROUTES=true`.

## 2026-04-26 Operations Upgrade

## 2026-04-26 Admin Detail And Reliability Pass

## 2026-04-26 Supabase Restore And Storage Hardening

## 2026-04-26 Production Hardening Pass

## 2026-04-26 Operator Skills Expansion

## 2026-04-26 Admin Task Queue Upgrade

## Files Changed

- `db/migrations/022-create-admin-tasks.sql`
- `app/api/admin/tasks/route.ts`
- `app/api/admin/dashboard/route.ts`
- `app/admin-panel/page.tsx`
- `docs/VESTBLOCK_AUTOMATION_ROADMAP.md`

## Features Added

- Added persistent `admin_tasks` table with RLS.
- Added protected admin task API for list/create/update.
- Added admin dashboard Tasks tab.
- Added open task metric.
- Added task status updates from the dashboard.
- Seeded a high-priority restored-report backlog task for imported reports still in `uploaded`.

## Files Changed

- `.agents/skills/vestblock/production-launch-verification.md`
- `.agents/skills/vestblock/vercel-supabase-release-operator.md`
- `.agents/skills/vestblock/revenue-operations-operator.md`
- `.agents/skills/vestblock/analytics-conversion-operator.md`
- `.agents/skills/vestblock/support-retention-operator.md`
- `.agents/skills/vestblock/security-privacy-audit.md`
- `.agents/skills/vestblock/credit-repair-qa-operator.md`
- `.agents/skills/vestblock/partner-offer-operator.md`
- `docs/VESTBLOCK_AUTOMATION_ROADMAP.md`

## Features Added

- Added launch verification skill for deploys, domains, env vars, and smoke testing.
- Added Vercel/Supabase release skill for safe production env and domain work.
- Added revenue operations skill for paid users, PayPal, upgrades, and checkout follow-up.
- Added analytics/conversion skill for privacy-safe funnel events.
- Added support/retention skill for admin follow-up and lifecycle tasks.
- Added security/privacy audit skill for RLS, storage, logs, and debug route reviews.
- Added credit repair QA skill for upload, analysis, letters, and admin workflows.
- Added partner offer skill for funding, referral, business credit, and lead operations.

## Files Changed

- `middleware.ts`
- `app/api/test-openai/route.ts`
- `app/api/test-openai-simple/route.ts`
- `app/api/test-streaming/route.ts`
- `app/credit-upload/page.tsx`
- `components/navigation.tsx`

## Features Added

- Protected diagnostic pages and setup/test APIs behind authenticated admin access.
- Prevented OpenAI test APIs from running during static build collection.
- Removed noisy navigation and credit upload debug logs from production-rendered pages.
- Updated Vercel Production Postgres env vars to the new VestBlock Supabase database.

## Files Changed

- `db/migrations/021-harden-storage-buckets.sql`

## Database Work Completed

- Connected to the new VestBlock Supabase project in `us-east-2`.
- Restored the legacy cluster backup into the new project.
- Applied `db/migrations/020-vestblock-ops-automation.sql`.
- Confirmed restored app tables, auth users, credit reports, analysis jobs, dispute letters, roadmaps, and storage buckets.
- Confirmed `contact@vestblock.io` exists as an admin profile and matches an auth user.
- Set private financial storage buckets to private.
- Added owner-scoped storage policies for credit reports and dispute letters.

## Remaining Vercel Step

- Replace Production `SUPABASE_SERVICE_ROLE_KEY` with the new VestBlock Supabase service-role key, then redeploy.

## Files Changed

- `app/admin-panel/page.tsx`
- `app/admin-panel/reports/[reportId]/page.tsx`
- `app/admin-panel/users/[userId]/page.tsx`
- `app/api/admin/dashboard/route.ts`
- `app/api/admin/reports/[reportId]/route.ts`
- `app/api/admin/users/[userId]/route.ts`
- `app/api/biz-credit/route.ts`
- `app/api/biz-credit/[id]/regenerate/route.ts`
- `app/tools/business-credit/page.tsx`
- `app/tools/grants/page.tsx`
- `app/tools/my-dispute-letters/page.tsx`

## Features Added

- Admin credit report detail page with report metadata, signed file access, analysis data, generated letters, email events, and manual review notes.
- Admin user detail page with profile, subscription, reports, payments, leads, and email activity.
- Admin dashboard links now open internal admin detail views.
- User management table now includes a direct user detail action.
- Admin report status saves keep the current status when only notes are changed.
- Admin detail APIs use safe query fallbacks so missing emails or file paths do not create invalid Supabase filters.
- Pro-only tools now redirect from client effects instead of triggering navigation during prerender.
- Business credit JSON catalog imports now use the default JSON import pattern expected by Next.js.

## Verification

- `npm run build` passed with local dummy env values.
- The previous `location is not defined` prerender errors on pro-only tools are resolved.
- The previous JSON named-export build warning for the business credit catalog is resolved.

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

- Admin task automation helper.
- Automatic admin tasks for new credit report uploads.
- Automatic admin tasks for completed credit analyses.
- Automatic urgent admin tasks for failed credit analyses.
- Automatic admin tasks when reports are marked `needs_review`.
- Duplicate guard for open workflow tasks tied to the same report.
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
- `CRON_SECRET`

Optional legacy compatibility:

- `NEXT_PUBLIC_ADMIN_EMAIL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `RESEND_EMAIL`
- `WEB_HOST_URL`

Optional locked-down diagnostics:

- `ENABLE_ADMIN_SQL_CONSOLE=true`
- `ENABLE_DATABASE_SETUP_ROUTES=true`

## Database Changes Required

Run these Supabase migrations in order:

- `db/migrations/020-vestblock-ops-automation.sql`
- `db/migrations/021-harden-storage-buckets.sql`
- `db/migrations/022-create-admin-tasks.sql`
- `db/migrations/023-admin-task-automation-dedupe.sql`

They add:

- Credit report workflow columns.
- `email_events`
- `admin_activity`
- `admin_tasks`
- Private storage bucket hardening.
- Duplicate protection for open report-specific admin tasks.
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
- Debug/setup/test routes are middleware-gated for admins; raw SQL and database setup APIs also require explicit env flags before they run.
- `npm run lint` opens the Next.js ESLint setup prompt because no ESLint config is committed.
- `npx tsc --noEmit` currently fails on broad pre-existing type errors across unrelated routes/components.
- `npm run build` requires production-like env vars because some existing API routes instantiate OpenAI/Supabase during build collection.

## Verification

- `git diff --check` passed.
- `npm run build` passed when run with local dummy env values for Supabase, OpenAI, PayPal, and Resend.
- Production Vercel deploy passed for the admin task queue release.
- `npm run build` without env values failed on missing `OPENAI_API_KEY` in an existing biz-credit API route.

## Next Recommended Tasks

- Regenerate Supabase types.
- Remove legacy setup/debug routes after production recovery workflows are no longer needed.
- Add abandoned checkout and upload reminder automations.
