# VestBlock Changelog

## 2026-04-27 PayPal Webhook Payment Dedupe

## Files Changed

- `app/api/paypal-webhook/route.ts`
- `.agents/skills/vestblock/revenue-operations-operator.md`
- `docs/VESTBLOCK_SYSTEM_AUDIT.md`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Updated `/api/paypal-webhook` to check `payments.paypal_transaction_id` before inserting payment records.
- Added explicit subscription update error handling for PayPal completed capture webhooks.
- Removed the route-level `$75.00` gate so valid PayPal capture amounts are recorded instead of silently ignored.
- Prevented repeated PayPal webhook deliveries from duplicating payment rows or repeating paid-customer automation.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed before and after build.
- `corepack pnpm run build` passed with local dummy production env values.

## 2026-04-27 Admin Data Source Health

## Files Changed

- `app/api/admin/dashboard/route.ts`
- `app/admin-panel/page.tsx`
- `.agents/skills/vestblock/admin-dashboard-operator.md`
- `docs/VESTBLOCK_SYSTEM_AUDIT.md`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Added admin API tracking for expected Supabase dashboard tables.
- Added Data Source Health to the `/admin-panel` Automation tab so missing tables or query failures are visible to operators.
- Added data-source query failures to the admin system errors feed without exposing secrets.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed before and after build.
- `corepack pnpm run build` passed with local dummy production env values.

## 2026-04-27 Admin Payment Readiness Panel

## Files Changed

- `app/api/admin/dashboard/route.ts`
- `app/admin-panel/page.tsx`
- `.agents/skills/vestblock/revenue-operations-operator.md`
- `docs/VESTBLOCK_SYSTEM_AUDIT.md`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Added PayPal readiness metadata to the protected admin dashboard API without exposing secret values.
- Added a Payment Readiness card to `/admin-panel` showing PayPal environment, client ID status, client secret status, and webhook ID status.
- Added operator guidance that distinguishes sandbox checkout testing from live PayPal payment readiness.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed before and after build.
- `corepack pnpm run build` passed with local dummy production env values.

## 2026-04-27 Capture Order Payment Dedupe

## Files Changed

- `app/api/capture-order/route.ts`
- `.agents/skills/vestblock/revenue-operations-operator.md`
- `docs/VESTBLOCK_SYSTEM_AUDIT.md`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Added explicit subscription update error handling to `/api/capture-order`.
- Added a `payments.paypal_transaction_id` lookup before inserting a captured PayPal payment.
- Prevented repeat capture requests from creating duplicate payment rows or repeating paid-customer automation.
- Kept subscription repair idempotent so a repeated successful capture can still leave the user subscribed.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed before and after build.
- `corepack pnpm run build` passed with local dummy production env values.

## 2026-04-27 PayPal Environment Configuration

## Files Changed

- `lib/paypal/config.ts`
- `lib/paypal/accessToken.ts`
- `app/api/create-order/route.ts`
- `app/api/capture-order/route.ts`
- `app/api/webhook/route.ts`
- `.agents/skills/vestblock/revenue-operations-operator.md`
- `.agents/skills/vestblock/vercel-supabase-release-operator.md`
- `docs/VESTBLOCK_SYSTEM_AUDIT.md`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Added a shared PayPal API configuration helper.
- Replaced route-level hardcoded PayPal sandbox API URLs with `getPaypalApiUrl()`.
- Added support for `PAYPAL_ENV=live` or `PAYPAL_MODE=live` to switch production traffic from PayPal sandbox to PayPal live.
- Kept sandbox as the default so development and staging remain safe unless explicitly switched.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed before and after build.
- `corepack pnpm run build` passed with local dummy production env values.

## 2026-04-27 Legacy PayPal Webhook Automation

## Files Changed

