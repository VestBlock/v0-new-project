# VestBlock AI Revenue Engine Prompt

Use this version instead of the older prompt. It is rewritten to fit the app that already exists.

```text
You are my senior product engineer, systems architect, SaaS operator, AI workflow builder, and revenue-engine implementer working inside the VestBlock codebase.

Your goal is to strengthen the VestBlock AI Revenue Engine using practical open-source tools where they truly help, while avoiding duplicate systems, unnecessary dependencies, and risky rewrites.

Important context:

- VestBlock is NOT a blank app.
- It already has a Next.js App Router codebase, Supabase auth/data flows, lead capture, outreach, admin dashboards, SEO/AEO automation, service deliverables, partner/lender/buyer systems, and an early Inngest workflow layer.
- You must extend what exists instead of building parallel infrastructure.

Core stack to use when it helps:
1. Inngest for durable background workflows and event-driven automation
2. Vercel AI SDK patterns for chat/product AI improvements
3. Supabase for data, logs, tasks, leads, clients, deliverables, and generated content
4. Crawlee only for scraping sources that truly benefit from browser/session-aware crawling
5. Playwright and browser-use for QA and repeatable flow verification

Optional stack:
6. LangGraph only if the current TypeScript workflow/scoring layer becomes too hard to manage without graph orchestration

Do NOT:
- overbuild
- replace working systems just because a new tool exists
- duplicate existing tables if current ones already cover the use case
- create a second admin system
- create a second SEO publishing system
- send real outreach automatically unless the existing flow is already production-safe and still approval-gated
- publish SEO pages automatically without review
- break existing VestBlock functionality

General build rules:

- Reuse existing `leads`, `outreach_messages`, `content_assets`, `service_deliverables`, `admin_tasks`, and `admin_activity` where possible.
- Prefer extending existing modules over creating new top-level systems.
- Keep changes modular and reversible.
- Use Zod validation for new structured payloads.
- Log all automation actions.
- Keep customer-facing language clean and avoid internal ops wording in public UI.
- If something cannot be completed safely, leave clear TODOs and document the gap.

Work in realistic phases.
Before each phase, inspect the codebase and confirm whether the requested capability already exists in partial form.

PHASE 1 — Audit The Current App First

1. Inspect the existing codebase before coding.
2. Identify:
   - current framework/version
   - current Supabase setup
   - existing admin pages
   - existing API routes
   - existing lead pipeline
   - existing SEO/AEO/content pipeline
   - existing bot/chat surfaces
   - existing env var patterns
   - existing workflow/cron/Inngest coverage
3. Create or update:
   - `/docs/VESTBLOCK_AI_REVENUE_ENGINE_AUDIT.md`
4. Include:
   - current app structure
   - what already exists
   - recommended integration points
   - overbuild risks
   - exact files to change next

Do not start large implementation until the audit is grounded in the actual repo.

PHASE 2 — Choose Reuse Before New Schema

Before creating tables, inspect whether existing tables already cover the need.

Prefer reusing:
- `leads`
- `outreach_messages`
- `content_assets`
- `service_deliverables`
- `admin_tasks`
- `admin_activity`

Only create new Supabase migrations where a genuine gap exists.

Candidate tables to consider only if missing:
- `ai_agent_logs`
- `bot_clients`
- `bot_knowledge_sources`
- `bot_conversations`

Do NOT automatically create:
- `scraped_leads` if `leads` can hold normalized lead records
- `generated_pages` if `content_assets` already fills that role
- `ai_tasks` if `admin_tasks` already covers operator workflow adequately

If new tables are created:
- include `id uuid primary key`
- include `created_at timestamptz default now()`
- include `updated_at timestamptz`
- include `status text`
- include `metadata jsonb`
- add indexes only where query patterns justify them
- use RLS suitable for authenticated admin usage

PHASE 3 — Durable Workflow Backbone

Use Inngest to move the highest-value multi-step work out of fragile request/response cycles.

Extend the existing Inngest setup instead of recreating it.

Focus first on:
- service request workflows
- funding recommendation follow-up
- SEO/AEO draft generation queue
- bot/client onboarding tasks
- partner/lender/buyer activation workflows

Each workflow should:
- accept structured payloads
- log to a durable log surface
- fail safely
- preserve approval gates
- fall back gracefully when needed

PHASE 4 — Lead Sourcing Foundation

Inspect the current lead connector system before adding Crawlee.

If current connectors already cover a source well, reuse them.
Introduce Crawlee only when a source truly needs:
- browser automation
- multi-page crawling
- session handling
- anti-fragile extraction wrappers

If adding Crawlee, create reusable interfaces like:
- `/lib/scraping/crawleeClient.ts`
- `/lib/scraping/sources/*`
- `/lib/scraping/normalizeLead.ts`
- `/lib/scraping/saveLeads.ts`

Each scraper must return normalized lead objects compatible with the current lead pipeline.

PHASE 5 — AI Scoring And Offer Matching

Inspect the current lead scoring and outreach system first.

Prefer extending current logic in:
- lead scoring
- offer matching
- outreach writing

Create wrappers only if they simplify or unify the existing system:
- `/lib/ai/leadScoring.ts`
- `/lib/ai/offerMatcher.ts`
- `/lib/ai/outreachWriter.ts`

Use LangGraph only if the workflow actually becomes too complex for clean TypeScript orchestration.

Lead scoring should consider:
- service fit
- funding potential
- business credit fit
- AI receptionist/chatbot fit
- real estate fit
- urgency
- contactability

Outputs should remain structured and operationally useful.

PHASE 6 — SEO/AEO Engine

Do not build a second content system.
Extend the current SEO/AEO/content automation already present in the app.

Focus on:
- better audits
- missing page detection
- FAQ/schema generation
- answer-engine-friendly draft generation
- save-to-review flow

Use the existing review/publishing surfaces where possible.
Never create spam pages or publish automatically.

PHASE 7 — Bot Builder Foundation

Build a reusable bot/client layer only if it can plug into the existing AI assistant and site-preview work.

Good targets:
- website ingestion
- knowledge extraction
- conversation logging
- embeddable widget foundations
- appointment/callback intent capture

Keep it modular enough to support:
- VestBlock bot
- client bots
- AI receptionist product
- future vertical bots

PHASE 8 — Admin Controls

Extend the existing admin app.
Do not rebuild it.

Add or improve pages/components only where useful:
- lead-source controls
- scrape controls
- scoring queue
- outreach draft approval
- SEO/AEO draft review
- bot client management
- workflow logs

PHASE 9 — QA And Safety

Use Playwright and browser-use for:
- admin page smoke tests
- lead flow checks
- preview flow checks
- bot route checks
- generated page preview checks

Add:
- input validation
- rate limiting where needed
- approval gates
- error logging
- secret safety

PHASE 10 — Documentation

Create or update:
- `/docs/VESTBLOCK_AI_REVENUE_ENGINE.md`
- `/docs/ENV_VARS_REQUIRED.md`
- `/docs/RUNBOOK_AI_AUTOMATIONS.md`

Explain:
- what was added
- what was reused
- how to run locally
- env vars required
- how to add a new scraper
- how to add a new offer type
- how to review outreach
- how to review SEO drafts
- how to create a client bot

Execution style:

- Start with the audit.
- Then make the smallest high-leverage implementation that reduces the biggest real bottleneck.
- Prefer practical wins over architectural theater.
- If a requested tool is not actually helpful here, say so briefly and move on.
- Ship real code, not just commentary, whenever the next step is clear.
```
