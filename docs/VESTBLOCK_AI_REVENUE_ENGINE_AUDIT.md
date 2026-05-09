# VestBlock AI Revenue Engine Audit

## Current App Snapshot

VestBlock is not a blank app. It already contains a meaningful revenue-engine foundation across:

- Next.js App Router application code in `app/`
- Supabase-backed lead, outreach, content, task, and deliverable workflows
- Admin surfaces in `app/admin/*`
- Extensive API route coverage in `app/api/*`
- Existing lead automation, scoring, and outreach systems in `lib/leads/*`
- Existing service deliverable generation in `lib/services/*`
- Existing SEO/AEO and PR automation in `lib/content/*`, `lib/seo/*`, and `lib/pr/*`
- Existing Inngest foundation in `lib/inngest/*` and `app/api/inngest/route.ts`

This matters because the AI Revenue Engine should extend these systems, not build parallel replacements.

## Framework And Runtime

- Framework: Next.js `15.5.15`
- React: `19.2.5`
- TypeScript app with App Router
- Styling/UI: Tailwind + Radix + custom components
- Package manager: `pnpm` via `corepack`

## Existing Supabase Setup

Current client/server pattern:

- Browser client: [lib/supabase/client.ts](/Users/mrsanders/Downloads/Codex%20Folder/lib/supabase/client.ts)
- Admin/service-role client: [lib/supabase/admin.ts](/Users/mrsanders/Downloads/Codex%20Folder/lib/supabase/admin.ts)
- Middleware-protected auth flow: [middleware.ts](/Users/mrsanders/Downloads/Codex%20Folder/middleware.ts)

Existing core tables and data surfaces already in use:

- `leads`
- `outreach_messages`
- `admin_tasks`
- `admin_activity`
- `content_assets`
- `service_deliverables`
- lender/buyer network tables from later migrations
- partner portal, PR engine, and SAM intelligence tables from later migrations

## Existing Admin Dashboard Surface

Admin app already exists and is more mature than a “Phase 8 from scratch” plan assumes.

Existing pages include:

- `app/admin/page.tsx`
- `app/admin/leads/page.tsx`
- `app/admin/lead-sources/page.tsx`
- `app/admin/scrape-runs/page.tsx`
- `app/admin/seo-opportunities/page.tsx`
- `app/admin/pr-engine/page.tsx`
- `app/admin/lenders/page.tsx`
- `app/admin/buyers/page.tsx`
- `app/admin/market-expansion/page.tsx`
- `app/admin/improvement/page.tsx`

The right move is to extend this admin surface, not create a second admin system.

## Existing API Surface

The current API surface is already broad.

High-value areas already present:

- Service request intake:
  - `app/api/ai-assistant-request/route.ts`
  - `app/api/visibility-expansion-request/route.ts`
  - `app/api/service-interest/route.ts`
  - `app/api/funding-lead/route.ts`
  - `app/api/real-estate-lead/route.ts`
  - `app/api/sell-lead/route.ts`
- Chat and assistant routes:
  - `app/api/chat/route.ts`
  - `app/api/chat-with-analysis/route.ts`
  - `app/api/chat-direct/route.ts`
  - `app/api/chat-simple/route.ts`
- Lead engine routes:
  - `app/api/leads/score/route.ts`
  - `app/api/leads/generate-outreach/route.ts`
  - `app/api/leads/scrape/*`
  - `app/api/cron/leads-*`
- SEO/content automation:
  - `app/api/cron/entity-seo-expansion/route.ts`
  - `app/api/cron/content-publisher/route.ts`
  - `app/api/admin/seo-opportunities/route.ts`
- Workflow layer:
  - `app/api/inngest/route.ts`

## Existing Environment Variable Pattern

The project already uses a consistent env pattern around:

- Supabase:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - fallback support for `SUPABASE_URL` / `SUPABASE_ANON_KEY`
- AI:
  - `OPENAI_API_KEY`
  - `OPENAI_CONTENT_MODEL`
- Outreach/email:
  - `RESEND_API_KEY`
  - `FROM_EMAIL`
  - `RESEND_EMAIL`
  - Google Workspace sender vars
- Lead sourcing:
  - `OUTSCRAPER_API_KEY`
  - `GOOGLE_PLACES_API_KEY`
  - `HUNTER_API_KEY`
  - `SAM_GOV_API_KEY`
- Automation:
  - `CRON_SECRET`
  - `INNGEST_EVENT_KEY`
  - `INNGEST_DEV`

`INNGEST_SIGNING_KEY` is not currently referenced in app code and should only be added when the deployed workflow path actually needs it.

## Recommended Integration Points

### 1. Extend Existing Lead Infrastructure

Use these existing files first:

- [lib/leads/repository.ts](/Users/mrsanders/Downloads/Codex%20Folder/lib/leads/repository.ts)
- [lib/leads/service.ts](/Users/mrsanders/Downloads/Codex%20Folder/lib/leads/service.ts)
- [lib/leads/scoring.ts](/Users/mrsanders/Downloads/Codex%20Folder/lib/leads/scoring.ts)
- [lib/leads/outreach.ts](/Users/mrsanders/Downloads/Codex%20Folder/lib/leads/outreach.ts)
- [lib/leads/connectors/](/Users/mrsanders/Downloads/Codex%20Folder/lib/leads/connectors)

Do not create a duplicate `scraped_leads` table unless the existing `leads` table proves structurally insufficient.

### 2. Use Inngest For Durable High-Value Workflows

Existing foundation:

