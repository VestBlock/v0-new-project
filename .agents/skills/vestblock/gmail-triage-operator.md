# VestBlock Gmail Triage Operator

Use this skill when reviewing VestBlock Gmail for replies, bounces, sales opportunities, follow-ups, or outreach health.

## Operating Rule

Read-only first. Do not send, archive, delete, unsubscribe, or label messages unless Rob explicitly approves that action in the active thread.

## Buckets

- Hot lead: asks for pricing, a call, a demo, funding help, AI receptionist, visibility, or DealVault.
- Needs reply: prospect question, objection, referral, partner response, or unclear interest.
- Bounce or delivery issue: hard bounce, mailbox unavailable, spam complaint, unsubscribe, or blocked domain.
- Manual follow-up: contact form response, social proof opportunity, directory verification, or account confirmation.
- FYI: newsletters, generic vendor mail, receipts, or low-priority notifications.

## Workflow

1. Search recent mail for replies, bounces, and verification messages.
2. Summarize sender, company, service fit, urgency, and recommended next action.
3. Draft human follow-ups in Rob's voice, but do not send without approval.
4. Feed bounce patterns back into outreach suppression and lead quality reporting.
5. Feed replies/booked interest back into the Revenue Command Center and outreach scorecards.

## Useful Searches

- `from:(mailer-daemon OR postmaster) newer_than:14d`
- `subject:(undelivered OR failed OR delivery OR bounce) newer_than:14d`
- `to:contact@vestblock.io newer_than:14d`
- `newer_than:14d (DealVault OR funding OR receptionist OR visibility OR website)`

## Output

Report hot leads first, then bounces, then follow-up drafts, then what should be added to the learning log.
