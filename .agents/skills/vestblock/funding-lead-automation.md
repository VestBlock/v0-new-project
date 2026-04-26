# Funding Lead Automation

Use this skill when working on business funding leads, partner links, referral flows, admin alerts, or lead follow-up.

## Tables And Routes

- Leads table: `leads`
- Public routes: `/funding`, `/real-estate-funding`, `/sell`
- APIs: `/api/real-estate-lead`, `/api/sell-lead`, `/api/admin/leads`
- Admin dashboard includes lead counts through `/api/admin/dashboard`

## Lead Fields

Track:

- Lead type
- Status
- Name
- Email
- Phone
- Contact info JSON
- Form data JSON
- Notes
- Created/updated timestamps

## Automation Rules

- Alert admin when a high-intent lead arrives.
- Keep partner/referral metadata in structured fields.
- Do not hide lead source.
- Do not promise funding approval.
- Log admin follow-up actions to `admin_activity`.

## Future Work

- Funding partner routing.
- Referral click tracking.
- Lead scoring.
- Follow-up task creation.
- Missed follow-up alerts.
