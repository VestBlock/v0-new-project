# VestBlock Product Inventory

This inventory classifies the existing product before consolidation. `Status` describes the observed implementation, not commercial readiness. Database names are based on the repository migrations and data access layers; production schema must be verified before any migration.

Decision vocabulary: **KEEP**, **REFINE**, **MERGE**, **HIDE FROM PRIMARY NAV**, **DEPRECATE**, or **REMOVE ONLY IF PROVEN SAFE**.

| Feature / system | Primary routes | Backend dependency | Database / state dependency | Status | Recommended action |
| --- | --- | --- | --- | --- | --- |
| Global shell, home, brand, navigation | `/`, root layout | Next metadata, structured data, auth context, analytics providers | user session | Working; visually fragmented and heavy | **REFINE** into the Capital + Deals + Opportunity shell. |
| Authentication | `/login`, `/register`, `/forgot-password`, `/reset-password` | Supabase SSR/client, post-signup API, middleware | auth users, `user_profiles` | Working and smoke-covered guest gates | **KEEP + REFINE** presentation; do not replace auth. |
| Role onboarding / network intake | `/get-started`, `/user-hub`, `/roadmap`, `/api/dashboard/network-intake` | roadmap generator, signup growth system, network intake | profiles, roadmaps, network intake data | Working but overlaps several entry paths | **MERGE** behind progressive role + intent onboarding. |
| Business funding eligibility | `/funding`, `/funding/business-funding-strategy`, `/dashboard/funding` | funding lead, products, profile, progress, recommendation, applications, approvals APIs | funding requests, profiles, applications, approvals, payment-plan fields | Substantial working system | **KEEP + REFINE** as a primary Capital path. |
| Real-estate financing / DSCR intake | `/real-estate-funding`, `/real-estate-funding/thanks` | real-estate lead API, funding connectors, Google conversion tracking | real-estate/funding leads | Working public flow | **KEEP + REFINE** as Capital for investment property. |
| Lender network | `/lenders`, `/partners/lenders/[token]` | signup, match, portal, discovery, scoring, outreach, automation | lenders, lender programs/matches, portal access | Working engine and admin tools | **KEEP**; route borrowers through Capital and partners through role-aware onboarding. |
| Seller intake | `/sell`, `/sell/[market]` | sell lead API, seller component, lead routing and analytics | real-estate leads, leads, offer history | Working with local market pages | **KEEP + REFINE** under Deals; preserve market URLs. |
| Buyer / investor buy boxes | `/buyers`, `/partners/buyers/[token]` | signup, match, discovery, scoring, packets, portal | buyers, buy boxes, matches, portal access | Working engine | **KEEP + REFINE** under Deals. |
| Public deal discovery | `/deal-hunter` | property intelligence API and public deal-hunter component | property intelligence records/provider data | New/untracked but builds | **KEEP + REFINE** as the principal Find Deals discovery surface. |
| Property analyzer | `/property-analyzer`, `/analysis/results/[jobId]` | initiate-analysis, job-status, analyzer/report APIs, OpenAI-assisted analysis, PDF generation | analysis jobs/results, property reports | Working; property math test passes | **KEEP + REFINE** as “Analyze a deal.” |
| Property intelligence | `/deal-hunter`, `/admin/deal-hunter`, admin/property-intelligence APIs | adapters, scoring, import/export, DealMachine, Overpass/OSINT, outreach | property intelligence schema and provider records | Active implementation | **KEEP**, feature-flag public exposure, protect admin/provider controls. |
| DealVault public product | `/dealvault`, `/dealvault/demo`, `/dealvault/demo-record` | DealVault health, proof, certificate and activity APIs | DealVault tables and feature flag | Working public/demo surfaces | **KEEP + REFINE** as transaction trust layer. |
| DealVault workspace | `/dashboard/dealvault/*` | create/update/lock/pay/verify APIs | deals, milestones, proofs, payout splits, activity | Working and contract-backed | **KEEP**; primary job is advance the active opportunity. |
| Smart contracts | `/smart-contracts`, admin blockchain | viem, Hardhat, deployed-address configuration | Base/Polygon contracts and off-chain metadata | 4/4 contract tests pass | **KEEP**, hide technical surface from primary nav, require mainnet approval. |
| Credit report analysis | `/credit-upload`, `/credit-dashboard/[reportId]` | upload, document processing, extraction, OpenAI, status monitors | credit reports, analysis jobs, documents, storage | Substantial working system | **KEEP**, position only where it helps capital readiness. |
| Dispute letters | `/tools/dispute-letters`, `/tools/my-dispute-letters`, `/super-dispute` | generate/regenerate/PDF/status APIs and workflow monitor | dispute letters, documents | Working specialty tool | **HIDE FROM PRIMARY NAV**; place in Opportunities and signed-in workspace. |
| Business credit | `/tools/business-credit` | biz-credit engine, match, letter, regenerate API | business-credit assessments/documents | Working specialty tool | **KEEP + REFINE** under Capital readiness and Opportunities. |
| Grants | `/tools/grants` | grants match, letter, OpenAI API | grant requests/results | Working specialty tool | **KEEP + REFINE** under Opportunities; no funding guarantees. |
| Calculators | `/calculators` | property/deal formulas | client/local state | Lightweight utility | **KEEP**, cross-link from Capital and Deals. |
| Resource and learning library | `/resources`, `/resources/[slug]`, `/learn`, `/learn/[slug]` | service SEO pages, topic assets, structured data | code/content assets | 106+ generated learning paths | **KEEP**, audit language and internal links; do not change URLs casually. |
| Services and financial growth | `/services`, `/services/[slug]`, `/services/financial-growth` | service directory/packages, deliverables, preview services | service leads/deliverables | Broad and partially outside new top-level story | **HIDE FROM PRIMARY NAV**; curate relevant items into Opportunities. |
| Visibility expansion | `/visibility-expansion/*` | service request API, site preview, AEO/SEO tooling | service leads, content/proof assets | Working, smoke-covered | **KEEP** as a secondary business-growth opportunity, not a homepage pillar. |
| AI assistant / chat | `/ai-assistant`, `/chat` | OpenAI, chat/history, documents, assistant-request APIs | chat history, documents, service requests | Working; protected chat path | **HIDE FROM PRIMARY NAV**; expose contextually from workspace. |
| Pricing and paid offers | `/pricing`, service offer routes | PayPal order/capture/webhook, priced offers | payments, PayPal transaction data | Working payment foundation | **KEEP**, make pricing contextual to paid products rather than a primary platform door. |
| Affiliate / referral | `/affiliates/register`, pending page, `/partners/[partnerKey]/apply` | referral/partner APIs and analytics | affiliates, referrals, portal access | Working | **KEEP**, move to footer/account/partner context. |
| Main dashboard | `/dashboard`, `/dashboard/services`, `/profile` | auth/access, workspace activity, services/funding/DealVault APIs | profile, activity, requests, documents | Working but multiple workspace concepts overlap | **REFINE** around “what needs attention next.” |
| Admin command center | `/admin/command-center`, `/admin/revenue-command`, `/admin/*` | command center, boss agent, operating loops, reports, tasks | operational memory, tasks, reports, scoreboards | Large internal operating system | **KEEP**, do not spend rebrand time on dead-end cosmetics. |
| Lead CRM and outreach | `/admin/leads`, lead source/outreach routes and scripts | discovery, enrichment, compliance, scoring, outreach, Resend | leads, outreach, source-cost data | Active and safety-sensitive | **KEEP**, keep outside consumer IA; never enable sends as a design task. |
| Buyer/lender/investor operations | `/admin/buyers`, `/admin/lenders`, `/admin/investor-partnerships` | repository, discovery, scoring, matching, outreach | partner network tables | Active | **KEEP** as the engine behind Capital and Deals. |
| Market expansion and property sourcing | `/admin/market-expansion`, `/admin/deal-hunter` | DealMachine, Outscraper, RentCast, OSINT, market presets | source runs, markets, property records | Active and data-provider dependent | **KEEP**, preserve provider and cost governors. |
| Content / SEO / AEO engine | `/learn/*`, `/services/*`, cron content/visibility routes | content generator, entity SEO, indexing push, PR engine | content assets, topics, SEO opportunities | Extensive and active | **KEEP + REFINE** language; preserve canonical URLs, sitemap, robots, structured data. |
| SAM.gov opportunity intelligence | admin SAM APIs and scheduled jobs | SAM API, scoring, alerts, watchlists | SAM opportunities/watchlists | Internal/secondary opportunity system | **KEEP**, surface only when curated and relevant. |
| PR engine | `/admin/pr-engine`, PR cron routes | destination discovery, research, outreach preparation | PR opportunities/runs | Internal growth function | **HIDE FROM PRIMARY NAV**. |
| Background work | `/api/inngest`, 40+ `/api/cron/*` routes | Inngest, Vercel cron, cron auth, service modules | per-system operational tables | Extensive | **KEEP**; rebrand does not change schedules without separate review. |
| Analytics | global providers and server captures | PostHog client/server, Google Ads conversion | third-party event stores | Working but missing the three doorway events | **KEEP + REFINE**; add explicit capital/deals/opportunity starts and homepage CTA events. |
| Email and external integrations | API routes and service modules | Resend, Google Workspace, Hunter, Outscraper, Apify, DealMachine, RentCast, SAM, PayPal, OpenAI, Sentry | secrets and provider state | Configured through environment variables | **KEEP**, never expose values; audit failures separately. |
| PDF and document generation | analysis, DealVault, credit and dispute flows | `@react-pdf/renderer`, `pdf-lib`, parsers, OCR | documents, storage, generated artifacts | Working but broad | **KEEP**, test representative reports after UI changes. |
| Spanish landing page | `/es/vestblock` | funding/referral links, Google Ads | lead/payment analytics | Working standalone acquisition page | **KEEP**, later align brand without breaking campaign URLs. |
| Diagnostics/setup pages | `/auth-debug`, `/database-diagnostic`, `/credit-report-diagnostic`, `/setup-database` | privileged debug/setup APIs | auth/database configuration | Potentially sensitive and not customer product | **HIDE / DEPRECATE**, then remove only after access and usage proof. |
| Old business-setup / proof / growth-system surfaces | `/business-setup`, `/proof`, `/dealflow-growth-system` | legacy components/services | varies | Minimal or legacy-looking routes | **DEPRECATE OR MERGE** only after import, analytics, and backlink checks. |

## Primary consolidation decisions

1. Existing engines remain in place; the rebrand adds a routing layer, not parallel implementations.
2. Capital consolidates business funding, investment-property funding, lender matching, and readiness tools.
3. Deals consolidates deal discovery, seller intake, buyer criteria, property analysis, property intelligence, and DealVault entry.
4. Opportunities is curated: grants, business credit, resources, education, and selected partner services. It is not an undifferentiated tool directory.
5. Technical, admin, diagnostic, outreach, and automation surfaces stay out of primary navigation.
6. SEO pages and campaign URLs remain stable. Any future removal requires usage, dependency, and redirect evidence.

## Known debts outside visual scope

- Deal-memory test is not isolated from existing operational data.
- Lint has 89 warnings and should be reduced in touched files without broad risky rewrites.
- Homepage performance is below an acceptable financial-platform bar.
- Several setup/diagnostic routes should receive an explicit security/access review.
- The worktree contains overlapping homepage component experiments; only one final homepage composition should remain referenced.
