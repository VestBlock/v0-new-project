# VestBlock Agent Board

Last updated: 2026-05-14

This is the operating board for improving VestBlock without re-discovering the whole repo every time. It turns “use more agents” into a disciplined system: each director owns a layer, starts from known files, and verifies results before claiming progress.

## Prime Directive

VestBlock wins by becoming easier to trust, easier to buy from, easier to follow up with, easier to discover, and easier to operate. The board exists to make those five things better every sprint.

## Board Seats

### Chair: Sprint Orchestrator

- Skill: `.agents/skills/vestblock/nexus-sprint-orchestrator.md`
- Owns: focus, sequencing, scope control, verification.
- First reads: `docs/CODEX_FAST_CONTEXT.md`, `docs/CODEX_TASK_PLAYBOOK.md`, `docs/codex-fast-index.json`.
- Output: current bottleneck, shipped fix, verification result, next bottleneck.

### Revenue Director

- Skill: `.agents/skills/vestblock/revenue-operations-operator.md`
- Owns: offers, pricing, CTA paths, payment readiness, admin follow-up.
- First files: `app/services/page.tsx`, `app/pricing/page.tsx`, `lib/services/serviceDirectory.ts`, `lib/payments/products.ts`, `components/pricing-section.tsx`.
- Standard: every service needs a clear buyer, problem, outcome, price or CTA, and next step.

### Conversion Director

- Skill: `.agents/skills/vestblock/agentic-conversion-operator.md`
- Owns: landing-to-form flow, thank-you pages, lead capture, buyer clarity.
- First files: `app/page.tsx`, `components/hero-section.tsx`, `components/service-cards.tsx`, `components/get-started-page.tsx`, public form routes.
- Standard: every page should answer what it is, who it helps, why it matters, and what to do next.

### Design Director

- Skill: `.agents/skills/vestblock/website-weakness-audit.md`
- Supports: `conversion-rate-auditor`, `information-architecture-editor`, `mobile-polish-auditor`, `premium-motion-director`, `trust-proof-placement`.
- Owns: premium feel, hierarchy, clickability, mobile polish, visible trust.
- First files: public pages, shared marketing sections, nav, cards, CTAs, forms.
- Standard: premium and modern, but never meme-coin, fake-proof, or animation-bloated.

### Visibility Director

- Skill: `.agents/skills/vestblock/ai-citation-growth-operator.md`
- Supports: `.agents/skills/vestblock/aeo-content-automation.md`, `.agents/skills/vestblock/seo-aeo-learning-loop.md`, `generated-page-language-auditor`.
- Owns: SEO/AEO/GEO, entity clarity, answer pages, proof pages, sitemap, llms.txt, indexing.
- First files: `lib/aeo/topics.ts`, `lib/seo/serviceSeoPages.ts`, `lib/seo/structuredData.ts`, `app/sitemap.ts`, `app/robots.ts`, `public/llms.txt`.
- Standard: useful buyer answers, honest proof, safe claims, no thin page spam.

### Outreach Director

- Skill: `.agents/skills/vestblock/signal-based-outbound-operator.md`
- Supports: `.agents/skills/vestblock/compliant-outreach-operations.md`, `.agents/skills/vestblock/outreach-optimization.md`, `.agents/skills/vestblock/lead-intelligence-operator.md`.
- Owns: lead quality, targeting, outreach copy, approval queue, follow-ups, 100/day readiness.
- First commands: `npm run outreach:scorecard`, `npm run outreach:preflight`, `npm run outreach:v3-tools`.
- Standard: quality conversations over raw volume. No-email leads are manual/export only.

### DealVault Director

- Skill: `.agents/skills/vestblock/dealvault-revenue-operator.md`
- Owns: demo agreement, proof certificate, milestone/payout clarity, smart contract proof claims.
- First files: `app/dealvault/`, `app/dealvault/demo/`, `lib/dealvault/`, `scripts/createDealVaultDemoPackage.ts`, `public/dealvault/`.
- Standard: proof and agreement tracking only. No escrow, custody, legal replacement, or tokenized ownership claims.

### Funding Director

- Skill: `.agents/skills/vestblock/funding-lead-automation.md`
- Supports: `.agents/skills/vestblock/funding-strategy-improvement.md`, `.agents/skills/vestblock/compliance-safe-credit-content.md`.
- Owns: funding-prep funnel, intake quality, compliant wording, dashboard continuity.
- First files: `app/funding/`, `app/real-estate-funding/`, `app/api/funding-lead/route.ts`, `lib/funding/`.
- Standard: help customers prepare and understand options; never guarantee approvals or outcomes.

### Performance Director

- Skill: `.agents/skills/vestblock/production-launch-verification.md`
- Supports: `vercel:nextjs`, `vercel:deployments-cicd`, `vercel:observability`, `vercel:agent-browser-verify`.
- Owns: build health, route health, app speed, heavy imports, cron load, Vercel deploy safety.
- First files: `app/layout.tsx`, `components/navigation.tsx`, `contexts/auth-context.tsx`, `vercel.json`, public page client components.
- Standard: make public pages lightweight before tuning deep internals.

### Security Director

- Skill: `.agents/skills/vestblock/security-privacy-audit.md`
- Supports: `security-best-practices`, `security-threat-model`, `supabase`, `vercel:env-vars`.
- Owns: auth boundaries, secrets, admin routes, private documents, compliance claims, payment/chain safety.
- First files: `middleware.ts`, `app/api/`, `lib/supabase/`, `lib/blockchain/`, payment routes.
- Standard: never expose keys, never put private raw deal data on-chain, never run live sends/payments/chain transactions without approval.

### Content Asset Director

- Skills: `presentations:Presentations`, `documents:documents`, `pdf`, `imagegen`, `trust-proof-placement`.
- Owns: pitch decks, PDFs, screenshots, graphics, diagrams, proof packets, social drafts.
- First files: `docs/pitch/`, `docs/sales/`, `public/proof/`, `public/sales/`, `scripts/createGrowthSalesAssets.mjs`.
- Standard: buyer-ready assets with honest proof. No fake testimonials, fake logos, or fake metrics.

## Agent Delegation Rules

- Use explorer agents for independent read-only investigations.
- Use worker agents only when file ownership is clear and disjoint.
- Keep live sends, payments, chain transactions, and secret handling in the main thread.
- The main Codex session owns integration, tests, deployment, and final truth.

## Board Review Cadence

- Daily: Outreach, Visibility, Conversion, Performance quick checks.
- Weekly: Revenue packaging, DealVault demo, Funding funnel, Security route review.
- Before deploy: Performance and Security must verify build, route health, and risky actions.

## What Other Skills Help VestBlock

- GitHub: branch hygiene, PR summaries, CI fixes, review comments.
- Vercel: deploys, logs, env checks, cron/debug, route verification.
- Gmail: inbox triage, reply detection, bounce review, follow-up drafting.
- Browser/Playwright: local and live funnel QA, screenshots, form testing.
- Supabase: schema, auth, RLS, lead/admin data, query health.
- Presentations/Documents/PDF/Image: pitch decks, sales packets, demo agreements, graphics.
- Security skills: threat models, privacy reviews, safe env handling.
- Skill creator/plugin creator: turn repeatable workflows into reusable Codex skills or plugins.

## Board Output Format

For serious website optimization runs, report:

1. Board members used
2. Layer reviewed
3. Bottleneck found
4. Files changed
5. Checks run
6. Business effect expected
7. Next director to activate
