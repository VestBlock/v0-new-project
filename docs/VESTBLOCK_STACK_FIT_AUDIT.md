# VestBlock Stack Fit Audit

This pass evaluates the outside tools and starter projects we discussed against the current VestBlock product and operations stack.

## Wired In Now

### Inngest

Best fit:
- Durable background work for customer-facing service requests
- Retryable automation after form submissions
- Cleaner separation between request/response UX and back-office processing

Why it fits VestBlock:
- The app already creates leads, generates deliverables, sends alerts, and runs many scheduled automations.
- Those actions are valuable, but several of them still run inline inside API routes.
- Inngest gives VestBlock a safer workflow layer for multi-step work that should survive retries and timing issues.

What is now implemented:
- `app/api/inngest/route.ts`
- `lib/inngest/client.ts`
- `lib/inngest/functions.ts`
- `lib/inngest/events.ts`
- `lib/inngest/serviceRequestWorkflow.ts`

Current workflows using it:
- `/api/ai-assistant-request`
- `/api/visibility-expansion-request`
- `/api/service-interest`

Current behavior:
- If Inngest is available, the request is queued into a durable workflow.
- If it is not available, VestBlock falls back to the existing direct processing path so submissions still complete.

### browser-use

Best fit:
- Live browser QA
- Click-through testing for the local app
- Catching broken form states and bad post-submit UX

Why it fits VestBlock:
- This project has a lot of customer-facing flows and product messaging that need repeated click-through verification.
- It is much more useful as a QA surface than as a runtime app dependency.

### Playwright

Best fit:
- Repeatable browser verification from the terminal
- Regression checks for forms, thank-you states, and dashboard entry paths

Why it fits VestBlock:
- It offsets manual QA work.
- It is especially useful once the highest-value flows are stable enough to script.

Recommended use:
- Keep it in the test and verification lane, not the runtime product bundle.

## Strong Pattern Source

### supabase-community/vercel-ai-chatbot

Reference:
- https://github.com/supabase-community/vercel-ai-chatbot

Best fit:
- Better streaming chat architecture
- Persistent chat history in Supabase
- Cleaner App Router + AI SDK chat patterns

Why it fits VestBlock:
- VestBlock already uses Supabase auth and `@ai-sdk/react`.
- The current `/api/chat` flow is still older and lighter than the rest of the product.
- This repo is a strong pattern source for the next assistant upgrade, especially for saved conversations and more software-like chat behavior.

Recommended extraction targets:
- persisted conversations
- message storage
- cleaner server route patterns
- stronger streaming UX

Do not do:
- full repo transplant
- replacing VestBlock product logic with generic template code

## Low Or Situational Fit

### next-seo

Reference:
- https://github.com/garmeeh/next-seo

Why it is lower fit here:
- VestBlock already uses App Router metadata, `sitemap.ts`, `robots.ts`, JSON-LD scripts, and `llms.txt`.
- The current SEO stack is already native to Next.js and easier to reason about than another abstraction layer.

Use only if:
- you want a shared JSON-LD component library badly enough to justify the extra dependency

Default recommendation:
- do not add it as a core dependency right now

### DocBank

Reference:
- https://github.com/doc-analysis/DocBank

Best fit:
- document layout analysis research
- model training or evaluation for complex PDF/document parsing

Why it is lower fit right now:
- VestBlock already has a working PDF/document pipeline for the product areas we are actively shipping.
- DocBank is much more useful for specialized document-layout modeling than for the current growth bottlenecks.

Use only if:
- document parsing quality becomes a bigger blocker than lead flow, service delivery, or product UX

## Conceptually Useful, But Not Verified As A Drop-In

### flyweel-agentic-seo-aeo-engine

Status:
- The exact package or repo name could not be verified cleanly during this pass.

What is still useful from the idea:
- automated citation-gap detection
- entity clarity checks
- recurring content opportunity discovery
- answer-engine monitoring

Why VestBlock already overlaps:
- `lib/content/entitySeoExpansion.ts`
- PR engine workflows
- service SEO pages
- `llms.txt`, `sitemap`, and structured-data coverage

Recommendation:
- absorb proven ideas into VestBlock’s existing SEO/AEO engine instead of importing an unclear dependency name

## Next Best Combinations

1. Use Inngest to expand durable workflows into:
- funding recommendation follow-up
- partner/lender/buyer onboarding
- client deliverable follow-up and reminders

2. Use the Vercel AI chatbot patterns to upgrade:
- `/api/chat`
- saved chat history
- customer workspaces with assistant memory

3. Use browser-use and Playwright together for:
- repeatable customer-funnel QA
- local verification after each major funnel change

4. Keep SEO native unless there is a specific structured-data gap:
- App Router metadata
- JSON-LD scripts
- sitemap/robots/llms

## Source Notes

- Supabase community Vercel AI chatbot repo describes itself as a Next.js AI chatbot template using the Vercel AI SDK plus Supabase auth and Postgres.
- Inngest’s current docs describe it as an event-driven durable execution platform for background jobs and multi-step workflows, with a Next.js App Router quick start using `Inngest`, `serve`, and `/api/inngest`.
- `next-seo` remains a real SEO helper library, but VestBlock already covers the main native Next.js SEO surfaces directly.
