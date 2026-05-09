# GitHub Agent Integrations

Last updated: 2026-05-03

## Installed Now

### `vercel-labs/lead-agent`

Local reference clone:

- `vendor/lead-agent`

Why it was chosen:

- strongest fit for VestBlock's inbound lead qualification problem
- built around workflows, qualification, research, and human approval
- easier to adapt into the current app than to run as a separate product

What was actually wired into VestBlock:

- a lead-agent-style qualification layer in:
  - `lib/ai/leadAgentQualification.ts`
  - `app/api/admin/leads/[id]/ai-summary/route.ts`
  - `components/admin/lead-detail-client.tsx`

What this gives us:

- qualification category
- research summary
- missing-information list
- recommended operator action
- approval recommendation
- best channel guidance

## Strong Future Candidates

### `OpenOutreach`

Why it may help:

- outbound automation ideas
- signal-based prospecting
- browser-assisted research patterns

Why it is not installed yet:

- higher operational and platform-risk profile
- more useful after contactability and send quality are tighter
- better as a pattern source than a full drop-in install

### Slack approval agent templates

Why they may help:

- strong human-in-the-loop approval patterns
- useful for faster operator review on outreach, partner routing, and service fulfillment

Why not installed yet:

- Slack is not the main bottleneck today
- current biggest gains are still in contactability, send routing, and qualification

## Not Worth Installing Right Now

Skip agents that:

- create a separate CRM or separate admin system
- over-index on social or LinkedIn automation before email/contact quality is fixed
- require heavy new infrastructure without improving the current bottleneck

## Rule For Future Installs

Only bring in a GitHub agent when it does at least one of these:

- increases qualified lead throughput
- improves contactability
- improves routing to funding, buyer, lender, or service offers
- improves approval and fulfillment speed
- improves repeatable verification of live flows

If it does not help one of those, do not install it just because it looks advanced.
