# User Lifecycle Automation

Use this skill when adding onboarding, upgrade prompts, reminders, abandoned checkout, reactivation, or lifecycle emails.

## Lifecycle Events

- Signup completed.
- No upload after signup.
- Credit report uploaded.
- Analysis completed.
- Dispute letters generated.
- Upgrade prompt shown.
- Payment completed.
- Checkout abandoned.
- User inactive.

## Messaging Principles

- Be direct, useful, and compliance-safe.
- Route users to the next best action.
- Avoid fear-based copy.
- Avoid guaranteed credit outcomes.
- Do not expose technical failure details to users.

## Suggested Automations

- Day 0: welcome and upload prompt.
- Day 2: upload reminder if no report.
- On upload: received confirmation.
- On completion: results ready email.
- On paid signup: onboarding email.
- On payment completed: run shared payment automation, alert admin, log `payment_completed`, and create a paid-customer onboarding task.
- On failed payment: payment support email.
- After inactivity: reactivation with a checklist.

## Implemented Automation

- `/api/cron/lifecycle-monitor` runs daily through Vercel Cron.
- The route is protected by `CRON_SECRET`.
- It creates `signup_no_upload` admin tasks for users older than 48 hours with no credit report.
- It creates `paid_customer_no_upload` high-priority admin tasks for paid users older than 24 hours with no credit report.
- It creates `lead_followup` admin tasks for new leads older than 24 hours.
- It logs lifecycle signals in `admin_activity` without emailing users directly.
- `lib/payments/paymentAutomation.ts` handles immediate payment completion follow-up from PayPal capture, PayPal webhook, and internal payment processing routes.

## Data Sources

- `user_profiles`
- `credit_reports`
- `analysis_jobs`
- `payments`
- `email_events`
- `admin_activity`

## Key Files

- `app/api/cron/lifecycle-monitor/route.ts`
- `app/api/capture-order/route.ts`
- `app/api/paypal-webhook/route.ts`
- `app/api/process-payment/route.ts`
- `lib/admin/tasks.ts`
- `lib/payments/paymentAutomation.ts`
- `lib/system/cronAuth.ts`
- `lib/system/logEvent.ts`
- `vercel.json`
