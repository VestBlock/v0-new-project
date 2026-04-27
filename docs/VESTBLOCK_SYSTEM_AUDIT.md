# VestBlock System Audit

## Snapshot

VestBlock is a Next.js 14 App Router project. Routes live in `app/`, API handlers live in `app/api/**/route.ts`, shared UI lives in `components/`, Supabase helpers live in `lib/supabase`, and database setup lives across root SQL files and `db/migrations`.

## Current App Structure

- Public routes: `/`, `/funding`, `/funding/credit-card-strategy`, `/business-setup`, `/es/vestblock`, `/resources/[slug]`, `/real-estate-funding`, `/sell`, `/ai-assistant`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/roadmap`.
- User routes: `/dashboard`, `/credit-upload`, `/credit-dashboard/[reportId]`, `/analysis/results/[jobId]`, `/profile`, `/user-hub`, `/tools/business-credit`, `/tools/grants`, `/tools/my-dispute-letters`, `/super-dispute`.
- Admin routes: `/admin-panel`, `/admin/leads`, `/admin/test`.
- Debug/test routes: multiple credit report, upload, OpenAI, streaming, database, and auth debug pages remain in `app/`, but are protected by admin-only middleware.

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

Fixed: `lib/supabase/server.ts` no longer logs cookies/session details and now prefers `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` with legacy fallbacks.

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
- `funding_strategy_requests` added by migration `025-create-funding-strategy-requests.sql`
- `email_events` added by migration `020-vestblock-ops-automation.sql`
- `admin_activity` added by migration `020-vestblock-ops-automation.sql`
- `admin_tasks` added by migration `022-create-admin-tasks.sql`
- `content_assets` added by migration `024-create-content-assets.sql`

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
- `/api/funding-lead` added for the public business funding form
- `/api/funding-strategy` added for card funding readiness and paid review intake
- `/api/webhook`
- `/api/paypal-webhook`
- `/api/process-payment`
- `/api/admin/dashboard` added
- `/api/admin/credit-reports/status` added
- `/api/admin/content` added for protected SEO, social post, and campaign generation plus content status updates
- `/api/admin/funding-strategy` added for admin status/notes updates on card funding strategy requests
- `/api/admin/leads` supports lead listing and status updates for admin operators
- `/api/real-estate-lead`
- `/api/sell-lead`
- `/api/ai-assistant-request`
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

Added workflow modules:

- `lib/workflows/creditRepairWorkflow.ts` for report records, status changes, email triggers, task creation, and logging.
- `lib/workflows/processCreditReportAnalysis.ts` for OCR/text extraction, negative item analysis, dispute letter generation, analysis attachment, and rerun-safe processing from stored uploads.

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
- Credit card funding strategy review requests
- Funding lead status controls
- Funding strategy status and admin notes controls
- Immediate lead alert and follow-up task automation through `lib/leads/leadAutomation.ts`
- Admin task queue
- Content operations tab for SEO pages, social posts, campaign drafts, and manual publishing status
- Automation readiness checks for cron, email, PayPal payment configuration, and Supabase data source health
- Individual report detail pages at `/admin-panel/reports/[reportId]`
- Individual user detail pages at `/admin-panel/users/[userId]`
- Rerun analysis action for stored credit report files

## Content And SEO Operations

VestBlock now has a dashboard-backed content operations foundation:

- `lib/content/marketingServices.ts` defines the service catalog and compliance notes used by generators.
- `lib/content/contentGenerator.ts` uses `OPENAI_API_KEY` and optional `OPENAI_CONTENT_MODEL` to create SEO pages, social posts, and campaigns.
- `/api/admin/content` requires admin access, writes generated drafts to `content_assets`, and logs `content_generated` / `content_published` events.
- `/admin-panel` includes a Content tab where admins can type the desired post/page style, choose service, language, audience, platform, and post type, then generate drafts.
- Published SEO page assets are available at `/resources/[slug]` and are included in the dynamic sitemap when Supabase exposes published rows.

Required setup: run `db/migrations/024-create-content-assets.sql` in Supabase and keep `OPENAI_API_KEY` configured in Vercel.

## Email Integration

Resend is already installed. The previous upload route instantiated Resend directly and could return early if email failed. Added `lib/email/sendEmail.ts` with reusable functions and failure logging.

Required env vars:

- `RESEND_API_KEY`
- `ADMIN_ALERT_EMAIL`
- `FROM_EMAIL`
- `NEXT_PUBLIC_SITE_URL`

## Payment Integration

PayPal is present through `/api/create-order`, `/api/capture-order`, `/api/webhook`, `/api/paypal-webhook`, and `@paypal/paypal-server-sdk`.

Payment automation now runs through `lib/payments/paymentAutomation.ts` and the lifecycle monitor, creating admin alerts, paid-customer onboarding tasks, failed-payment tasks, abandoned-checkout tasks, and `checkout_started` / `payment_completed` / `payment_failed` / `abandoned_checkout` activity logs. Both PayPal webhook routes now use the shared automation path for successful captures and failed payment events.

PayPal API URLs are centralized in `lib/paypal/config.ts`. The default environment is sandbox; set `PAYPAL_ENV=live` or `PAYPAL_MODE=live` in Vercel only when the live PayPal app credentials and webhook ID are configured.

The direct capture route and both PayPal webhook paths check `payments.paypal_transaction_id` before insert, so repeat capture requests or replayed webhook events do not duplicate payment records or repeat paid-customer automation.

`/api/admin/dashboard` exposes non-secret PayPal readiness metadata for `/admin-panel`, including sandbox/live mode and whether the client ID, client secret, and webhook ID are configured.

Payment products now live in `lib/payments/products.ts`:

- `vestblock_pro` remains the `$75` Pro product and sets `user_profiles.is_subscribed`.
- `funding_strategy_review` is the `$297` Business Credit Card Funding Strategy Review and records payment against `funding_strategy_requests` without granting Pro access.

The card funding workflow uses `lib/funding/cardStacking.ts` for readiness scoring and `lib/funding/fundingStrategyAutomation.ts` for admin alert/task/event automation.

Risk fixed: `create-order` was logging PayPal credential values. This has been removed.

Risk fixed: upload and PayPal webhook routes no longer log raw report text, extracted credit items, profile rows, webhook payloads, PayPal headers, or PayPal secrets.

## Missing Or Broken Integrations

- `background-analyzer` still contains placeholder schemas and comments from a removed Vercel Blob workflow.
- `job-status/route.ts` only exports `maxDuration`; the dynamic `job-status/[jobId]` route should be considered the functional route.
- Raw SQL and legacy database setup APIs are admin-gated and disabled unless explicit env flags are enabled.
- Supabase schema/type definitions do not fully match later migrations.
- Several routes rely on service-role Supabase access and need careful production env setup.
- Local builds fail without build-time env vars because older routes instantiate OpenAI/Supabase clients at module import. Vercel must have `OPENAI_API_KEY`, Supabase URL, anon key, and service-role key configured before deployment builds.

## Recommended Next Improvements

- Regenerate `types/supabase.ts` from the live Supabase schema.
- Consolidate credit analysis into the central workflow module.
- Continue moving customer credit-report status displays to the shared `lib/workflows/creditReportStatus.ts` model.
- Remove legacy database setup/debug routes once they are no longer needed for recovery work.
- Regenerate Supabase types and remove legacy env fallbacks once deployment settings are fully standardized.
- Add webhooks/cron for abandoned checkout, upload reminders, and stuck analysis jobs.
- Add customer-facing document checklist upload for paid funding strategy reviews.
- Add partner outcome tracking for business funding, card stacking, Bank Breezy Spanish leads, and real estate funding leads.