- `app/api/webhook/route.ts`
- `.agents/skills/vestblock/revenue-operations-operator.md`
- `docs/VESTBLOCK_AUTOMATION_ROADMAP.md`
- `docs/VESTBLOCK_SYSTEM_AUDIT.md`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Updated the legacy `/api/webhook` PayPal route to use the shared Supabase admin client instead of a module-level service-role client.
- Wired legacy PayPal capture completion through `lib/payments/paymentAutomation.ts` for paid-customer admin alerts, onboarding tasks, and `payment_completed` logs.
- Added failed-payment automation for missing PayPal order IDs, missing matching profiles, payment insert failures, subscription update failures, denied captures, voided orders, and handler exceptions.
- Added duplicate transaction checks so repeated PayPal webhooks do not create duplicate `payments` rows or repeat paid-customer automation.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed before and after build.
- `corepack pnpm run build` passed with local dummy production env values.

## 2026-04-27 Abandoned Checkout Automation

## Files Changed

- `app/api/create-order/route.ts`
- `app/api/cron/lifecycle-monitor/route.ts`
- `app/api/admin/dashboard/route.ts`
- `lib/admin/tasks.ts`
- `lib/email/sendEmail.ts`
- `lib/system/logEvent.ts`
- `.agents/skills/vestblock/revenue-operations-operator.md`
- `.agents/skills/vestblock/analytics-conversion-operator.md`
- `.agents/skills/vestblock/email-alert-automation.md`
- `.agents/skills/vestblock/user-lifecycle-automation.md`
- `docs/VESTBLOCK_AUTOMATION_ROADMAP.md`
- `docs/VESTBLOCK_SYSTEM_AUDIT.md`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Added `checkout_started` logging when PayPal order creation succeeds.
- Added abandoned checkout detection to the lifecycle cron for unpaid PayPal orders older than the follow-up window.
- Added `abandoned_checkout` admin activity logging, `abandoned_checkout` admin tasks, and `admin_abandoned_checkout` email alerts.
- Added checkout/abandoned checkout events to the admin automation feed.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed before and after build.
- `corepack pnpm run build` passed with local dummy production env values.

## 2026-04-27 Failed Payment Automation

## Files Changed

- `app/api/capture-order/route.ts`
- `app/api/paypal-webhook/route.ts`
- `app/api/process-payment/route.ts`
- `app/api/admin/dashboard/route.ts`
- `lib/payments/paymentAutomation.ts`
- `lib/admin/tasks.ts`
- `lib/email/sendEmail.ts`
- `lib/system/logEvent.ts`
- `.agents/skills/vestblock/email-alert-automation.md`
- `.agents/skills/vestblock/user-lifecycle-automation.md`
- `docs/VESTBLOCK_AUTOMATION_ROADMAP.md`
- `docs/VESTBLOCK_SYSTEM_AUDIT.md`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Added shared failed-payment automation for admin alerts, `payment_failed` activity logging, and `payment_failure` admin tasks.
- Added admin payment failure email event `admin_payment_failed`.
- Wrapped PayPal capture failures so unsuccessful or errored captures are visible to operators.
- Added failed-payment handling for PayPal webhook record failures and explicit denied/voided PayPal webhook events.
- Added failed-payment handling for the internal payment processing route when payment records cannot be written.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed before and after build.
- `corepack pnpm run build` passed with local dummy production env values.

## 2026-04-27 Payment Completion Automation

## Files Changed

- `app/api/capture-order/route.ts`
- `app/api/admin/dashboard/route.ts`
- `app/api/paypal-webhook/route.ts`
- `app/api/process-payment/route.ts`
- `lib/payments/paymentAutomation.ts`
- `lib/admin/tasks.ts`
- `.agents/skills/vestblock/user-lifecycle-automation.md`
- `.agents/skills/vestblock/email-alert-automation.md`
- `docs/VESTBLOCK_AUTOMATION_ROADMAP.md`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Added shared payment completion automation for admin paid-customer alerts, `payment_completed` logging, and onboarding task creation.
- Wired PayPal capture, PayPal webhook, and existing internal payment processing route through the same automation.
- Added `paid_customer_onboarding` admin tasks so new paid customers are followed up immediately.
- Updated payment routes to use the Supabase service-role admin client for server-side payment writes.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed before and after build.
- `corepack pnpm run build` passed with local dummy production env values.

## 2026-04-27 Immediate Lead Intake Automation

## Files Changed

