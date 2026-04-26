# Credit Repair QA Operator

Use this skill when testing VestBlock credit report upload, analysis, dispute-letter generation, admin review, and email workflow behavior.

## Test Paths

- Anonymous user visits `/credit-upload`.
- Authenticated free user starts upload or checkout.
- Paid user uploads a PDF.
- Upload API creates storage object and `credit_reports` row.
- Analysis moves through statuses.
- Dispute letters are created when negative items exist.
- Admin sees report in `/admin-panel`.
- Admin opens `/admin-panel/reports/[reportId]`.
- User receives upload confirmation and completion email when configured.

## Status Expectations

- New upload: `uploaded`.
- Extraction running: `extracting_text`.
- Text ready: `text_extracted`.
- AI running: `analyzing`.
- Done: `completed`.
- Recoverable issue: `needs_review`.
- Hard issue: `failed`.

## Failure QA

- Invalid file returns a useful user-safe error.
- Email failure does not fail upload.
- OCR/AI failure logs admin activity.
- Admin can mark a report `needs_review` or `failed`.
- Private file URLs are only generated server-side after admin access checks.

## Data Verification

Check:

- `credit_reports`
- `analysis_jobs`
- `analysis_results`
- `dispute_letters`
- `email_events`
- `admin_activity`
- Supabase Storage buckets: `credit-reports`, `dispute-letters`

## Do Not

- Do not use real customer reports for development tests.
- Do not expose raw credit report contents in logs or emails.
