# Support Retention Operator

Use this skill when improving customer follow-up, retention, support triage, reminders, reactivation, or admin task workflows.

## Support Signals

- Failed credit analysis.
- Report stuck in `uploaded`, `extracting_text`, or `analyzing`.
- Paid customer with no upload.
- User with upload but no completed analysis.
- Failed email event.
- Funding lead without follow-up.
- User with completed analysis but no dispute letters.

## Task Queue Pattern

Use `admin_activity` as the first durable task/event stream.

Recommended metadata:

- `priority`
- `assigned_to`
- `due_at`
- `status`
- `next_action`
- `user_email`
- `entity_id`

## Admin Workflow

- Show tasks in admin dashboard before adding a separate task app.
- Start with filters: failed, needs review, paid customer, funding lead, email failed.
- Let admins add notes to reports and user records.
- Avoid exposing support-only notes to regular users.

## Retention Automations

- Signup but no upload: reminder after 24-48 hours.
- Upload received: confirmation and expectation-setting.
- Analysis complete: results email and dispute-letter CTA.
- Paid customer with no activity: onboarding reminder.
- Inactive user: education-focused reactivation.

## Tone

- Helpful, calm, and practical.
- No guarantees of score increases.
- Encourage documentation, rights, and user-controlled next steps.
