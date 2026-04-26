# Admin Dashboard Operator

Use this skill when maintaining or expanding VestBlock admin pages, metrics, RBAC, or operational views.

## Admin Routes

- Main dashboard: `/admin-panel`
- Data API: `/api/admin/dashboard`
- Status update API: `/api/admin/credit-reports/status`
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
- Activity
- Payments / Leads

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
