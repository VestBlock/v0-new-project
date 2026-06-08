# VestBlock Agent Operating System

Last updated: 2026-05-14

## Purpose

VestBlock now has a small internal operator set adapted from the useful parts of the public `agency-agents` idea, but narrowed to the workflows that actually help this business make money.

These are not meant to be generic personalities.

They are operating prompts for:

- revenue-producing outreach
- AI/search visibility growth
- form-to-fulfillment conversion
- focused build sprints

## Installed Operators

### `agent-board-orchestrator`

Use for:

- board-of-directors style website optimization
- assigning specialist agents to layers
- coordinating parallel explorer/worker agents safely
- deciding which skill owns the next bottleneck

Primary output:

- board members used
- layer reviewed
- bottleneck found
- verification result

File:

- `.agents/skills/vestblock/agent-board-orchestrator.md`

### `self-evolution-operator`

Use for:

- ongoing bottleneck hunting
- turning live failures into durable fixes
- encoding learning into routes, automations, and docs
- keeping VestBlock improving without waiting for over-specified prompts

Primary output:

- learned signal
- shipped system change
- verification result
- next bottleneck

File:

- `.agents/skills/vestblock/self-evolution-operator.md`

### `ai-citation-growth-operator`

Use for:

- SEO / AEO / GEO visibility work
- citation-gap audits
- answer-engine prompt mapping
- partner / lender / buyer entity expansion

Primary output:

- lost-prompt map
- fix pack
- schema / page recommendations

File:

- `.agents/skills/vestblock/ai-citation-growth-operator.md`

### `signal-based-outbound-operator`

Use for:

- business lead outreach
- lender / buyer / partner relationship outreach
- tightening auto-send quality
- turning public signals into better opening angles

Primary output:

- stronger outreach angles
- cleaner send logic
- better routing by lead type

File:

- `.agents/skills/vestblock/signal-based-outbound-operator.md`

### `agentic-conversion-operator`

Use for:

- task-completion improvements
- form / thank-you / dashboard continuity
- small-business onboarding polish
- AI-agent-friendly action flows

Primary output:

- friction map
- completion-flow fixes
- better context preservation after submit

File:

- `.agents/skills/vestblock/agentic-conversion-operator.md`

### `nexus-sprint-orchestrator`

Use for:

- focused product or operations sprints
- one-bottleneck-at-a-time improvement loops
- quick shipping with verification

Primary output:

- bottleneck statement
- shipped fix
- verification result
- next sprint target

File:

- `.agents/skills/vestblock/nexus-sprint-orchestrator.md`

## How These Fit Existing VestBlock Skills

Use these together with existing internal skills:

- `agent-board-orchestrator`
- `self-evolution-operator`
- `seo-aeo-learning-loop`
- `outreach-optimization`
- `lead-intelligence-operator`
- `growth-automation-operator`
- `partner-offer-operator`
- `production-launch-verification`
- `dealvault-revenue-operator`

Simple rule:

- use the new operators for direction and sprint framing
- use the older skill files for domain-specific rules and existing system context

## What We Borrowed

Useful ideas borrowed from the referenced repository:

- specialized operator framing instead of one generic “marketing agent”
- signal-first outbound thinking
- AI citation / answer-engine visibility framing
- task-completion thinking for AI/browser traffic
- sprint-style orchestration instead of open-ended brainstorming

## GitHub Pattern Sources To Borrow From

Treat these as reference patterns, not code to paste into VestBlock:

- `supabase-community/vercel-ai-chatbot`: saved chat sessions, clean Supabase-backed AI routes, streaming UX patterns.
- `supabase-community/chatgpt-your-files`: document upload metadata, analysis pipeline shape, file-to-workflow patterns.
- `nextjs/saas-starter`: route protection, loading/error states, product app-shell discipline.
- `KolbySisk/next-supabase-stripe-starter`: billing-aware route gating and reusable Supabase helper structure.
- `addyosmani/agentic-seo`: answer-engine visibility audits, intent framing, AI-readable pages.
- `ihuzaifashoukat/llmoptimizer`: LLM discoverability, entity clarity, answer formatting QA.
- `agamm/pseo-next` and similar pSEO examples: only for safe topic structure, never thin page spam.

Default rule: extend existing VestBlock routes, tables, scripts, and admin surfaces. Do not create a parallel CRM, chat app, billing system, content system, or outreach stack.

## Parallel Agent Use

Use agents when Rob asks for delegation or when independent work can run safely in parallel:

- explorer agent for codebase mapping
- explorer agent for performance or security read-only checks
- worker agent only for disjoint, low-conflict file scopes

Do not delegate live sends, payments, chain transactions, or secret handling. The main Codex thread should integrate and verify results before claiming completion.

## What We Did Not Borrow

We did not import the whole agency concept into VestBlock.

We intentionally skipped:

- broad personality-heavy prompt packs with no operational tie to the app
- unrelated social/content agents that do not map to current revenue lanes
- generic orchestration that is not tied to live verification or database-backed work

## Recommended Next Uses

1. Run `agent-board-orchestrator` for whole-site optimization so each layer has an owner.
2. Run `self-evolution-operator` at the start of each build sprint so live bottlenecks drive the work.
3. Run `agentic-conversion-operator` on the real-estate funding and seller thank-you flows.
4. Run `signal-based-outbound-operator` on fresh buyer and lender outreach.
5. Run `ai-citation-growth-operator` on visibility, AI receptionist, and partner pages.
6. Run `nexus-sprint-orchestrator` for weekly “biggest bottleneck first” passes.
