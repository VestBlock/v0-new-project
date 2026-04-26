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
- On failed payment: payment support email.
- After inactivity: reactivation with a checklist.

## Data Sources

- `user_profiles`
- `credit_reports`
- `analysis_jobs`
- `payments`
- `email_events`
- `admin_activity`
