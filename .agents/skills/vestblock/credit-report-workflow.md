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
- Store extracted text and analysis JSON where schema supports it.
- Keep service-role Supabase usage server-only.
- Users can only access their own reports; admins can access all reports.

## Key Files

- `app/credit-upload/page.tsx`
- `app/api/upload-credit-report/route.ts`
- `lib/workflows/creditRepairWorkflow.ts`
- `lib/email/sendEmail.ts`
- `lib/system/logEvent.ts`
- `db/migrations/020-vestblock-ops-automation.sql`