- `app/api/ai-assistant-request/route.ts`
- `app/api/real-estate-lead/route.ts`
- `app/api/sell-lead/route.ts`
- `lib/leads/leadAutomation.ts`
- `lib/admin/tasks.ts`
- `lib/email/sendEmail.ts`
- `lib/system/logEvent.ts`
- `.agents/skills/vestblock/funding-lead-automation.md`
- `docs/VESTBLOCK_AUTOMATION_ROADMAP.md`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Added shared new-lead automation that sends an admin alert email, creates a follow-up admin task, and logs a `lead_created` event.
- Wired real estate funding, house seller, and AI assistant lead submissions into the shared automation path.
- Replaced route-local Resend lead notifications with the reusable email event/logger system.
- Moved lead-route Supabase service-role clients out of module scope so routes do not require service env vars during import.
- Updated the funding lead operator skill with the new shared automation path.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed before and after build.
- `corepack pnpm run build` passed with local dummy production env values.

## 2026-04-27 Lead Operations Upgrade

## Files Changed

- `app/api/admin/leads/route.ts`
- `app/api/admin/dashboard/route.ts`
- `app/admin-panel/page.tsx`
- `docs/VESTBLOCK_AUTOMATION_ROADMAP.md`
- `docs/VESTBLOCK_SYSTEM_AUDIT.md`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Updated `/api/admin/leads` to support both bearer-token admin access from `/admin/leads` and cookie-based admin access from `/admin-panel`.
- Added server-side lead status validation for `new`, `contacted`, `qualified`, and `closed`.
- Added admin activity logging when an operator updates a lead.
- Expanded the admin dashboard lead payload with phone and notes fields.
- Added funding lead status controls directly inside the `/admin-panel` Payments and Leads tab.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed before and after build.
- `corepack pnpm run build` passed with local dummy production env values.

## 2026-04-27 Admin Automation Dashboard

## Files Changed

- `app/api/admin/dashboard/route.ts`
- `app/admin-panel/page.tsx`
- `docs/VESTBLOCK_AUTOMATION_ROADMAP.md`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Added automation readiness data to the protected admin dashboard API without exposing secret values.
- Added expected Vercel cron schedules for credit repair and lifecycle monitors to the admin dashboard payload.
- Added lifecycle email counters for sent, skipped, failed, and total reminder events.
- Added an Automation tab in `/admin-panel` for env readiness, cron schedules, lifecycle email counts, and recent automation activity.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed.
- `corepack pnpm run build` passed with local dummy production env values.

## 2026-04-27 Lifecycle Reminder Emails

## Files Changed

- `app/api/cron/lifecycle-monitor/route.ts`
- `lib/email/sendEmail.ts`
- `docs/VESTBLOCK_AUTOMATION_ROADMAP.md`

## Features Added

- Added user upload reminder email for signups older than 48 hours with no credit report.
- Added paid customer upload/onboarding reminder email for paid users older than 24 hours with no report.
- Added admin lead follow-up alert email for new leads older than 24 hours.
- Added `email_events` duplicate checks so scheduled lifecycle reminders can run repeatedly without sending duplicate reminders.
- Added lifecycle email attempted/skipped counts to the cron response.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed.
- `corepack pnpm run build` passed with local dummy production env values.

## 2026-04-27 Credit Analysis Rerun Workflow

## Files Changed

- `lib/workflows/processCreditReportAnalysis.ts`
- `app/api/upload-credit-report/route.ts`
- `app/api/admin/reports/[reportId]/actions/route.ts`
- `app/admin-panel/reports/[reportId]/page.tsx`

## Features Added

- Moved extraction, negative item analysis, dispute letter generation, workflow status updates, and completion email triggers into a reusable workflow processor.
- Updated credit report upload processing to use the shared workflow processor instead of keeping analysis logic inline in the upload route.
- Added a protected admin `rerun_analysis` action that downloads the stored report from Supabase Storage and reprocesses it.
- Added a Rerun analysis button to the admin report detail operator actions panel.
- Creates a follow-up admin task after a successful rerun so the operator can review outputs before customer follow-up.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed.
- `corepack pnpm run build` passed with local dummy production env values.

## 2026-04-27 Customer Credit Workflow Status

## Files Changed

