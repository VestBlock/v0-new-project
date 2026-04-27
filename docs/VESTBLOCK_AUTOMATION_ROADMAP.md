# VestBlock Automation Roadmap

## Goal

Make VestBlock operate like a SaaS platform: every upload, payment, analysis, alert, and admin action should be visible, logged, and easy to automate.

## Credit Report Upload Automation

- Create a `credit_reports` record for every uploaded file.
- Move through workflow statuses: `uploaded`, `extracting_text`, `text_extracted`, `analyzing`, `completed`, `failed`, `needs_review`.
- Store extracted text, AI analysis JSON, dispute-letter metadata, error messages, admin notes, and timestamps.
- Email the user and admin on upload.
- Log every upload to `admin_activity`.

## Admin Alert Automation

- Show new reports, failed analyses, email failures, paid customers, and leads in `/admin-panel`.
- Use `admin_activity` as the durable event stream.
- Run scheduled checks for stuck credit report statuses and create admin tasks before customers are left waiting.
- Use the `/admin-panel` Automation tab to confirm cron readiness, lifecycle email totals, configured env vars, and recent automation events.

## Email Notification Automation

Provider: Resend.

Events:

- Credit report uploaded: admin alert and user confirmation.
- Analysis completed: user result email and admin completion email.
- Analysis failed: admin failure alert.
- Payment completed: admin paid-customer alert.
- Payment failed or could not be recorded: admin review alert.
- Abandoned checkout: admin follow-up alert.
- No upload after signup: user upload reminder.
- Paid customer with no upload: user paid onboarding/upload reminder.
- New lead aging past follow-up window: admin lead follow-up alert.
- Future: reactivation and dispute-letter ready.

Email failures must be logged to `email_events` and must not break uploads or analysis.

## Lead And Funding Opportunity Automation

- Centralize funding, real estate, and business credit leads in `leads`.
- Route the public `/funding` form into `/api/funding-lead` so business funding interest creates a real lead row, admin email alert, follow-up task, and `lead_created` event.
- Use `/funding` for the free instant business funding eligibility checker, then route people who need help becoming eligible into `/funding/credit-card-strategy`.
- Use `/funding/credit-card-strategy` for the paid business funding readiness plan. The workflow creates `funding_strategy_requests`, scores readiness, captures consent, and queues paid plan requests for admin follow-up.
- Charge `$300` for the `funding_strategy_review` product through the shared PayPal order/capture routes.
- Keep funding strategy payments separate from VestBlock Pro subscription payments with `payments.product_type` and `metadata_json`.
- Alert admin when a funding lead is submitted.
- Track source route, lead type, status, contact info, and notes.
- Let admins update lead status from either `/admin/leads` or the main `/admin-panel`.
- Log lead status updates to `admin_activity` for operator accountability.
- Use `lib/leads/leadAutomation.ts` after lead creation to send immediate admin alerts, create follow-up tasks, and log `lead_created` events.
- Use `lib/funding/fundingStrategyAutomation.ts` after strategy request creation/payment to send admin alerts, create funding review tasks, and log durable events.
- Future: partner referral tracking, outcome tracking, application consent workflows, document upload checklists, and automatic nurture sequences by lead type.

## AEO And Content Automation

- Use `lib/aeo/topics.ts` as the starter topic source.
- Use `lib/content/marketingServices.ts` as the service catalog for generated SEO, social, and campaign content.
- Build content around high-intent clusters: AI credit repair, dispute letters, business credit, funding readiness, and grants.
- Avoid mass low-quality page generation.
- Tie each content page to a real VestBlock action: upload report, generate letters, join Pro, submit a funding lead.
- Store generated drafts in `content_assets` with status `draft`, `ready`, `published`, or `archived`.
- Let admins generate content from `/admin-panel` by choosing service, content type, language, platform, post style, audience, and prompt.
- Public SEO pages are published at `/resources/[slug]` only after the admin marks an SEO asset as `published`.
- Social posts and campaigns remain manual-post assets for now so the operator can review and post them safely.
- Future: scheduled content creation, social platform API posting, approval workflows, and analytics feedback loops.

