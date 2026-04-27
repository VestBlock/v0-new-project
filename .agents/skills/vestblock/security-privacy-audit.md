# Security Privacy Audit

Use this skill when reviewing VestBlock for data exposure, auth mistakes, RLS issues, logs containing sensitive data, public debug routes, or production hardening.

## Sensitive Data

Treat these as private:

- Credit reports and extracted text.
- Analysis JSON containing accounts or personal data.
- Dispute letters.
- User names, emails, addresses, phone numbers.
- Payment IDs and transaction references.
- Supabase service-role keys, OpenAI keys, Resend keys, PayPal secrets.

## Required Checks

- Service-role Supabase client is server-only.
- Admin APIs call `checkAdminAccess()`.
- Debug/setup/test routes are admin-protected or removed.
- Raw SQL/setup APIs also require explicit env flags before execution.
- Storage buckets for credit reports and letters are private.
- RLS is enabled for user-owned tables.
- Users can only access their own reports and letters.
- Admin access is role-based through `user_profiles.role = 'admin'`.

## Logging Rules

- Do not log raw reports, extracted text, auth tokens, request bodies with secrets, or payment secrets.
- Log IDs, statuses, event names, and short error messages.
- Email failures should log to `email_events` and not break core workflows.

## Review Output

Lead with findings ordered by severity.

Include:

- File or route.
- Risk.
- Fix.
- Verification step.

## Locked Diagnostic Flags

Keep these unset in normal production:

- `ENABLE_ADMIN_SQL_CONSOLE`
- `ENABLE_DATABASE_SETUP_ROUTES`

Only enable temporarily for a specific recovery task, then redeploy with them removed.

If no issue is found, mention residual risks and missing tests.
