# Credit Report Workflow

Use this skill when changing VestBlock credit report upload, text extraction, AI analysis, dispute letter generation, report statuses, or related notifications.

## Operating Flow

1. User uploads a PDF/image from `/credit-upload`.
2. API stores the file in Supabase Storage bucket `credit-reports`.
3. API creates a `credit_reports` row.
4. Status moves to `uploaded`, then `extracting_text`.
5. Extract text from PDF or OCR image.
6. Status moves to `text_extracted`, then `analyzing`.
7. AI extracts negative items and analysis results.
8. Generate dispute letters when negative items support it.
9. Store dispute-letter PDFs in `dispute-letters`.
10. Status moves to `completed`, `failed`, or `needs_review`.
11. Email events are sent and logged.
12. Admin follow-up tasks are created for uploads, failures, completed analyses, and `needs_review` reports.
13. Daily cron monitors stale processing statuses and creates stalled-workflow admin tasks.
14. When dispute letters are generated, send the user a letters-ready email and initialize mailing/reminder dates.
15. Daily dispute-letter cron monitors mail reminders, secondary bureau reminders, and bureau response review windows.

## Statuses

- `uploaded`
- `extracting_text`
- `text_extracted`
- `analyzing`
- `completed`
- `failed`
- `needs_review`

## Rules

- Do not let email failure break upload or analysis.
- Do not expose technical errors to users.
- Log failures to `admin_activity` and email failures to `email_events`.
- Create admin tasks through `lib/admin/tasks.ts`; do not insert directly unless the helper is unavailable.
- Avoid duplicate open tasks for the same report and task type.
- Protect cron routes with `CRON_SECRET`; do not expose monitor endpoints publicly.
- Use `/api/cron/dispute-letter-monitor` for dispute-letter reminders; do not fold letter timing into the generic lifecycle monitor.
- Users should be able to mark a letter as mailed so the bureau-response review date can be calculated.
- Secondary bureau reminders should explain that one bureau dispute does not automatically cover every bureau file.
- Store extracted text and analysis JSON where schema supports it.
- Keep service-role Supabase usage server-only.
- Users can only access their own reports; admins can access all reports.

## Key Files

- `app/credit-upload/page.tsx`
- `app/api/upload-credit-report/route.ts`
- `lib/workflows/creditRepairWorkflow.ts`
- `lib/admin/tasks.ts`
- `lib/email/sendEmail.ts`
- `lib/system/logEvent.ts`
- `app/api/cron/credit-repair-monitor/route.ts`
- `app/api/cron/dispute-letter-monitor/route.ts`
- `lib/workflows/disputeLetterAutomation.ts`
- `vercel.json`
- `db/migrations/020-vestblock-ops-automation.sql`
- `db/migrations/022-create-admin-tasks.sql`
- `db/migrations/023-admin-task-automation-dedupe.sql`
- `db/migrations/027-dispute-letter-automation.sql`
