# Funding Lead Automation

Use this skill when working on business funding leads, partner links, referral flows, admin alerts, or lead follow-up.

## Tables And Routes

- Leads table: `leads`
- Public routes: `/funding`, `/real-estate-funding`, `/sell`
- Free funding checker: `/funding#free-eligibility-check`
- Card funding strategy route: `/funding/business-funding-strategy`
- Business setup route: `/business-setup`
- Spanish partner route: `/es/vestblock`
- Approved Spanish Bank Breezy URL: `https://Bankbreezy.com/es/Vestblock`
- APIs: `/api/funding-lead`, `/api/funding-strategy`, `/api/real-estate-lead`, `/api/sell-lead`, `/api/admin/leads`, `/api/admin/funding-strategy`
- Paid funding product: `funding_strategy_review`
- Strategy table: `funding_strategy_requests`
- Admin dashboard includes lead counts through `/api/admin/dashboard`
- Shared automation helper: `lib/leads/leadAutomation.ts`
- Strategy automation helper: `lib/funding/fundingStrategyAutomation.ts`
- Readiness scorer: `lib/funding/cardStacking.ts`

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
- For business funding strategy requests, save a `funding_strategy_requests` row first, then call `runFundingStrategySubmittedAutomation()`.
- Use readiness tiers:
  - `needs_prep`: explain why they are not funding-ready and route them to the $300 readiness plan.
  - `review_ready`: explain the cleanup items and allow the $300 readiness plan.
  - `strong_candidate`: route to funding partners or optional $300 strategy support, and prioritize admin follow-up.
- PayPal checkout must pass `productType: "funding_strategy_review"` and the `requestId`.
- Funding strategy payments must update `funding_strategy_requests.payment_status = 'paid'` and must not set `user_profiles.is_subscribed` unless the product is `vestblock_pro`.
- Use shared Resend/email-event logging helpers instead of route-local Resend calls.
- Create `lead_followup` admin tasks immediately; the lifecycle cron should only catch missed follow-up, not be the first alert.
- Create `funding_strategy_review` or `paid_funding_strategy_review` tasks for strategy requests.
- Keep partner/referral metadata in structured fields.
- Track Spanish partner clicks and leads separately when click tracking is added.
- Do not hide lead source.
- Do not promise funding approval.
- Do not tell customers they are approved, pre-approved, guaranteed, or certain to receive a specific limit.
- Do remind customers to review APRs, fees, repayment obligations, personal guarantees, and hard inquiries before any application.
- Log admin follow-up actions to `admin_activity`.

## Future Work

- Funding partner routing.
- Referral click tracking.
- Spanish Bank Breezy referral performance reporting.
- Lead scoring.
- Outcome tracking after `qualified` or `closed`.
- Missed follow-up alerts.
