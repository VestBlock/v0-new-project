# Email Alert Automation

Use this skill when adding or fixing VestBlock emails, Resend usage, notification logging, or user/admin alert flows.

## Provider

VestBlock uses Resend through `lib/email/sendEmail.ts`.

Required env vars:

- `RESEND_API_KEY`
- `ADMIN_ALERT_EMAIL`
- `FROM_EMAIL`
- `NEXT_PUBLIC_SITE_URL`

Legacy fallback:

- `RESEND_EMAIL`
- `NEXT_PUBLIC_ADMIN_EMAIL`
- `WEB_HOST_URL`

## Current Email Events

- `admin_credit_report_uploaded`
- `user_credit_report_received`
- `user_analysis_completed`
- `admin_analysis_completed`
- `credit_analysis_failed`
- `new_paid_customer`
- `admin_payment_failed`
- `admin_abandoned_checkout`
- `admin_new_lead`
- `user_upload_reminder`
- `user_paid_upload_reminder`
- `admin_lead_followup`
- `user_dispute_letters_ready`
- `user_dispute_letter_mail_reminder`
- `user_dispute_secondary_bureau_reminder`
- `user_dispute_bureau_response_reminder`
- `admin_dispute_letter_followup`

## Rules

- Email functions should return results, not throw through the user flow.
- Log sent/failed/skipped messages to `email_events`.
- Log system-level email failure to `admin_activity`.
- Keep HTML simple and professional.
- Do not include credit report contents or sensitive full personal data in emails.
- Dispute-letter emails should tell users to review letters, attach supporting documents, use trackable mailing, and save bureau responses. Do not promise deletion, score increases, or guaranteed bureau action.

## Future Events

- Abandoned checkout.
- Upload reminder.
- Stuck analysis admin alert.
- Payment completion admin alert.
- Funding lead received.
- Inactive user reactivation.