## User Lifecycle Automation

- New signup: onboarding email and first-upload prompt.
- No upload after signup: reminder.
- Upload received: confirmation and timeline.
- Analysis complete: dashboard/results email.
- Failed analysis: admin review before user-facing messaging.
- Pro upgrade: welcome and next best action.
- Inactive users: reactivation with education and dashboard link.

Implemented lifecycle task automation:

- Daily `/api/cron/lifecycle-monitor` job protected by `CRON_SECRET`.
- Creates `signup_no_upload` admin tasks for users older than 48 hours with no report.
- Creates `paid_customer_no_upload` high-priority admin tasks for paid users older than 24 hours with no report.
- Creates `lead_followup` admin tasks for new leads older than 24 hours.
- Sends lifecycle reminder emails through Resend and records them in `email_events`.
- Checks existing `email_events` rows before sending so the cron can run repeatedly without duplicate reminders.
- Logs `signup_no_upload`, `paid_customer_no_upload`, and `lead_followup_needed` events to `admin_activity`.
- `/admin-panel` now includes an Automation tab for Vercel cron schedules, readiness checks, lifecycle email counts, and recent automation activity.

## Failed Payment And Abandoned Checkout

Payments exist through PayPal.

- Payment completion routes use `lib/payments/paymentAutomation.ts` to alert admin, log `payment_completed`, and create a `paid_customer_onboarding` task.
- Both `/api/paypal-webhook` and the legacy `/api/webhook` route use shared payment automation for successful and failed PayPal events.
- Failed payment paths use the same module to alert admin, log `payment_failed`, and create a `payment_failure` task.
- PayPal order creation logs `checkout_started` and stores the order ID on `user_profiles.paypal_order_id`.
- The daily lifecycle monitor creates `abandoned_checkout` tasks and admin alerts for stale unpaid PayPal orders.
- Avoid repeated payment emails within a short window.

## Admin Task Queue Automation

Use `admin_activity` as the event stream and `admin_tasks` as the durable task queue.

Future task types:

- Review failed analysis.
- Review new credit report uploads.
- Follow up after completed credit analysis.
- Follow up with paid customer.
- Onboard new paid customer.
- Review failed payment.
- Follow up on abandoned checkout.
- Call funding lead.
- Review report marked `needs_review`.
- Check failed email.
- Contact users whose uploads have no completed analysis.

Implemented task queue foundation:

- `admin_tasks` table with status, priority, due date, assignment, user, and related entity fields.
- Protected `/api/admin/tasks` API for listing, creating, and updating tasks.
- `/admin-panel` Tasks tab for status updates.
- Initial restored-report backlog task for imported credit reports still in `uploaded`.
- Workflow-created tasks for new uploads, completed analyses, failed analyses, and reports manually marked `needs_review`.
- Duplicate guard so retries do not flood the admin queue with multiple open tasks for the same report and task type.
- Daily `/api/cron/credit-repair-monitor` job that flags stalled reports in `uploaded`, `extracting_text`, `text_extracted`, or `analyzing`.
- Stalled report monitor requires `CRON_SECRET` in Vercel and logs `credit_analysis_stalled` events.
- Daily `/api/cron/lifecycle-monitor` job creates signup, paid-customer, and lead follow-up tasks.

## Operator Skills Added

Future Codex sessions should use `.agents/skills/vestblock/` as the operating manual for VestBlock.

Current skill groups:

- Credit repair workflow.
- Admin dashboard operations.
- Email alert automation.
- AEO content automation.
- Funding lead automation.
- User lifecycle automation.
- Compliance-safe credit content.
- Production launch verification.
- Vercel/Supabase release operations.
- Revenue operations.
- Analytics and conversion operations.
- Support and retention operations.
- Security/privacy audits.
- Credit repair QA.
- Partner offer operations.

These skills should guide future work before adding new features, changing env vars, moving domains, or touching private customer data.
