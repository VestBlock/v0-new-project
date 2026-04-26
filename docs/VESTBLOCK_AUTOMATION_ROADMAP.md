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
- Add future scheduled checks for stuck statuses, such as reports in `extracting_text` for more than 20 minutes.

## Email Notification Automation

Provider: Resend.

Events:

- Credit report uploaded: admin alert and user confirmation.
- Analysis completed: user result email and admin completion email.
- Analysis failed: admin failure alert.
- Payment completed: admin paid-customer alert.
- Future: abandoned checkout, upload reminder, reactivation, dispute-letter ready.

Email failures must be logged to `email_events` and must not break uploads or analysis.

## Lead And Funding Opportunity Automation

- Centralize funding, real estate, and business credit leads in `leads`.
- Alert admin when a funding lead is submitted.
- Track source route, lead type, status, contact info, and notes.
- Future: partner referral tracking and follow-up task generation.

## AEO And Content Automation

- Use `lib/aeo/topics.ts` as the starter topic source.
- Build content around high-intent clusters: AI credit repair, dispute letters, business credit, funding readiness, and grants.
- Avoid mass low-quality page generation.
- Tie each content page to a real VestBlock action: upload report, generate letters, join Pro, submit a funding lead.

## User Lifecycle Automation

- New signup: onboarding email and first-upload prompt.
- No upload after signup: reminder.
- Upload received: confirmation and timeline.
- Analysis complete: dashboard/results email.
- Failed analysis: admin review before user-facing messaging.
- Pro upgrade: welcome and next best action.
- Inactive users: reactivation with education and dashboard link.

## Failed Payment And Abandoned Checkout

Payments exist through PayPal. Next steps:

- Store attempted checkout/order IDs.
- Alert admin on failed capture.
- Send abandoned checkout email after a safe delay.
- Avoid repeated payment emails within a short window.

## Admin Task Queue Automation

Use `admin_activity` as the event stream and `admin_tasks` as the durable task queue.

Future task types:

- Review failed analysis.
- Follow up with paid customer.
- Call funding lead.
- Review report marked `needs_review`.
- Check failed email.
- Contact users whose uploads have no completed analysis.

Implemented task queue foundation:

- `admin_tasks` table with status, priority, due date, assignment, user, and related entity fields.
- Protected `/api/admin/tasks` API for listing, creating, and updating tasks.
- `/admin-panel` Tasks tab for status updates.
- Initial restored-report backlog task for imported credit reports still in `uploaded`.

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