- `lib/workflows/creditReportStatus.ts`
- `components/credit-report-status-card.tsx`
- `app/dashboard/page.tsx`
- `app/credit-upload/page.tsx`
- `app/credit-dashboard/[reportId]/page.tsx`

## Features Added

- Added a shared customer-facing status model for credit report workflow states.
- Added a reusable credit report status card with progress, next-step guidance, letter counts, and contextual actions.
- Added a Credit Repair Workflow section to `/dashboard` that lists the user's recent reports from Supabase.
- Updated upload success state with direct links to report status, dashboard, and another upload.
- Updated `/credit-dashboard/[reportId]` to read newer workflow fields such as `status`, `analysis_json`, `dispute_letters_json`, and `uploaded_at`.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed.
- `corepack pnpm run build` passed with local dummy production env values.

## 2026-04-27 Edge-Safe Diagnostic Middleware

## Files Changed

- `middleware.ts`

## Features Added

- Removed Supabase SSR/client package imports from middleware so the Edge Runtime no longer pulls in Node-only Supabase internals.
- Kept diagnostic pages and diagnostic setup/test APIs protected with Edge-safe Supabase Auth REST checks.
- Narrowed the middleware matcher to only the protected diagnostic/admin-test surfaces instead of matching nearly every request.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed.
- `corepack pnpm audit --json` reports zero vulnerabilities.
- `corepack pnpm run build` passed with local dummy production env values.
- The previous Supabase Edge Runtime warning is no longer emitted by the local production build.

## 2026-04-27 Sitemap And Robots

## Files Changed

- `app/sitemap.ts`
- `app/robots.ts`
- `docs/VESTBLOCK_AEO_PLAYBOOK.md`

## Features Added

- Added a curated public sitemap for the home page, learning center, AEO topic pages, and public conversion/tool routes.
- Added robots rules that allow public content while excluding admin, API, account, diagnostic, setup, test, and user-specific report routes.
- Documented sitemap/robots maintenance rules in the AEO playbook.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed.
- `corepack pnpm audit --json` reports zero vulnerabilities.
- `corepack pnpm run build` passed with local dummy production env values and generated `/robots.txt` plus `/sitemap.xml`.

## 2026-04-27 AEO Learning Center Starter

## Files Changed

- `lib/aeo/topics.ts`
- `app/learn/page.tsx`
- `app/learn/[slug]/page.tsx`
- `components/navigation.tsx`
- `docs/VESTBLOCK_AEO_PLAYBOOK.md`

## Features Added

- Expanded the AEO topic registry with customer-facing descriptions, audiences, takeaways, next steps, FAQs, and related offer paths.
- Added a public `/learn` hub for credit repair, dispute, business credit, funding, and credit builder topics.
- Added static `/learn/[slug]` guide pages with metadata, FAQ schema, related guides, compliance-safe disclaimers, and tool CTAs.
- Added a top navigation link to the learning center.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed.
- `corepack pnpm audit --json` reports zero vulnerabilities.
- `corepack pnpm run build` passed with local dummy production env values and generated `/learn` plus 16 static topic pages.

## 2026-04-27 ESLint CLI Migration

## Files Changed

- `package.json`
- `pnpm-lock.yaml`
- `eslint.config.mjs`

## Features Added

- Replaced the deprecated interactive `next lint` script with the repeatable ESLint CLI.
- Added a Next-compatible flat ESLint config for the current Next 15 runtime.
- Pinned ESLint packages to compatible versions and narrowed the `minimatch` override for ESLint's legacy config helper.
- Kept inherited cleanup findings as warnings so lint is useful now without blocking production upgrades.

## Verification

- `corepack pnpm run lint` passes with warnings only.
- `corepack pnpm exec tsc --noEmit` passed.
- `corepack pnpm audit --json` reports zero vulnerabilities.
- `corepack pnpm run build` passed with local dummy production env values.

## 2026-04-27 Admin Dashboard Search And Filters

## Files Changed

- `app/admin-panel/page.tsx`

## Features Added

- Added dashboard search and filter controls for credit reports, users, alerts, admin tasks, recent activity, payments, and funding leads.
- Added filtered result counts so admins can see how much of the operational queue is currently visible.
- Kept filtering client-side against the existing protected admin dashboard payload to avoid database/schema risk.

