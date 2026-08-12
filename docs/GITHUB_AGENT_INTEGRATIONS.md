# GitHub Agent Integrations

Last updated: 2026-08-10

## 2026-08-10 Strategy Toolbelt Addition

Six governed GitHub sources are now available as shallow local reference
clones under `vendor/toolbelt/`:

- `usestrix/strix`
- `Anil-matcha/Open-Generative-AI`
- `every-app/open-seo`
- `ayghri/i-have-adhd`
- `petergyang/no-ai-slop`
- `lfnovo/open-notebook`

`i-have-adhd` and `no-ai-slop` were also installed as global Codex skills.
The other four repositories remain reference-ready until their runtime,
credentials, provider costs, data policy, and authorized scope are explicitly
approved. They are not bundled into the VestBlock application.

The lane map, verified commits, activation gates, privacy rules, and refresh
procedure live in `docs/VESTBLOCK_GITHUB_TOOLBELT.md`.

## 2026-06-12 Agent Infrastructure Review

Current rule: VestBlock already has the command center, boss layer, analyzer,
outreach system, DealMachine workflows, partner discovery, and mailbox monitor.
Do not add a broad agent framework unless it improves one bounded revenue
workflow without creating a second command center or second CRM.

### `Conway-Research/automaton`

Repository:

- `https://github.com/Conway-Research/automaton`

Decision:

- Do not install the runtime into VestBlock.
- Borrow selected safety and operating patterns.

Useful ideas to adapt:

- policy engine before tool execution
- prompt-injection checks for external emails, scraped pages, and form data
- spend caps and rate limits for paid data/API/actions
- heartbeat health checks with clear wake conditions
- audit logs for self-improvement, tool installs, outreach, and contract actions
- protected files/rules that agents cannot rewrite casually

Not a fit right now:

- self-replication
- autonomous wallet-funded survival
- agent-owned domains
- unrestricted self-modification
- sovereign runtime inside production

VestBlock take:

- Conway is interesting as an autonomy lab, but our system should stay
  operator-led. Use its guardrail architecture, not its autonomy model.

### `OpenHands/OpenHands`

Decision:

- Useful as an external coding worker later.
- Do not embed in the VestBlock product.

Best use:

- isolated engineering chores
- scraper prototypes
- test-writing
- issue-to-PR automation in a sandbox

Guardrail:

- no live mailbox, outreach, payment, contract, or production database write
  access by default

### `crewAIInc/crewAI`

Decision:

- Borrow role and handoff patterns.
- Do not add a Python crew runtime unless a specific offline job needs it.

Best use:

- acquisition -> underwriting -> routing -> outreach play design
- research team decomposition
- partner discovery quality checks

VestBlock take:

- CrewAI's mental model is close to our agent lanes, but installing it would
  duplicate what the command center already expresses.

### `langchain-ai/langgraph` / LangGraph.js

Decision:

- Strong future candidate for one bounded pilot.
- Do not rewrite the command center around it yet.

Best use:

- durable, stateful deal-routing workflows
- seller reply triage state machine
- long-running human-in-the-loop offer workflow

First acceptable pilot:

- seller reply -> classify -> request missing info -> analyze -> route -> draft
  offer -> operator approval

### `FoundationAgents/OpenManus`

Decision:

- Skip runtime for now.

Why:

- broad prototype-oriented agent shell
- less valuable than our existing TypeScript workflows plus targeted MCP access

### `openclaw/openclaw`

Decision:

- Skip runtime for now.
- Borrow the always-on assistant/canvas idea only.

Why:

- overlaps with our Codex console, Outlook monitor, browser control, and
  command-center canvas
- broad email/browser/file permissions are too risky for an acquisitions inbox
  unless heavily gated

### MCP Servers

Decision:

- Highest-value direction, but only with strict permissions.

Best candidates:

- Supabase MCP for schema/query inspection and controlled admin operations
- GitHub MCP for repo/issue/PR context
- Outlook/Gmail connectors for mailbox monitoring and reply drafting
- browser/data connectors for public research and source collection

Guardrails:

- read-only first
- explicit approval for sends, database writes, contracts, spend-bearing data
  calls, and production changes
- audit every agent action
- never let an external email or scraped page become instructions

Recommended near-term stack:

1. Existing VestBlock command center and boss layer
2. Codex embedded in the command center
3. MCP-style connectors with least privilege
4. Conway-style policy, audit, spend, and injection guardrails
5. One LangGraph.js pilot only when a specific workflow needs durable state

Skip for now:

- broad autonomous runtimes
- self-replicating agents
- another multi-agent dashboard
- duplicate Python orchestration unless it has a clear isolated job

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