- [lib/inngest/client.ts](/Users/mrsanders/Downloads/Codex%20Folder/lib/inngest/client.ts)
- [lib/inngest/events.ts](/Users/mrsanders/Downloads/Codex%20Folder/lib/inngest/events.ts)
- [lib/inngest/functions.ts](/Users/mrsanders/Downloads/Codex%20Folder/lib/inngest/functions.ts)
- [lib/inngest/serviceRequestWorkflow.ts](/Users/mrsanders/Downloads/Codex%20Folder/lib/inngest/serviceRequestWorkflow.ts)
- [app/api/inngest/route.ts](/Users/mrsanders/Downloads/Codex%20Folder/app/api/inngest/route.ts)

Recommended next expansions:

- funding recommendation follow-up
- bot/client onboarding
- SEO/AEO draft generation queue
- lender/buyer/partner post-activation workflows

### 3. Upgrade Chat With Vercel AI SDK Patterns, Not A Full Replacement

Current state:

- UI already uses `@ai-sdk/react`
- current chat routes are inconsistent in architecture

Best improvement path:

- standardize `/api/chat`
- add persisted conversations
- use Supabase-backed chat history
- adopt streaming and cleaner message primitives

Do not replace the whole app with a generic chatbot template.

### 4. Use Crawlee Selectively

Current reality:

- VestBlock already has custom lead connectors
- current sources include Outscraper, Google Places, state filings, code violations, and SAM-related ingestion

Recommended approach:

- introduce Crawlee only for sources where browser/session-aware crawling adds real value
- keep current normalized lead interface
- do not replace reliable API or static-source connectors with browser scraping just because Crawlee is available

### 5. Treat LangGraph As Optional

Current scoring and orchestration already exist in TypeScript.

Recommended rule:

- use a clean internal workflow first
- only add LangGraph if you genuinely need graph-style branching, memory, or tool orchestration that the current system cannot express cleanly

This is especially important because LangGraph would be another coordination layer on top of existing lead scoring and workflow logic.

### 6. Keep Playwright In The QA Lane

Best uses:

- admin flow checks
- page-preview verification
- post-submit success-state checks
- bot chat route smoke tests

Do not turn Playwright into the main scraping engine.

## What Should Not Be Built

These are the biggest overbuild risks in the original prompt:

- duplicating `leads` with `scraped_leads`
- duplicating `content_assets` with `generated_pages`
- duplicating `admin_tasks` with `ai_tasks` unless task semantics are truly different
- duplicating `admin_activity` with `ai_agent_logs` unless you need deeper structured run-step traces
- importing heavy orchestration frameworks before the current internal workflow layer is exhausted
- replacing working lead connectors with browser automation for no reason
- rebuilding admin from scratch

## Practical Risks

### Schema Duplication Risk

The app already has mature core tables. Parallel tables would create operator confusion and reporting drift.

### Workflow Drift Risk

There are already many cron routes and new Inngest wiring. If both are expanded without a clear boundary, logic can split between “old cron behavior” and “new event behavior.”

### Outreach Safety Risk

Outbound email is already real in this app. Any new automation must preserve approval and delivery-safety constraints.

### SEO Spam Risk

The app already has content and entity SEO automation. A second generator layer could create low-quality overlap unless it writes into the same review/publish system.

### Chat Architecture Risk

The current chat layer is uneven. A rushed chatbot rewrite could break working user flows if it is done as a transplant instead of a staged migration.

## Exact Files Recommended For The Next Pass

### Docs To Add

- `/docs/archive/VESTBLOCK_AI_REVENUE_ENGINE_PROMPT.md`
- `/docs/VESTBLOCK_AI_REVENUE_ENGINE.md`
- `/docs/ENV_VARS_REQUIRED.md`
- `/docs/RUNBOOK_AI_AUTOMATIONS.md`

### Existing Files To Extend

- [app/api/chat/route.ts](/Users/mrsanders/Downloads/Codex%20Folder/app/api/chat/route.ts)
- [app/chat/page.tsx](/Users/mrsanders/Downloads/Codex%20Folder/app/chat/page.tsx)
- [app/user-hub/page.tsx](/Users/mrsanders/Downloads/Codex%20Folder/app/user-hub/page.tsx)
- [lib/leads/repository.ts](/Users/mrsanders/Downloads/Codex%20Folder/lib/leads/repository.ts)
- [lib/leads/scoring.ts](/Users/mrsanders/Downloads/Codex%20Folder/lib/leads/scoring.ts)
- [lib/leads/outreach.ts](/Users/mrsanders/Downloads/Codex%20Folder/lib/leads/outreach.ts)
- [lib/content/entitySeoExpansion.ts](/Users/mrsanders/Downloads/Codex%20Folder/lib/content/entitySeoExpansion.ts)
- [lib/services/sitePreview.ts](/Users/mrsanders/Downloads/Codex%20Folder/lib/services/sitePreview.ts)
- [lib/inngest/functions.ts](/Users/mrsanders/Downloads/Codex%20Folder/lib/inngest/functions.ts)

### Likely New Files

- `/lib/ai/leadScoring.ts` only if it wraps and simplifies existing scoring logic instead of duplicating it
- `/lib/ai/offerMatcher.ts`
- `/lib/ai/outreachWriter.ts`
- `/lib/scraping/crawleeClient.ts`
- `/lib/scraping/sources/*` only for sources that genuinely benefit from Crawlee
- `/lib/bots/*` for reusable client bot foundations

### Migrations To Add Carefully

Add only if the current schema truly lacks them:

- `ai_agent_logs`
- `bot_clients`
- `bot_knowledge_sources`
- `bot_conversations`

Delay or skip unless proven necessary:

- `scraped_leads`
- `generated_pages`
- `ai_tasks`

## Recommendation

The right version of the AI Revenue Engine is:

- audit-first
- reuse-first
- workflow-safe
- approval-safe
- modular

It should use the current VestBlock app as the foundation, not treat it like a starter repo.