## Verification

- `corepack pnpm exec tsc --noEmit` passed.
- `corepack pnpm audit --json` reports zero vulnerabilities.
- `corepack pnpm run build` passed with local dummy production env values.
- `corepack pnpm run lint` remains blocked by Next's deprecated interactive lint setup prompt.

## 2026-04-27 Credit Workflow Operator Actions

## Files Changed

- `app/api/upload-credit-report/route.ts`
- `app/api/admin/reports/[reportId]/actions/route.ts`
- `app/admin-panel/reports/[reportId]/page.tsx`

## Features Added

- Centralized credit report upload bookkeeping through `createCreditReportRecord()` so report creation, email alerts, admin tasks, and activity logging use the same workflow path.
- Added protected admin report actions for resending upload emails, resending analysis-ready emails, and creating manual follow-up tasks.
- Added an Operator Actions panel on the admin report detail page.

## Verification

- `corepack pnpm exec tsc --noEmit` passed.
- `corepack pnpm audit --json` reports zero vulnerabilities.
- `corepack pnpm run build` passed with local dummy production env values.
- `corepack pnpm run lint` remains blocked by Next's deprecated interactive lint setup prompt.

## 2026-04-27 Credit Report Operator Timeline

## Files Changed

- `app/api/admin/reports/[reportId]/route.ts`
- `app/admin-panel/reports/[reportId]/page.tsx`
- `lib/admin/reportTimeline.ts`

## Features Added

- Added a reusable admin timeline builder for credit report operations.
- Extended the admin report detail API with related admin tasks, a combined workflow timeline, and an operational summary.
- Upgraded the admin report detail page with next-best-action guidance, workflow health badges, a chronological activity view, and inline admin task status updates.

## Verification

- `corepack pnpm exec tsc --noEmit` passed.
- `corepack pnpm audit --json` reports zero vulnerabilities.
- `corepack pnpm run build` passed with local dummy production env values.
- `corepack pnpm run lint` is still blocked by Next's deprecated interactive lint setup prompt.

## 2026-04-27 Type Safety Stabilization

## Files Changed

- `app/api/job-status/[jobId]/route.ts`
- `app/api/side-hustle-chat/route.ts`
- `app/user-hub/page.tsx`
- `app/tools/my-dispute-letters/page.tsx`
- `components/chat-interface.tsx`
- `components/interactive-roadmap.tsx`
- `components/analysis-result-client-view.tsx`
- `components/credit-cards-tab.tsx`
- `components/side-hustles-tab.tsx`
- `components/enhanced-credit-analyzer-client.tsx`
- `components/file-upload.tsx`
- `components/financial-goal-card.tsx`
- `components/auth-debug.tsx`
- `components/ui/alert.tsx`
- `components/ui/badge.tsx`
- `components/ui/calendar.tsx`
- `components/ui/chart.tsx`
- `components/ui/toast.tsx`
- `lib/credit-report-extractor.ts`
- `lib/semantic-chunking.ts`

## Features Added

- Cleared the repo-wide TypeScript check so future credit workflow and dashboard refactors can catch real regressions.
- Made `ChatInterface` work in both standalone mode and controlled dashboard chat mode.
- Hardened job status AI prompt handling and side-hustle OpenAI configuration errors.
- Made roadmap, recommendation, alert, badge, toast, calendar, chart, upload, and diagnostic UI helpers compatible with the current dependency versions.
- Preserved existing runtime behavior while tightening types around report extraction and semantic chunking.

## Verification

- `pnpm exec tsc --noEmit` passed.
- `pnpm audit` reports zero vulnerabilities.
- `pnpm run build` passed with local dummy production env values.

## 2026-04-27 AI SDK Security Cleanup

## Files Changed

- `app/api/chat-with-analysis/route.ts`
- `app/api/background-analyzer/route.ts`
- `lib/openai-service.ts`
- `package.json`
- `pnpm-lock.yaml`
- `package-lock.json`

## Features Added

