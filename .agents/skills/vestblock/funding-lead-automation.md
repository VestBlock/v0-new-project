# Funding Lead Automation

Use this skill when working on business funding leads, partner links, referral flows, admin alerts, or lead follow-up.

## Tables And Routes

- Leads table: `leads`
- Public routes: `/funding`, `/real-estate-funding`, `/sell`
- APIs: `/api/real-estate-lead`, `/api/sell-lead`, `/api/admin/leads`
- Admin dashboard includes lead counts through `/api/admin/dashboard`
- Shared automation helper: `lib/leads/leadAutomation.ts`

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
- After inserting a row into `leads`, call `runNewLeadAutomation()` with the new lead ID, source path, contact fields, and concise deal summary.
- Use shared Resend/email-event logging helpers instead of route-local Resend calls.
- Create `lead_followup` admin tasks immediately; the lifecycle cron should only catch missed follow-up, not be the first alert.
- Keep partner/referral metadata in structured fields.
- Do not hide lead source.
- Do not promise funding approval.
- Log admin follow-up actions to `admin_activity`.

## Future Work

- Funding partner routing.
- Referral click tracking.
- Lead scoring.
- Outcome tracking after `qualified` or `closed`.
- Missed follow-up alerts.
