# Admin Dashboard Operator

Use this skill when maintaining or expanding VestBlock admin pages, metrics, RBAC, or operational views.

## Admin Routes

- Main dashboard: `/admin-panel`
- Data API: `/api/admin/dashboard`
- Status update API: `/api/admin/credit-reports/status`
- Task queue API: `/api/admin/tasks`
- Existing leads admin: `/admin/leads`

## RBAC

Use `lib/auth/admin.ts`.

Admin access can come from:

- `user_profiles.role = 'admin'`
- `ADMIN_ALERT_EMAIL`
- `NEXT_PUBLIC_ADMIN_EMAIL`

Never trust client-only role checks for sensitive data. Server API routes must verify admin access before using the service role client.

## Dashboard Sections

- Overview metrics
- Credit Repair Command Center
- User Management
- Alerts / Notifications
- Tasks
- Activity
- Payments / Leads

## Task Queue

Use `admin_tasks` for durable follow-up work. Prefer creating tasks through `lib/admin/tasks.ts` so workflow events are deduplicated.

Task creation should happen when:

- A new credit report is uploaded.
- A credit analysis fails.
- A credit analysis completes and needs customer follow-up.
- An admin marks a report `needs_review`.
- A funding or paid customer event needs human follow-up.

Keep task titles action-oriented and include `entity_type` / `entity_id` whenever the task belongs to a report, user, lead, or payment.

## Data Safety

- Do not expose signed file URLs unless admin access is verified.
- Keep service-role Supabase keys server-only.
- Keep tables scannable and operational.
- Avoid decorative redesigns unless they improve admin workflows.

## Adding Metrics

Prefer deriving metrics from:

- `credit_reports`
- `analysis_jobs`
- `dispute_letters`
- `email_events`
- `payments`
- `leads`
- `admin_activity`
- `admin_tasks`