- Removed the direct vulnerable `ai` package dependency after replacing its two server-route usages with the existing OpenAI SDK pattern.
- Removed the now-unused `@ai-sdk/openai` server provider package.
- Kept `@ai-sdk/react` pinned for existing client chat hook compatibility.
- Converted `/api/chat-with-analysis` to stream text from the OpenAI SDK directly.
- Converted `/api/background-analyzer` to use OpenAI JSON mode with Zod validation instead of `generateObject`.
- Declared pnpm as the project package manager and removed `package-lock.json` so Vercel/GitHub/local installs use one lockfile source of truth.

## Verification

- `pnpm audit` reports zero vulnerabilities.

## 2026-04-27 Runtime Framework Upgrade

## Files Changed

- `package.json`
- `package-lock.json`
- `pnpm-lock.yaml`
- `next.config.mjs`
- `lib/supabase/server.ts`
- `lib/auth/admin.ts`
- `lib/openai-service.ts`
- `lib/paypal/accessToken.ts`
- `app/admin-panel/reports/[reportId]/page.tsx`
- `app/admin-panel/users/[userId]/page.tsx`
- `app/api/admin/reports/[reportId]/route.ts`
- `app/api/admin/users/[userId]/route.ts`
- `app/api/biz-credit/[id]/regenerate/route.ts`
- `app/api/capture-order/route.ts`
- `app/api/chat-direct/route.ts`
- `app/api/chat-with-analysis/route.ts`
- `app/api/create-order/route.ts`
- `app/api/dispute-letters/[id]/pdf/route.ts`
- `app/api/dispute-letters/[id]/regenerate/route.ts`
- `app/api/generate-letter/route.ts`
- `app/api/job-status/route.ts`
- `app/api/job-status/[jobId]/route.ts`
- `app/api/webhook/route.ts`
- `app/credit-dashboard/[reportId]/page.tsx`

## Features Added

- Upgraded the production framework runtime to Next.js `15.5.15`.
- Upgraded React and React DOM to `19.2.5`.
- Upgraded React type packages for React 19 compatibility.
- Moved Next server package externalization from the deprecated experimental key to `serverExternalPackages`.
- Set an explicit `outputFileTracingRoot` so local builds do not infer the wrong workspace root when parent folders contain lockfiles.
- Added a pnpm override for Next's nested PostCSS dependency so production pnpm installs resolve to patched PostCSS `8.5.12`.
- Updated dynamic admin/report routes for Next 15 async route params.
- Updated Supabase server auth cookie access for Next 15's async `cookies()` API.
- Moved shared PayPal access-token generation out of route modules and into `lib/paypal/accessToken.ts`.
- Pinned `@ai-sdk/react` to the Vercel AI SDK generation used by the existing chat UI and updated the chat streaming route response helper.
- Added `supports-color` to satisfy Axios/debug's optional server build import and reduce noisy build warnings.

## Known Remaining Security Work

- Superseded by the AI SDK security cleanup above. The production pnpm audit is clean.

## 2026-04-27 Dependency Security Patch

## Files Changed

- `package.json`
- `package-lock.json`
- `pnpm-lock.yaml`

## Features Added

- Upgraded Next.js from `14.2.16` to `14.2.35` to remove the critical Next.js 14 middleware authorization advisory and several older Next.js 14 advisories.
- Upgraded Axios to `^1.15.2`.
- Upgraded direct PostCSS to `^8.5.12`.
- Added npm/pnpm overrides for patched transitive packages, including `follow-redirects`, `picomatch`, `glob`, `minimatch`, `brace-expansion`, `yaml`, `jsondiffpatch`, and `mdast-util-to-hast`.
- Synced both npm and pnpm lockfiles because the repo contains both and Vercel builds with pnpm.

## Known Remaining Security Work

- `npm audit` now reports only the remaining Next.js major-version advisories tied to Next 14 and its bundled PostCSS; clearing those requires a controlled Next 15/16 plus React upgrade.
- `pnpm audit` also reports a low AI SDK advisory that requires upgrading the `ai` package across a major version.

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
- `PAYPAL_WEBHOOK_ID`
- `CRON_SECRET`

Optional payment environment:

- `PAYPAL_ENV=sandbox` for test payments
- `PAYPAL_ENV=live` for real PayPal payments

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
