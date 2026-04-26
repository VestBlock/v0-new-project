# VestBlock System Audit

## Snapshot

VestBlock is a Next.js 14 App Router project. Routes live in `app/`, API handlers live in `app/api/**/route.ts`, shared UI lives in `components/`, Supabase helpers live in `lib/supabase`, and database setup lives across root SQL files and `db/migrations`.

## Current App Structure

- Public routes: `/`, `/funding`, `/real-estate-funding`, `/sell`, `/ai-assistant`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/roadmap`.
- User routes: `/dashboard`, `/credit-upload`, `/credit-dashboard/[reportId]`, `/analysis/results/[jobId]`, `/profile`, `/user-hub`, `/tools/business-credit`, `/tools/grants`, `/tools/my-dispute-letters`, `/super-dispute`.
- Admin routes: `/admin-panel`, `/admin/leads`, `/admin/test`.
- Debug/test routes: multiple credit report, upload, OpenAI, streaming, database, and auth debug pages remain in `app/`.

## Framework And Routing

This is Next.js App Router, not Pages Router. The project uses `app/layout.tsx`, route folders with `page.tsx`, and route handlers under `app/api/**/route.ts`.

## Auth Flow

Auth is Supabase Auth through `@supabase/ssr` and `@supabase/supabase-js`.

- Browser client: `lib/supabase/client.ts`.
- Server client: `lib/supabase/server.ts`.
- Session refresh middleware: `middleware.ts`.
- Client auth context: `contexts/auth-context.tsx`.
- Profile lookup table: `user_profiles`.
- Admin access previously depended on `user_profiles.role === 'admin'` or `NEXT_PUBLIC_ADMIN_EMAIL`.
- Added server-side admin check in `lib/auth/admin.ts`, using session user plus `user_profiles.role` or configured admin email.

Risk: `lib/supabase/server.ts` still contains noisy step/debug logging and uses `SUPABASE_URL` / `SUPABASE_ANON_KEY` instead of the `NEXT_PUBLIC_*` names used elsewhere.

## Database Tables Referenced

- `user_profiles`
- `chat_history`
- `user_documents`
- `credit_reports`
- `dispute_letters`
- `user_roadmaps`
- `analysis_jobs`
- `analysis_results`
- `payments`
- `leads`
- `email_events` added by migration `020-vestblock-ops-automation.sql`
- `admin_activity` added by migration `020-vestblock-ops-automation.sql`

## API Routes

Important operating routes include:

- `/api/upload-credit-report`
- `/api/initiate-analysis`
- `/api/analyze-report`
- `/api/background-analyzer`
- `/api/dispute-letters/**`
- `/api/generate-letter`
- `/api/generate-pdf`
- `/api/create-order`
- `/api/capture-order`
- `/api/paypal-webhook`
- `/api/process-payment`
- `/api/admin/dashboard` added
- `/api/admin/credit-reports/status` added
- `/api/admin/leads`
- `/api/real-estate-lead`
- `/api/sell-lead`
- `/api/biz-credit/**`
- `/api/grants`

## Credit Repair Workflow

The main upload path is `/credit-upload` posting to `/api/upload-credit-report`.

Current flow:

1. User selects PDF/image.
2. API uploads file into Supabase Storage bucket `credit-reports`.
3. API creates/updates a `credit_reports` record.
4. API attempts extraction/OCR.
5. API extracts negative items.
6. API generates dispute-letter PDFs into `dispute-letters`.
7. API creates `dispute_letters` rows.

Added workflow module: `lib/workflows/creditRepairWorkflow.ts`.

Standard statuses:

- `uploaded`
- `extracting_text`
- `text_extracted`
- `analyzing`
- `completed`
- `failed`
- `needs_review`

## Admin Dashboard Status

Before this change, `/admin-panel` only listed uploaded credit reports from `/api/upload-credit-report`.

Now `/admin-panel` uses `/api/admin/dashboard` and includes:

- Overview metrics
- Credit Repair Command Center
- Manual report status update
- User Management
- Alerts / Notifications
- Recent activity
- Payments and funding leads

## Email Integration

Resend is already installed. The previous upload route instantiated Resend directly and could return early if email failed. Added `lib/email/sendEmail.ts` with reusable functions and failure logging.

Required env vars:

- `RESEND_API_KEY`
- `ADMIN_ALERT_EMAIL`
- `FROM_EMAIL`
- `NEXT_PUBLIC_SITE_URL`

## Payment Integration

PayPal is present through `/api/create-order`, `/api/capture-order`, `/api/paypal-webhook`, and `@paypal/paypal-server-sdk`.

Risk fixed: `create-order` was logging PayPal credential values. This has been removed.

## Missing Or Broken Integrations

- `background-analyzer` still contains placeholder schemas and comments from a removed Vercel Blob workflow.
- `job-status/route.ts` only exports `maxDuration`; the dynamic `job-status/[jobId]` route should be considered the functional route.
- Some debug/test routes should be gated or removed before production.
- Supabase schema/type definitions do not fully match later migrations.
- Several routes rely on service-role Supabase access and need careful production env setup.

## Recommended Next Improvements

- Regenerate `types/supabase.ts` from the live Supabase schema.
- Consolidate credit analysis into the central workflow module.
- Add admin detail pages for individual reports/users.
- Gate debug routes behind admin access.
- Normalize env var names across server Supabase helpers.
- Add webhooks/cron for abandoned checkout, upload reminders, and stuck analysis jobs.
