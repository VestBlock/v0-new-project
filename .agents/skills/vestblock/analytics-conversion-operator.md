# Analytics Conversion Operator

Use this skill when adding analytics, conversion tracking, funnel diagnostics, or revenue attribution to VestBlock.

## Primary Funnels

- Visitor to signup.
- Signup to credit report upload.
- Upload to completed analysis.
- Completed analysis to dispute letter usage.
- Free user to paid upgrade.
- Funding page to lead submission.

## Events To Track

- `signup_started`
- `signup_completed`
- `credit_report_upload_started`
- `credit_report_uploaded`
- `credit_analysis_completed`
- `dispute_letters_generated`
- `checkout_started`
- `abandoned_checkout`
- `payment_completed`
- `funding_lead_submitted`
- `admin_followup_completed`

## Rules

- Do not send credit report text, SSNs, account numbers, or sensitive dispute details to analytics tools.
- Prefer server-side logging to `admin_activity` for operational events.
- Use privacy-safe client analytics for page and CTA events.
- Keep event names stable and lower snake case.

## Admin Metrics

- Reports uploaded by day.
- Completion rate.
- Failed analysis count.
- Paid conversion rate.
- Funding lead count.
- Email failure count.
- Stuck workflow count.

## Implementation Pattern

- Add a small event helper before adding vendor-specific SDKs.
- Keep analytics optional when env vars are missing.
- Document every event name in code or docs.
