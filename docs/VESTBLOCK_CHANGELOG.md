# VestBlock Changelog

## 2026-05-02 Buyer + Lender Partner Portals

## Files Changed

- `db/migrations/044-create-partner-portal-access.sql`
- `lib/partners/portal.ts`
- `app/api/admin/partner-portal/route.ts`
- `app/api/portal/lenders/[token]/route.ts`
- `app/api/portal/buyers/[token]/route.ts`
- `app/partners/lenders/[token]/page.tsx`
- `app/partners/buyers/[token]/page.tsx`
- `components/partners/lender-partner-portal.tsx`
- `components/partners/buyer-partner-portal.tsx`
- `components/admin/partner-portal-link.tsx`
- `components/admin/lender-detail-client.tsx`
- `components/admin/buyer-detail-client.tsx`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Added an invite-only partner portal layer for both lenders and buyers.
- Added a dedicated `partner_portal_access` table with revocable access tokens, last-viewed timestamps, and submission tracking.
- Added admin-side portal link creation/rotation from lender and buyer detail pages.
- Added public partner dashboards at:
  - `/partners/lenders/[token]`
  - `/partners/buyers/[token]`
- Lender partners can now:
  - update contact info
  - update states served
  - update borrower box / fit notes
  - update credit, revenue, timing, DSCR, and loan range criteria
  - respond to borrower-fit opportunities
- Buyer partners can now:
  - update contact info
  - update markets served
  - update buy-box criteria
  - update price, ARV, distress, occupancy, and deal-type preferences
  - respond to property opportunities
- Portal submissions now feed back into the network engine by updating:
  - relationship stage
  - outreach status
  - partner profile metadata
  - lender/buyer match status

## Verification

- Applied `db/migrations/044-create-partner-portal-access.sql` to live Supabase.
- `corepack pnpm build`
- `npx tsc --noEmit`
- Production deploy passed:
  - `https://vestblock.io`
  - `dpl_HnQBYUyJ1W4nXaBizYzfdfND7Bgu`
- Live portal smoke tests passed for:
  - lender portal page load
  - buyer portal page load
  - lender portal API payload
  - buyer portal API payload
  - lender portal profile save
  - buyer portal profile save

## 2026-04-30 Legacy Analyze Report Retirement

## Files Changed

- `app/enhanced-credit-analyzer/page.tsx`
- `components/debug-report-analyzer.tsx`
- `docs/VESTBLOCK_SYSTEM_AUDIT.md`
- `docs/VESTBLOCK_CHANGELOG.md`
- deleted `app/api/analyze-report/route.ts`

## Features Added

- Retired the legacy `/api/analyze-report` route, which was no longer part of the production credit workflow and was still emitting misleading build-time Supabase configuration warnings.
- Redirected `/enhanced-credit-analyzer` to the maintained `/credit-upload` experience so older links keep working without duplicating credit-analysis logic.
- Rewired the admin-only `DebugReportAnalyzer` utility to use `/api/analyze-credit-direct` and format the structured response for easier manual QA.

## Verification

- `npx tsc --noEmit`
- `corepack pnpm build`

## 2026-04-30 Admin Dashboard Operator Snapshot

## Files Changed

- `app/api/admin/dashboard/route.ts`
- `app/admin-panel/page.tsx`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Added an operator snapshot section to the main admin dashboard with:
  - completed payment volume
  - approved funding tracked
  - paid funding reviews
  - overdue task count
  - high-priority task count
  - users who still have not uploaded a report
- Added weekly velocity tracking for new users, uploads, completed analyses, published SEO pages, and paid customers.
- Added an onboarding watchlist so admins can quickly open recent signups who still have zero uploads.
- Added task-lane summaries so the dashboard shows which work categories are piling up first.
- Added dispute-method mix visibility so the admin dashboard shows the live spread of generated credit-repair methods, not just total dispute-letter volume.

## Verification

- `npx tsc --noEmit`
- `corepack pnpm build`

## 2026-04-30 Method-Aware Credit Repair Alerts

## Files Changed

- `lib/email/sendEmail.ts`
- `lib/workflows/disputeLetterAutomation.ts`
- `lib/workflows/processCreditReportAnalysis.ts`
- `lib/admin/tasks.ts`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Upgraded dispute-letter customer/admin alerts so they no longer use the same generic language for every method.
- Added method-aware guidance for:
  - `Direct Furnisher Dispute`
  - `Method Of Verification`
  - `Statement Of Dispute`
  - `Identity Theft Block`
  - `Mixed File`
  - `Outdated Information`
  - `Personal Information Correction`
- Updated ready, mailing, secondary-bureau, bureau-response, and admin follow-up alerts to carry the active `letter_type` through the automation flow.
- Updated dispute-letter task metadata so admin task queues retain the selected letter method, not just the bureau and reminder stage.
- Updated the dispute-letters-ready email to include the methods generated for the customer instead of only a letter count.

## Verification

- `npx tsc --noEmit`
- `corepack pnpm build`

## 2026-04-28 Admin Queue + Funding Ops Cleanup

## Files Changed

- `app/admin/leads/page.tsx`
- `components/funding-admin-dashboard.tsx`
- `app/api/admin/dashboard/route.ts`
- `app/admin-panel/page.tsx`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Reworked the lead-management page into a real action queue with quick filters, stale-follow-up visibility, revenue-pipeline counts, and faster status progression for operators.
- Added last-touch timing to the lead table so overdue follow-up is visible without opening each record.
- Upgraded the funding admin view with a priority queue, operator-lane summaries, payment follow-up visibility, and quick preset filters for repair-first, build-first, apply-now, and pending-payment records.
- Tightened Action Center links so stale leads and funding-review items open closer to the actual work instead of dropping admins onto generic pages.

## Verification

- `corepack pnpm lint`
- `corepack pnpm build`
- `npx tsc --noEmit` after build artifacts were regenerated
- Live protected-route smoke checks on `/admin-panel` and `/admin/leads`

## 2026-04-28 Admin Action Center + System Health

## Files Changed

- `app/api/admin/dashboard/route.ts`
- `app/admin-panel/page.tsx`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Added an `actionCenter` payload to the admin dashboard API with failed analyses, stale reports, urgent tasks, failed emails, stale lead follow-up, funding items needing review, ready content, and data-source outage visibility.
- Added an Action Center block to the admin dashboard so operators can see failed report work, revenue follow-up, and queue health before diving into tabs.
- Added a System Health panel that surfaces automation failures and data-source outages more directly.

## Verification

- `corepack pnpm lint`
- `corepack pnpm build`
- Live smoke checks on `/admin-panel` and `/api/admin/dashboard`

## 2026-04-28 Admin Diagnostics Consolidation

## Files Changed

- `lib/admin/diagnostics.ts`
- `app/admin/test/page.tsx`
- `app/admin-panel/page.tsx`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Created a shared internal diagnostics registry so admin QA routes are grouped intentionally instead of living as disconnected operator pages.
- Rebuilt `/admin/test` into a proper admin diagnostics hub with grouped internal tools, operator guidance, and protected-route framing.
- Added a `Diagnostics` tab to the main admin panel so operators can reach auth, credit, upload, and system QA tools from one place.

## Verification

- `corepack pnpm lint`
- `corepack pnpm build`
- live smoke checks on `/admin/test`, `/admin-panel`, and protected diagnostic redirects

## 2026-04-28 Protected Route Indexing Cleanup

## Files Changed

- `middleware.ts`
- `app/sitemap.ts`
- `app/robots.ts`
- `components/analysis-result-client-view.tsx`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Removed authenticated-only routes like `/credit-upload` and protected tool pages from the public sitemap so search engines only get truly public discovery paths.
- Tightened `robots.txt` to disallow protected tool, dashboard, and internal analyzer routes from indexing.
- Added `X-Robots-Tag: noindex, nofollow, noarchive` headers to protected admin, dashboard, authenticated, and diagnostic pages at middleware level.
- Protected `/enhanced-credit-analyzer` behind authentication and routed failed-analysis retry CTA back to the main `/credit-upload` path instead of a side-route.

## Verification

- `corepack pnpm lint`
- `corepack pnpm build`
- live smoke checks on `/robots.txt`, `/sitemap.xml`, `/credit-upload`, and `/enhanced-credit-analyzer`

## 2026-04-28 Seller Metadata Alignment

## Files Changed

- `app/sell/layout.tsx`
- `app/sell/page.tsx`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Replaced the old `/sell` metadata so title, description, canonical, Open Graph, and Twitter copy now match the safer property-review funnel used in the page body.
- Removed an unused `MapPin` import while tightening the seller route.

## Verification

- `corepack pnpm lint`
- `corepack pnpm build`
- Live smoke checks were run after deployment on `/sell`

## 2026-04-28 Real Estate And Seller Funnel Cleanup

## Files Changed

- `app/real-estate-funding/page.tsx`
- `app/sell/page.tsx`
- `app/services/financial-growth/page.tsx`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Reframed the public real-estate funding page around deal review and funding routing instead of aggressive approval-style language.
- Added a clearer three-step explanation to the real-estate page so investors understand submit -> review -> route before they reach the form.
- Reframed the seller page around property review and sale-path evaluation instead of immediate cash-offer positioning.
- Tightened the seller trust copy so it focuses on fit, route, and follow-up instead of hard promises.
- Strengthened `/services/financial-growth` as the main paid-service upsell hub for funding, credit, grants, and real-estate cases that need manual review.

## Verification

- `corepack pnpm build`
- `corepack pnpm lint` passed with the existing warning-only repo profile
- Live smoke checks were run after deployment on `/real-estate-funding`, `/sell`, and `/services/financial-growth`

## 2026-04-28 Funding And Services Positioning Cleanup

## Files Changed

- `app/funding/page.tsx`
- `app/services/page.tsx`
- `lib/services/serviceDirectory.ts`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Reframed the public funding page around a more defensible ladder: free readiness check, paid prep when needed, and partner routing only after review.
- Removed weaker public trust signals from the funding page such as broad “funding facilitated” style metrics and replaced them with workflow explanation.
- Tightened the partner section copy so outside funding options are presented as partner paths, not implied approvals.
- Simplified the services page around a clearer offer ladder and more customer-facing “what happens next” language.
- Renamed the last public-facing short label from `Card Stacking` to `Funding Strategy` for consistency with the broader business-funding terminology shift.

## Verification

- `corepack pnpm build`
- `corepack pnpm lint` passed with existing warning-only output
- Live smoke checks were run after deployment on the updated funding and services routes

## 2026-04-28 Pricing + Navigation Simplification

## Files Changed

- `app/pricing/page.tsx`
- `components/navigation.tsx`
- `components/hero-section.tsx`
- `components/cta-footer.tsx`
- `app/robots.ts`
- `app/sitemap.ts`
- `lib/seo/llmFeed.ts`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Added a public `/pricing` page that explains VestBlock's free-first, paid-review, and assisted-support offer ladder.
- Simplified the public navigation to clearer customer-facing paths: credit repair, business funding, business setup, real estate, pricing, and learn.
- Updated the homepage hero and footer CTA copy so the site leads with credit repair, funding readiness, and business growth instead of older AI-assistant-first framing.
- Added `/pricing` to sitemap and robots coverage, and included it in the LLM-facing route map.

## Verification

- `corepack pnpm build`
- `corepack pnpm lint` passed with existing warning-only output
- `npx tsc --noEmit` needs to be run after build artifacts are present; the repo still has the same `.next/types` timing sensitivity when run concurrently

## 2026-04-28 Route Audit + Access Hardening

## Files Changed

- `app/access/page.tsx`
- `app/auth-debug/page.tsx`
- `components/auth-debug.tsx`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Replaced the old `/access` bypass screen with a server-side redirect to `/login` so it can no longer be used as a public entry point.
- Removed stale bypass-auth guidance and actions from the auth debug surfaces.
- Re-ran a production route audit covering public pages, protected dashboard routes, admin routes, diagnostic routes, and legacy funding/service redirects.

## Verification

- `corepack pnpm build`
- Production deploy completed at `https://vestblock.io`
- Live route checks confirmed `/access` now redirects to `/login`
- Live route checks confirmed protected dashboard/admin/debug routes redirect to login when unauthenticated
- Live route checks confirmed legacy redirects still forward to `/funding/business-funding-strategy` and `/services/business-funding-strategy`

## 2026-04-28 AEO Topic Publishing + Content Ops

## Files Changed

- `lib/content/topicSeedAssets.ts`
- `app/api/admin/content/seed-topics/route.ts`
- `app/admin-panel/page.tsx`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Added a deterministic AEO topic publishing system driven by `lib/aeo/topics.ts` so topic pages can be published without waiting on OpenAI generation.
- Added `/api/admin/content/seed-topics` for admin-triggered topic-library publishing.
- Added a `Seed AEO Topic Library` action in `/admin-panel` -> `Content`.
- Added content-queue quick actions to copy published URLs, copy SEO markdown, and copy social post copy directly from the admin dashboard.
- Defaulted AEO topic seeding to non-destructive behavior so existing slugs are skipped unless an overwrite is explicitly requested.

## Verification

- Build/typecheck/lint verification was rerun after the new topic seeding and dashboard changes.
- Public resource pages and sitemap coverage were rechecked after publishing the topic library.

## 2026-04-28 Batch Content Publishing

## Files Changed

- `lib/content/seedAssets.ts`
- `app/api/admin/content/seed/route.ts`
- `app/admin-panel/page.tsx`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Added a reusable VestBlock batch content seeding system for launch-ready SEO pages and social posts.
- Added `/api/admin/content/seed` so admins can seed and publish curated content assets without depending on OpenAI generation.
- Added a `Seed And Publish Launch Content` action in `/admin-panel` -> `Content`.
- Published launch content directly into Supabase `content_assets` so public `/resources/[slug]` pages are available immediately.

## Content Published

Published SEO pages:

- `/resources/business-funding-readiness-checklist`
- `/resources/business-credit-building-starter-guide`
- `/resources/grant-readiness-for-small-businesses`
- `/resources/real-estate-funding-readiness-guide`
- `/resources/business-funding-strategy-working-capital-guide`
- `/resources/financiamiento-para-negocios-requisitos-clave`

Published social content assets:

- `business-funding-documents-instagram-post`
- `business-credit-mistakes-linkedin-post`
- `financiamiento-en-espanol-post`

## Verification

- `corepack pnpm build` passed and generated `112` pages.
- `npx tsc --noEmit` passed when run after build.
- `corepack pnpm lint` passed with existing warning-only output.
- Live public checks passed:
  - `https://www.vestblock.io/resources/business-funding-readiness-checklist`
  - `https://www.vestblock.io/resources/business-credit-building-starter-guide`
  - `https://www.vestblock.io/resources/financiamiento-para-negocios-requisitos-clave`
- Live sitemap includes the new resource URLs.

## 2026-04-28 Admin + Build Hardening Pass

## Files Changed

- `lib/supabase/client.ts`
- `app/api/admin/dashboard/route.ts`
- `app/admin-panel/page.tsx`
- `app/admin/funding/page.tsx`
- `components/funding-admin-dashboard.tsx`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Hardened the browser Supabase client so static prerendering no longer crashes when routes are rendered on the server during build collection.
- Expanded the main admin dashboard data API to include Funding Assistant profile, recommendation, approval, payment-plan, and approved-dollar metrics.
- Added Funding Assistant visibility to `/admin-panel` so the main operator dashboard now reflects the newer funding system instead of only the older funding-strategy flow.
- Added summary cards to `/admin/funding` for profiles, apply-now readiness, approvals, approved total, and active payment plans.
- Added safer query handling on `/admin/funding` so partial funding-table issues do not take down the whole page.
- Added the missing `hybrid_sequence` filter option in the funding admin pipeline.

## Verification

- `corepack pnpm build` passed with the current local environment state and generated `111` pages.
- `npx tsc --noEmit` passed when run after build completed.
- `corepack pnpm lint` passed with existing warning-only output.
- Local runtime smoke passed:
  - `/es/vestblock` returns `200`
  - `/admin-panel` redirects to `/login?redirect=%2Fadmin-panel`
  - `/admin/funding` redirects to `/login?redirect=%2Fadmin%2Ffunding`
  - `/dashboard/funding` redirects to `/login?redirect=%2Fdashboard%2Ffunding`
  - `/api/admin/dashboard` returns `401` when unauthenticated
  - `/test-openai-simple` now loads through middleware protection instead of breaking build prerender

## 2026-04-28 Funding Assistant

## Files Changed

- `db/migrations/028-create-funding-assistant.sql`
- `app/dashboard/funding/page.tsx`
- `app/admin/page.tsx`
- `app/admin/funding/page.tsx`
- `app/admin/leads/page.tsx`
- `app/admin-panel/page.tsx`
- `app/login/page.tsx`
- `app/register/page.tsx`
- `app/api/funding/profile/route.ts`
- `app/api/funding/recommendation/route.ts`
- `app/api/funding/products/route.ts`
- `app/api/funding/applications/route.ts`
- `app/api/funding/applications/[id]/route.ts`
- `app/api/funding/approvals/route.ts`
- `app/api/funding/progress/route.ts`
- `app/api/funding/payment-plan/route.ts`
- `components/funding-assistant-dashboard.tsx`
- `components/funding-admin-dashboard.tsx`
- `components/navigation.tsx`
- `app/dashboard/page.tsx`
- `lib/funding/types.ts`
- `lib/funding/strategy-engine.ts`
- `lib/funding/payment-plans.ts`
- `lib/funding/mock-data.ts`
- `lib/funding/repository.ts`
- `lib/funding/schemas.ts`
- `lib/funding/server.ts`
- `lib/funding/events.ts`
- `lib/auth/client-admin.ts`
- `lib/system/logEvent.ts`
- `middleware.ts`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Added the authenticated user route `/dashboard/funding` as the new VestBlock Funding Assistant experience.
- Added the protected admin route `/admin/funding` with funding-pipeline filters, approved-total tracking, and CSV export.
- Added an `/admin` landing route that cleanly redirects to `/admin-panel` instead of leaving a protected dead end.
- Added cross-links between `/admin-panel`, `/admin/funding`, and `/admin/leads` so the admin surfaces operate like one workspace.
- Added redirect-aware login and register pages so protected routes can send users back to the page they originally tried to open.
- Added middleware protection for core authenticated routes like `/dashboard`, `/profile`, `/roadmap`, `/user-hub`, and key tools, reducing client-side auth flicker.
- Added a shared client-side admin email helper so admin detection is consistent across navigation, dashboard, funding, grants, and dispute-letter screens.
- Added deterministic funding strategy scoring with mode-aware paths for `business`, `personal`, `hybrid`, `build_first`, and `repair_first`.
- Added tracked funding profile, recommendation, sequence item, payment-plan, and funding event APIs under `/api/funding/*`.
- Added manual approval logging, progress summaries, and sequence-status actions without auto-submitting any lender applications.
- Added funding payment-plan calculation for `software_access`, `strategy_report`, `assisted_funding_package`, and `custom_plan`.
- Added development mock profiles for strong business, weak personal, hybrid, and repair-first testing.
- Added a new Supabase migration that creates `funding_profiles`, `funding_products`, `funding_recommendations`, `funding_sequence_items`, `funding_payments`, and `funding_events` with RLS and seed products.
- Added build-safe hardening for several older OpenAI and Supabase route handlers so the app can build cleanly without eager runtime client initialization.
- Fixed the logged-out `/dashboard` experience so users are redirected toward login instead of getting stuck on a permanent loading state.
- Fixed protected-route return flow so a user sent to `/login?redirect=...` is no longer dropped into the wrong post-login page.

## Setup Required

- Run `db/migrations/028-create-funding-assistant.sql` in Supabase.
- Make sure Vercel has `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `OPENAI_API_KEY`.
- Stripe is not wired for this feature yet. Payment-plan records are saved, but checkout remains a placeholder until a Stripe helper is connected.

## Verification

- `npx tsc --noEmit` passed.
- `corepack pnpm lint` passed with existing warning-only output.
- `NEXT_PUBLIC_SUPABASE_URL=<configured> NEXT_PUBLIC_SUPABASE_ANON_KEY=<configured> SUPABASE_SERVICE_ROLE_KEY=<configured> OPENAI_API_KEY=<configured> corepack pnpm build` passed and generated `111` pages, including `/admin`, `/dashboard/funding`, and `/admin/funding`.
- Production smoke passed for protected-route redirects on `/dashboard`, `/dashboard/funding`, `/profile`, `/admin`, `/admin/funding`, and `/admin/leads`.

## 2026-04-28 Business Funding Terminology Cleanup

## Files Changed

- `app/funding/business-funding-strategy/page.tsx`
- `app/funding/business-funding-strategy/layout.tsx`
- `app/funding/credit-card-strategy/page.tsx`
- `app/services/[slug]/page.tsx`
- `app/funding/page.tsx`
- `app/funding/layout.tsx`
- `app/services/page.tsx`
- `app/sitemap.ts`
- `components/funding-eligibility-checker.tsx`
- `lib/content/marketingServices.ts`
- `lib/funding/cardStacking.ts`
- `lib/funding/fundingStrategyAutomation.ts`
- `lib/payments/products.ts`
- `lib/seo/llmFeed.ts`
- `lib/seo/serviceSeoPages.ts`
- `lib/seo/structuredData.ts`
- `lib/services/serviceDirectory.ts`
- `lib/services/financialSkillsets.ts`
- `lib/admin/tasks.ts`
- `app/admin-panel/page.tsx`
- `app/admin/leads/page.tsx`
- `docs/VESTBLOCK_AEO_PLAYBOOK.md`
- `docs/VESTBLOCK_AUTOMATION_ROADMAP.md`
- `docs/VESTBLOCK_SYSTEM_AUDIT.md`
- `.agents/skills/vestblock/funding-lead-automation.md`

## Features Added

- Replaced public-facing "credit card stacking" language with "Business Funding Strategy," "business credit lines," and "business credit funding" language.
- Added the clean customer route `/funding/business-funding-strategy`.
- Kept `/funding/credit-card-strategy` as a legacy redirect so old links continue working.
- Changed the SEO service guide slug to `/services/business-funding-strategy`.
- Kept `/services/credit-card-stacking-strategy` as a legacy redirect.
- Updated sitemap, LLM feed, service directory, admin labels, and payment return paths to use the cleaner business funding route.

## Verification

- `npx tsc --noEmit` passed.
- `corepack pnpm lint` passed with existing warning-only output.
- `OPENAI_API_KEY=sk-build-placeholder NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=build-placeholder SUPABASE_SERVICE_ROLE_KEY=build-placeholder NEXT_PUBLIC_SITE_URL=https://www.vestblock.io corepack pnpm build` passed and generated `109` pages.
- Local built smoke passed: `/funding/business-funding-strategy` and `/services/business-funding-strategy` return `200`; old `/funding/credit-card-strategy` and `/services/credit-card-stacking-strategy` redirect to the new routes; sitemap and `/llms.txt` list the new business funding strategy URL.
- Production deploy `dpl_7g7z8g9pXnHpp7GA8VYxAMyYFA81` passed and is aliased to `https://vestblock.io` and `https://www.vestblock.io`.
- Live smoke passed: `/funding/business-funding-strategy` and `/services/business-funding-strategy` return `200`; legacy funding and service URLs redirect to the new routes; sitemap and `/llms.txt` list the new business funding strategy URL.

## 2026-04-28 Dispute Letter Reminder Automation

## Files Changed

- `app/api/cron/dispute-letter-monitor/route.ts`
- `app/api/dispute-letters/[id]/status/route.ts`
- `app/api/admin/dashboard/route.ts`
- `app/tools/my-dispute-letters/page.tsx`
- `db/migrations/027-dispute-letter-automation.sql`
- `lib/admin/tasks.ts`
- `lib/email/sendEmail.ts`
- `lib/system/logEvent.ts`
- `lib/workflows/disputeLetterAutomation.ts`
- `lib/workflows/processCreditReportAnalysis.ts`
- `vercel.json`
- `docs/VESTBLOCK_AUTOMATION_ROADMAP.md`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Added dispute-letter-ready customer emails after credit analysis generates dispute letters.
- Added daily cron automation for mailing reminders, secondary bureau reminders, and bureau response-window follow-ups.
- Added admin tasks and admin follow-up alerts for dispute-letter workflows that need action.
- Added a customer-facing "mark mailed" action on `/tools/my-dispute-letters`.
- Added dispute-letter automation dates and metadata migration for Supabase.
- Added the dispute-letter reminder cron to the admin automation dashboard and Vercel cron schedule.

## Setup Required

- Run `db/migrations/027-dispute-letter-automation.sql` in Supabase before relying on live dispute-letter reminder automation.
- Redeploy Vercel so `/api/cron/dispute-letter-monitor` is scheduled.

## Verification

- `npx tsc --noEmit` passed.
- `corepack pnpm lint` passed with existing warning-only output.
- `OPENAI_API_KEY=sk-build-placeholder NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=build-placeholder SUPABASE_SERVICE_ROLE_KEY=build-placeholder NEXT_PUBLIC_SITE_URL=https://www.vestblock.io corepack pnpm build` passed and generated `107` pages.
- Local built smoke passed: unauthenticated `/api/cron/dispute-letter-monitor` returns `401`, and `/tools/my-dispute-letters` renders.
- Production deploy `dpl_DXCAABuGQeJA7kAJbmKiMLAGubHh` passed and is aliased to `https://vestblock.io` and `https://www.vestblock.io`.
- Live smoke passed: unauthenticated `/api/cron/dispute-letter-monitor` returns `401`, and `/tools/my-dispute-letters` returns `200`.

## 2026-04-28 Launch Hardening

## Files Changed

- `middleware.ts`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Added edge middleware protection for `/admin-panel` and `/admin` routes so admin pages are blocked before client-side code loads.
- Kept existing diagnostic and test route protection in place for setup, OpenAI, upload, database, and analysis test surfaces.

## Verification

- `npx tsc --noEmit` passed.
- `corepack pnpm lint` passed with existing warning-only output.
- `OPENAI_API_KEY=sk-build-placeholder NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=build-placeholder SUPABASE_SERVICE_ROLE_KEY=build-placeholder NEXT_PUBLIC_SITE_URL=https://www.vestblock.io corepack pnpm build` passed and generated `107` pages.
- Local built smoke passed: unauthenticated `/admin-panel` redirects to login, unauthenticated `/api/test-openai-simple` returns `401`, and `/services/credit-card-stacking-strategy` returns `200`.
- Production deploy `dpl_4Bi7DVVBQzLw6FPYA6owddedH3qq` passed and is aliased to `https://vestblock.io` and `https://www.vestblock.io`.
- Live smoke passed: apex and `www` return `200`, unauthenticated `/admin-panel` redirects to login, `/services/credit-card-stacking-strategy` returns `200`, `sitemap.xml` includes `/llms.txt` and the credit card stacking guide, and `/llms.txt` includes Spanish funding, real estate funding, and credit card stacking coverage.

## 2026-04-27 Published Service AEO Guides

## Files Changed

- `app/services/[slug]/page.tsx`
- `app/services/page.tsx`
- `app/admin-panel/page.tsx`
- `app/api/admin/dashboard/route.ts`
- `app/sitemap.ts`
- `lib/seo/llmFeed.ts`
- `lib/seo/serviceSeoPages.ts`
- `docs/VESTBLOCK_AEO_PLAYBOOK.md`
- `docs/VESTBLOCK_CHANGELOG.md`
- `docs/VESTBLOCK_SYSTEM_AUDIT.md`

## Features Added

- Added static, indexable service guide pages under `/services/[slug]` for every major VestBlock service.
- Published AEO-ready pages for AI credit analysis, business funding eligibility, credit card stacking strategy, business setup for funding and grants, financial growth services, small business grants, Spanish business funding, real estate funding, sell-property review, and the VestBlock AI Assistant.
- Added service guide FAQ schema and Service JSON-LD on every guide page.
- Added a published guide section to `/services` so users and crawlers can reach every service guide.
- Added service guide routes to `sitemap.xml` and `/llms.txt`.
- Updated the admin AEO / LLM dashboard to count static service guide pages as published SEO coverage and link directly to them.

## Verification

- `npx tsc --noEmit` passed.
- `corepack pnpm lint` passed with existing warning-only output.
- `OPENAI_API_KEY=sk-build-placeholder NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=build-placeholder SUPABASE_SERVICE_ROLE_KEY=build-placeholder NEXT_PUBLIC_SITE_URL=https://www.vestblock.io corepack pnpm build` passed and generated `107` pages, including the new `/services/[slug]` guide family.
- Local built smoke passed: `/services/credit-card-stacking-strategy` returned `200`, guide metadata and JSON-LD rendered, `/services` links the guide family, `sitemap.xml` includes new service guide URLs, and `/llms.txt` lists the service guides.
- Production deploy and live smoke are pending for this change.

## 2026-04-27 SEO, AEO, And Admin Visibility Upgrade

## Files Changed

- `app/layout.tsx`
- `app/llms.txt/route.ts`
- `app/services/page.tsx`
- `app/services/financial-growth/page.tsx`
- `app/funding/layout.tsx`
- `app/funding/credit-card-strategy/layout.tsx`
- `app/credit-upload/layout.tsx`
- `app/real-estate-funding/layout.tsx`
- `app/tools/business-credit/layout.tsx`
- `app/tools/grants/layout.tsx`
- `app/admin-panel/page.tsx`
- `app/api/admin/dashboard/route.ts`
- `app/robots.ts`
- `app/sitemap.ts`
- `components/service-cards.tsx`
- `lib/content/marketingServices.ts`
- `lib/seo/llmFeed.ts`
- `lib/seo/site.ts`
- `lib/seo/structuredData.ts`
- `lib/services/serviceDirectory.ts`
- `docs/VESTBLOCK_AEO_PLAYBOOK.md`
- `docs/VESTBLOCK_CHANGELOG.md`
- `docs/VESTBLOCK_SYSTEM_AUDIT.md`

## Features Added

- Added `/llms.txt` as a crawler-friendly answer-engine map for VestBlock services, financial packages, learning pages, and compliance guardrails.
- Added shared SEO helpers for canonical URLs, site metadata, organization schema, website schema, service item-list schema, financial package offer schema, and FAQ schema.
- Added stronger route metadata for the service directory, financial growth packages, funding, credit card stacking, credit upload, real estate funding, business credit, and grants.
- Added credit card stacking as a first-class service directory item and content-generator service so it can be ranked, tracked, and monetized clearly.
- Added an `/admin-panel` AEO / LLM tab with service coverage, topic cluster counts, LLM discovery surfaces, Spanish content count, content gaps, and one-click draft setup for missing SEO pages.
- Added AEO coverage metrics to `/api/admin/dashboard` without exposing private data.
- Added `/llms.txt` to robots and sitemap.

## Verification

- `npx tsc --noEmit` passed.
- `corepack pnpm lint` passed with existing warning-only output.
- `OPENAI_API_KEY=sk-build-placeholder NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=build-placeholder SUPABASE_SERVICE_ROLE_KEY=build-placeholder NEXT_PUBLIC_SITE_URL=https://www.vestblock.io corepack pnpm build` passed and generated `/llms.txt`.
- Local built smoke passed: `/llms.txt` includes service and compliance coverage, `/services` and `/services/financial-growth` render JSON-LD metadata, `/robots.txt` allows `/llms.txt` and `/services`, `sitemap.xml` includes `/llms.txt`, and `/api/admin/dashboard` still returns `401` without an admin session.

## 2026-04-27 Financial Growth Service Packages

## Files Changed

- `app/services/financial-growth/page.tsx`
- `app/api/service-interest/route.ts`
- `components/financial-service-interest-form.tsx`
- `lib/services/financialSkillsets.ts`
- `lib/services/serviceDirectory.ts`
- `components/service-cards.tsx`
- `app/services/page.tsx`
- `app/admin/leads/page.tsx`
- `app/sitemap.ts`
- `docs/VESTBLOCK_CHANGELOG.md`
- `docs/VESTBLOCK_AUTOMATION_ROADMAP.md`
- `docs/VESTBLOCK_SYSTEM_AUDIT.md`

## Features Added

- Added `/services/financial-growth` as a monetized service page for paid financial prep packages.
- Added six sellable packages: Funding Readiness Snapshot `$149`, Business Credit Builder Sprint `$499`, Grant Application Prep Review `$249`, Debt And Utilization Paydown Plan `$199`, Cash Flow And Bank Statement Review `$199`, and Real Estate Deal Funding Review `$300`.
- Added `/api/service-interest` so package requests create real lead rows and trigger existing lead automation.
- Added a reusable financial package catalog in `lib/services/financialSkillsets.ts`.
- Added Financial Growth Services to the main service directory, homepage service cards, `/services`, and sitemap.
- Updated the admin lead manager to recognize `business_funding` and `credit_card_funding_strategy` lead types and show package, price, goal, revenue, credit, timeline, and compliance details.

## Verification

- `npx tsc --noEmit` passed.
- `corepack pnpm lint` passed with existing warning-only output.
- `OPENAI_API_KEY=sk-build-placeholder NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=build-placeholder SUPABASE_SERVICE_ROLE_KEY=build-placeholder NEXT_PUBLIC_SITE_URL=https://www.vestblock.io corepack pnpm build` passed.
- Local built smoke passed: `/services/financial-growth` returned `200`, page copy rendered the package offers, `/api/service-interest` rejected an empty payload with `400`, and `sitemap.xml` includes `/services/financial-growth`.
- Production deploy `dpl_Ekm98AnBtupdncYtVoxJtotuPYhZ` passed and aliased to production.
- Live smoke on `https://www.vestblock.io/services/financial-growth` passed: route returned `200`, package copy rendered, `/api/service-interest` rejected an empty payload with `400`, and `sitemap.xml` includes `/services/financial-growth`.

## 2026-04-27 Service Directory And Skill Upgrade

## Files Changed

- `app/services/page.tsx`
- `lib/services/serviceDirectory.ts`
- `components/service-cards.tsx`
- `components/navigation.tsx`
- `app/sitemap.ts`
- `docs/VESTBLOCK_SYSTEM_AUDIT.md`
- `docs/VESTBLOCK_AUTOMATION_ROADMAP.md`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Added `/services` as a single client-facing hub for every major VestBlock service.
- Added a reusable service directory covering credit analysis, business funding, business setup, grants, Spanish funding, real estate funding, property seller leads, and the AI assistant.
- Updated homepage service cards to pull from the shared service directory instead of a smaller hardcoded service list.
- Simplified top navigation by adding `Services` and keeping the main menu focused on the highest-intent paths.
- Added `/services` to the sitemap.
- Installed additional Codex skills for future platform work: `playwright`, `security-best-practices`, `security-threat-model`, `sentry`, `vercel-deploy`, and `pdf`.

## Verification

- `npx tsc --noEmit` passed.
- `corepack pnpm lint` passed with existing warnings only.
- `corepack pnpm build` passed with local placeholder production env values.
- Local built-app smoke checks returned `200` for `/services`, confirmed homepage service cards render, and confirmed `/services` appears in `sitemap.xml`.
- Deploy and live smoke verification pending.

## 2026-04-27 Free Funding Eligibility Checker

## Files Changed

- `app/funding/page.tsx`
- `components/funding-eligibility-checker.tsx`
- `app/funding/credit-card-strategy/page.tsx`
- `app/api/funding-strategy/route.ts`
- `app/admin-panel/page.tsx`
- `lib/funding/cardStacking.ts`
- `lib/payments/products.ts`
- `.agents/skills/vestblock/funding-lead-automation.md`
- `docs/VESTBLOCK_AUTOMATION_ROADMAP.md`
- `docs/VESTBLOCK_SYSTEM_AUDIT.md`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Added a free instant business funding eligibility checker to `/funding`.
- Repositioned the funding journey as free eligibility check first, then the `$300` Business Funding Readiness Plan when the customer needs help becoming eligible.
- Updated the protected funding workflow so every saved request can enter checkout for the `$300` plan, including `needs_prep` profiles.
- Kept the `10%` success fee language tied only to approved, accepted, and available card funding.
- Updated admin pricing language and automation docs to match the new offer.

## Verification

- `npx tsc --noEmit` passed.
- `corepack pnpm lint` passed with existing warnings only.
- `corepack pnpm build` passed with local placeholder production env values.
- Local built-app smoke checks returned `200` for `/funding` and `/funding/credit-card-strategy`.
- Deploy and live smoke verification pending at commit time.

## 2026-04-27 Funding And Real Estate Form Enhancements

## Files Changed

- `app/funding/page.tsx`
- `app/funding/credit-card-strategy/page.tsx`
- `app/real-estate-funding/page.tsx`
- `app/sell/page.tsx`
- `app/api/funding-strategy/route.ts`
- `app/api/real-estate-lead/route.ts`
- `app/api/sell-lead/route.ts`
- `app/api/admin/dashboard/route.ts`
- `app/admin-panel/page.tsx`
- `db/migrations/026-add-funding-success-fee-fields.sql`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Updated card funding offer to `$300` upfront plus a `10%` success fee after approved card funding is accepted and available.
- Added customer consent capture for the funding strategy success fee.
- Added admin visibility for success-fee consent on Funding Strategy requests.
- Enhanced real estate funding forms with requested loan amount, liquidity, borrowing entity, funding goal, DSCR value/expense fields, hard-money contract status, contractor/scope readiness, and deal notes.
- Enhanced the sell-property lead form with email, property type, beds/baths, occupancy, estimated value, desired sale price, liens/taxes, best call time, and notes.
- Expanded lead APIs so the new form details are saved into the unified `leads.form_data` JSON and included in admin lead automation metadata.

## Database Changes Required

- `db/migrations/026-add-funding-success-fee-fields.sql` was applied to live Supabase on 2026-04-27.

## Verification

- `corepack pnpm lint` passes with existing warnings only.
- `npx tsc --noEmit` passed.
- `corepack pnpm build` passed with local placeholder production env values.
- Supabase verification confirmed `funding_strategy_requests.success_fee_rate` and `funding_strategy_requests.consent_success_fee` exist.
- Built-app smoke checks returned `200` for `/real-estate-funding`, `/sell`, and `/funding/credit-card-strategy`.

## 2026-04-27 Business Credit Card Funding Strategy Workflow

## Files Changed

- `app/funding/credit-card-strategy/page.tsx`
- `app/funding/page.tsx`
- `app/admin-panel/page.tsx`
- `app/api/funding-strategy/route.ts`
- `app/api/funding-lead/route.ts`
- `app/api/admin/funding-strategy/route.ts`
- `app/robots.ts`
- `app/api/create-order/route.ts`
- `app/api/capture-order/route.ts`
- `app/api/webhook/route.ts`
- `app/api/paypal-webhook/route.ts`
- `app/api/admin/dashboard/route.ts`
- `app/sitemap.ts`
- `lib/funding/cardStacking.ts`
- `lib/funding/fundingStrategyAutomation.ts`
- `lib/payments/products.ts`
- `lib/admin/tasks.ts`
- `lib/system/logEvent.ts`
- `db/migrations/025-create-funding-strategy-requests.sql`
- `.agents/skills/vestblock/funding-lead-automation.md`
- `docs/VESTBLOCK_AUTOMATION_ROADMAP.md`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Added `/funding/credit-card-strategy` as a logged-in customer workflow for business credit card funding readiness.
- Added a compliance-safe readiness scorer for credit range, utilization, inquiries, EIN, business banking, business age, revenue, and use of funds.
- Added the paid offer `Business Funding Readiness Plan` at `$300`.
- Added PayPal product support so VestBlock Pro and funding readiness plans can use the same checkout/capture routes without turning every payment into a subscription.
- Added funding strategy automation that sends admin lead alerts, creates admin tasks, and logs `funding_strategy_submitted` / `funding_strategy_paid` events.
- Added an admin Funding Strategy tab with readiness score, customer contact, payment status, admin notes, and manual status updates.
- Wired the existing `/funding` lead form into a real `/api/funding-lead` route instead of local-only form logging.
- Updated PayPal webhook handlers so funding strategy payments are recorded as the funding product and do not incorrectly grant Pro subscription access.
- Added sitemap coverage for `/funding/credit-card-strategy`.
- Hardened site-origin URL handling so sitemap, robots, email dashboard links, and PayPal return URLs do not inherit an accidental path from `NEXT_PUBLIC_SITE_URL`.

## Env Vars Required

- Existing payment vars: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, and `PAYPAL_ENV=live` when taking live payments.
- Existing platform vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `ADMIN_ALERT_EMAIL`, `FROM_EMAIL`, `NEXT_PUBLIC_SITE_URL`, `OPENAI_API_KEY`.

## Database Changes Required

- `db/migrations/025-create-funding-strategy-requests.sql` was applied to the live VestBlock Supabase project on 2026-04-27.
- Migration creates/updates `payments`, creates/updates `leads`, adds `user_profiles.paypal_order_product`, and creates `funding_strategy_requests` with RLS.

## Verification

- `corepack pnpm lint` passes with existing warnings only.
- `npx tsc --noEmit` passed.
- `corepack pnpm build` passed with local placeholder production env values.
- Supabase verification confirmed `funding_strategy_requests` exists with `0` rows, `leads` exists with `0` rows, and `payments` includes `product_type`, `metadata_json`, and `paypal_transaction_id`.
- Built-app smoke checks passed for `/funding`, `/funding/credit-card-strategy`, `/sitemap.xml`, `/api/funding-strategy` returning `401` unauthenticated, and `/api/admin/funding-strategy` returning `401` unauthenticated.

## 2026-04-27 Content Operations Dashboard

## Files Changed

- `app/admin-panel/page.tsx`
- `app/api/admin/dashboard/route.ts`
- `app/api/admin/content/route.ts`
- `app/resources/[slug]/page.tsx`
- `app/sitemap.ts`
- `app/robots.ts`
- `lib/content/marketingServices.ts`
- `lib/content/contentGenerator.ts`
- `lib/system/logEvent.ts`
- `db/migrations/024-create-content-assets.sql`
- `docs/VESTBLOCK_SYSTEM_AUDIT.md`
- `docs/VESTBLOCK_AUTOMATION_ROADMAP.md`
- `docs/VESTBLOCK_AEO_PLAYBOOK.md`
- `.agents/skills/vestblock/aeo-content-automation.md`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Added an admin Content tab for SEO pages, social posts, and campaign drafts.
- Added a protected `/api/admin/content` generator that uses `OPENAI_API_KEY`, service-specific compliance rules, and Supabase storage.
- Added `content_assets` migration with RLS: public users can only read published SEO pages, while admins manage all content.
- Added public `/resources/[slug]` pages for SEO assets marked `published`.
- Added dynamic sitemap support for published generated SEO pages.
- Added VestBlock service catalog for AI credit analysis, dispute letters, business setup, business credit, funding, grants, Spanish funding, real estate funding, sell-property leads, and the AI assistant.

## Env Vars Required

- `OPENAI_API_KEY`
- Optional: `OPENAI_CONTENT_MODEL`

## Database Changes Required

- `db/migrations/024-create-content-assets.sql` was applied to the live VestBlock Supabase project on 2026-04-27.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed.
- `corepack pnpm run build` passed with local dummy production env values.
- Built-app smoke checks passed for `/admin-panel`, `/business-setup`, `/sitemap.xml`, `/resources/not-published-yet` returning `404`, and `/api/admin/content` returning `401` without an admin session.
- Supabase verification confirmed `public.content_assets` exists and currently has `0` rows.

## 2026-04-27 Business Setup And Spanish Funding SEO

## Files Changed

- `app/business-setup/page.tsx`
- `app/es/vestblock/page.tsx`
- `app/tools/business-credit/page.tsx`
- `app/tools/grants/page.tsx`
- `app/sitemap.ts`
- `app/robots.ts`
- `components/navigation.tsx`
- `lib/business-readiness/fundingCompliance.ts`
- `lib/aeo/topics.ts`
- `docs/VESTBLOCK_AEO_PLAYBOOK.md`
- `.agents/skills/vestblock/aeo-content-automation.md`
- `.agents/skills/vestblock/funding-lead-automation.md`
- `.agents/skills/vestblock/compliance-safe-credit-content.md`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Added a public `/business-setup` funding and grant readiness page.
- Added `/es/vestblock` as a Spanish-speaking business owner SEO and partner path for Bank Breezy.
- Added shared funding compliance readiness pillars for entity, banking, documents, credit, and grants.
- Added readiness panels to the member business credit and grants tools.
- Added new AEO topics for business setup funding and Spanish business funding.
- Added the new routes to sitemap and robots, plus the public navigation.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed.
- `corepack pnpm run build` passed with local dummy production env values.
- Built-app smoke checks passed for `/business-setup`, `/es/vestblock`, `/tools/business-credit`, `/tools/grants`, `/sitemap.xml`, and `/robots.txt`.
- `/api/admin/dashboard` returned `401` without an admin session, as expected.

## 2026-04-27 PayPal Webhook Payment Dedupe

## Files Changed

- `app/api/paypal-webhook/route.ts`
- `.agents/skills/vestblock/revenue-operations-operator.md`
- `docs/VESTBLOCK_SYSTEM_AUDIT.md`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Updated `/api/paypal-webhook` to check `payments.paypal_transaction_id` before inserting payment records.
- Added explicit subscription update error handling for PayPal completed capture webhooks.
- Removed the route-level `$75.00` gate so valid PayPal capture amounts are recorded instead of silently ignored.
- Prevented repeated PayPal webhook deliveries from duplicating payment rows or repeating paid-customer automation.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed before and after build.
- `corepack pnpm run build` passed with local dummy production env values.

## 2026-04-27 Admin Data Source Health

## Files Changed

- `app/api/admin/dashboard/route.ts`
- `app/admin-panel/page.tsx`
- `.agents/skills/vestblock/admin-dashboard-operator.md`
- `docs/VESTBLOCK_SYSTEM_AUDIT.md`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Added admin API tracking for expected Supabase dashboard tables.
- Added Data Source Health to the `/admin-panel` Automation tab so missing tables or query failures are visible to operators.
- Added data-source query failures to the admin system errors feed without exposing secrets.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed before and after build.
- `corepack pnpm run build` passed with local dummy production env values.

## 2026-04-27 Admin Payment Readiness Panel

## Files Changed

- `app/api/admin/dashboard/route.ts`
- `app/admin-panel/page.tsx`
- `.agents/skills/vestblock/revenue-operations-operator.md`
- `docs/VESTBLOCK_SYSTEM_AUDIT.md`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Added PayPal readiness metadata to the protected admin dashboard API without exposing secret values.
- Added a Payment Readiness card to `/admin-panel` showing PayPal environment, client ID status, client secret status, and webhook ID status.
- Added operator guidance that distinguishes sandbox checkout testing from live PayPal payment readiness.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed before and after build.
- `corepack pnpm run build` passed with local dummy production env values.

## 2026-04-27 Capture Order Payment Dedupe

## Files Changed

- `app/api/capture-order/route.ts`
- `.agents/skills/vestblock/revenue-operations-operator.md`
- `docs/VESTBLOCK_SYSTEM_AUDIT.md`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Added explicit subscription update error handling to `/api/capture-order`.
- Added a `payments.paypal_transaction_id` lookup before inserting a captured PayPal payment.
- Prevented repeat capture requests from creating duplicate payment rows or repeating paid-customer automation.
- Kept subscription repair idempotent so a repeated successful capture can still leave the user subscribed.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed before and after build.
- `corepack pnpm run build` passed with local dummy production env values.

## 2026-04-27 PayPal Environment Configuration

## Files Changed

- `lib/paypal/config.ts`
- `lib/paypal/accessToken.ts`
- `app/api/create-order/route.ts`
- `app/api/capture-order/route.ts`
- `app/api/webhook/route.ts`
- `.agents/skills/vestblock/revenue-operations-operator.md`
- `.agents/skills/vestblock/vercel-supabase-release-operator.md`
- `docs/VESTBLOCK_SYSTEM_AUDIT.md`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Added a shared PayPal API configuration helper.
- Replaced route-level hardcoded PayPal sandbox API URLs with `getPaypalApiUrl()`.
- Added support for `PAYPAL_ENV=live` or `PAYPAL_MODE=live` to switch production traffic from PayPal sandbox to PayPal live.
- Kept sandbox as the default so development and staging remain safe unless explicitly switched.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed before and after build.
- `corepack pnpm run build` passed with local dummy production env values.

## 2026-04-27 Legacy PayPal Webhook Automation

## Files Changed

- `app/api/webhook/route.ts`
- `.agents/skills/vestblock/revenue-operations-operator.md`
- `docs/VESTBLOCK_AUTOMATION_ROADMAP.md`
- `docs/VESTBLOCK_SYSTEM_AUDIT.md`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Updated the legacy `/api/webhook` PayPal route to use the shared Supabase admin client instead of a module-level service-role client.
- Wired legacy PayPal capture completion through `lib/payments/paymentAutomation.ts` for paid-customer admin alerts, onboarding tasks, and `payment_completed` logs.
- Added failed-payment automation for missing PayPal order IDs, missing matching profiles, payment insert failures, subscription update failures, denied captures, voided orders, and handler exceptions.
- Added duplicate transaction checks so repeated PayPal webhooks do not create duplicate `payments` rows or repeat paid-customer automation.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed before and after build.
- `corepack pnpm run build` passed with local dummy production env values.

## 2026-04-27 Abandoned Checkout Automation

## Files Changed

- `app/api/create-order/route.ts`
- `app/api/cron/lifecycle-monitor/route.ts`
- `app/api/admin/dashboard/route.ts`
- `lib/admin/tasks.ts`
- `lib/email/sendEmail.ts`
- `lib/system/logEvent.ts`
- `.agents/skills/vestblock/revenue-operations-operator.md`
- `.agents/skills/vestblock/analytics-conversion-operator.md`
- `.agents/skills/vestblock/email-alert-automation.md`
- `.agents/skills/vestblock/user-lifecycle-automation.md`
- `docs/VESTBLOCK_AUTOMATION_ROADMAP.md`
- `docs/VESTBLOCK_SYSTEM_AUDIT.md`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Added `checkout_started` logging when PayPal order creation succeeds.
- Added abandoned checkout detection to the lifecycle cron for unpaid PayPal orders older than the follow-up window.
- Added `abandoned_checkout` admin activity logging, `abandoned_checkout` admin tasks, and `admin_abandoned_checkout` email alerts.
- Added checkout/abandoned checkout events to the admin automation feed.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed before and after build.
- `corepack pnpm run build` passed with local dummy production env values.

## 2026-04-27 Failed Payment Automation

## Files Changed

- `app/api/capture-order/route.ts`
- `app/api/paypal-webhook/route.ts`
- `app/api/process-payment/route.ts`
- `app/api/admin/dashboard/route.ts`
- `lib/payments/paymentAutomation.ts`
- `lib/admin/tasks.ts`
- `lib/email/sendEmail.ts`
- `lib/system/logEvent.ts`
- `.agents/skills/vestblock/email-alert-automation.md`
- `.agents/skills/vestblock/user-lifecycle-automation.md`
- `docs/VESTBLOCK_AUTOMATION_ROADMAP.md`
- `docs/VESTBLOCK_SYSTEM_AUDIT.md`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Added shared failed-payment automation for admin alerts, `payment_failed` activity logging, and `payment_failure` admin tasks.
- Added admin payment failure email event `admin_payment_failed`.
- Wrapped PayPal capture failures so unsuccessful or errored captures are visible to operators.
- Added failed-payment handling for PayPal webhook record failures and explicit denied/voided PayPal webhook events.
- Added failed-payment handling for the internal payment processing route when payment records cannot be written.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed before and after build.
- `corepack pnpm run build` passed with local dummy production env values.

## 2026-04-27 Payment Completion Automation

## Files Changed

- `app/api/capture-order/route.ts`
- `app/api/admin/dashboard/route.ts`
- `app/api/paypal-webhook/route.ts`
- `app/api/process-payment/route.ts`
- `lib/payments/paymentAutomation.ts`
- `lib/admin/tasks.ts`
- `.agents/skills/vestblock/user-lifecycle-automation.md`
- `.agents/skills/vestblock/email-alert-automation.md`
- `docs/VESTBLOCK_AUTOMATION_ROADMAP.md`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Added shared payment completion automation for admin paid-customer alerts, `payment_completed` logging, and onboarding task creation.
- Wired PayPal capture, PayPal webhook, and existing internal payment processing route through the same automation.
- Added `paid_customer_onboarding` admin tasks so new paid customers are followed up immediately.
- Updated payment routes to use the Supabase service-role admin client for server-side payment writes.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed before and after build.
- `corepack pnpm run build` passed with local dummy production env values.

## 2026-04-27 Immediate Lead Intake Automation

## Files Changed

- `app/api/ai-assistant-request/route.ts`
- `app/api/real-estate-lead/route.ts`
- `app/api/sell-lead/route.ts`
- `lib/leads/leadAutomation.ts`
- `lib/admin/tasks.ts`
- `lib/email/sendEmail.ts`
- `lib/system/logEvent.ts`
- `.agents/skills/vestblock/funding-lead-automation.md`
- `docs/VESTBLOCK_AUTOMATION_ROADMAP.md`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Added shared new-lead automation that sends an admin alert email, creates a follow-up admin task, and logs a `lead_created` event.
- Wired real estate funding, house seller, and AI assistant lead submissions into the shared automation path.
- Replaced route-local Resend lead notifications with the reusable email event/logger system.
- Moved lead-route Supabase service-role clients out of module scope so routes do not require service env vars during import.
- Updated the funding lead operator skill with the new shared automation path.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed before and after build.
- `corepack pnpm run build` passed with local dummy production env values.

## 2026-04-27 Lead Operations Upgrade

## Files Changed

- `app/api/admin/leads/route.ts`
- `app/api/admin/dashboard/route.ts`
- `app/admin-panel/page.tsx`
- `docs/VESTBLOCK_AUTOMATION_ROADMAP.md`
- `docs/VESTBLOCK_SYSTEM_AUDIT.md`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Updated `/api/admin/leads` to support both bearer-token admin access from `/admin/leads` and cookie-based admin access from `/admin-panel`.
- Added server-side lead status validation for `new`, `contacted`, `qualified`, and `closed`.
- Added admin activity logging when an operator updates a lead.
- Expanded the admin dashboard lead payload with phone and notes fields.
- Added funding lead status controls directly inside the `/admin-panel` Payments and Leads tab.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed before and after build.
- `corepack pnpm run build` passed with local dummy production env values.

## 2026-04-27 Admin Automation Dashboard

## Files Changed

- `app/api/admin/dashboard/route.ts`
- `app/admin-panel/page.tsx`
- `docs/VESTBLOCK_AUTOMATION_ROADMAP.md`
- `docs/VESTBLOCK_CHANGELOG.md`

## Features Added

- Added automation readiness data to the protected admin dashboard API without exposing secret values.
- Added expected Vercel cron schedules for credit repair and lifecycle monitors to the admin dashboard payload.
- Added lifecycle email counters for sent, skipped, failed, and total reminder events.
- Added an Automation tab in `/admin-panel` for env readiness, cron schedules, lifecycle email counts, and recent automation activity.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed.
- `corepack pnpm run build` passed with local dummy production env values.

## 2026-04-27 Lifecycle Reminder Emails

## Files Changed

- `app/api/cron/lifecycle-monitor/route.ts`
- `lib/email/sendEmail.ts`
- `docs/VESTBLOCK_AUTOMATION_ROADMAP.md`

## Features Added

- Added user upload reminder email for signups older than 48 hours with no credit report.
- Added paid customer upload/onboarding reminder email for paid users older than 24 hours with no report.
- Added admin lead follow-up alert email for new leads older than 24 hours.
- Added `email_events` duplicate checks so scheduled lifecycle reminders can run repeatedly without sending duplicate reminders.
- Added lifecycle email attempted/skipped counts to the cron response.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed.
- `corepack pnpm run build` passed with local dummy production env values.

## 2026-04-27 Credit Analysis Rerun Workflow

## Files Changed

- `lib/workflows/processCreditReportAnalysis.ts`
- `app/api/upload-credit-report/route.ts`
- `app/api/admin/reports/[reportId]/actions/route.ts`
- `app/admin-panel/reports/[reportId]/page.tsx`

## Features Added

- Moved extraction, negative item analysis, dispute letter generation, workflow status updates, and completion email triggers into a reusable workflow processor.
- Updated credit report upload processing to use the shared workflow processor instead of keeping analysis logic inline in the upload route.
- Added a protected admin `rerun_analysis` action that downloads the stored report from Supabase Storage and reprocesses it.
- Added a Rerun analysis button to the admin report detail operator actions panel.
- Creates a follow-up admin task after a successful rerun so the operator can review outputs before customer follow-up.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed.
- `corepack pnpm run build` passed with local dummy production env values.

## 2026-04-27 Customer Credit Workflow Status

## Files Changed

- `lib/workflows/creditReportStatus.ts`
- `components/credit-report-status-card.tsx`
- `app/dashboard/page.tsx`
- `app/credit-upload/page.tsx`
- `app/credit-dashboard/[reportId]/page.tsx`

## Features Added

- Added a shared customer-facing status model for credit report workflow states.
- Added a reusable credit report status card with progress, next-step guidance, letter counts, and contextual actions.
- Added a Credit Repair Workflow section to `/dashboard` that lists the user's recent reports from Supabase.
- Updated upload success state with direct links to report status, dashboard, and another upload.
- Updated `/credit-dashboard/[reportId]` to read newer workflow fields such as `status`, `analysis_json`, `dispute_letters_json`, and `uploaded_at`.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed.
- `corepack pnpm run build` passed with local dummy production env values.

## 2026-04-27 Edge-Safe Diagnostic Middleware

## Files Changed

- `middleware.ts`

## Features Added

- Removed Supabase SSR/client package imports from middleware so the Edge Runtime no longer pulls in Node-only Supabase internals.
- Kept diagnostic pages and diagnostic setup/test APIs protected with Edge-safe Supabase Auth REST checks.
- Narrowed the middleware matcher to only the protected diagnostic/admin-test surfaces instead of matching nearly every request.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed.
- `corepack pnpm audit --json` reports zero vulnerabilities.
- `corepack pnpm run build` passed with local dummy production env values.
- The previous Supabase Edge Runtime warning is no longer emitted by the local production build.

## 2026-04-27 Sitemap And Robots

## Files Changed

- `app/sitemap.ts`
- `app/robots.ts`
- `docs/VESTBLOCK_AEO_PLAYBOOK.md`

## Features Added

- Added a curated public sitemap for the home page, learning center, AEO topic pages, and public conversion/tool routes.
- Added robots rules that allow public content while excluding admin, API, account, diagnostic, setup, test, and user-specific report routes.
- Documented sitemap/robots maintenance rules in the AEO playbook.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed.
- `corepack pnpm audit --json` reports zero vulnerabilities.
- `corepack pnpm run build` passed with local dummy production env values and generated `/robots.txt` plus `/sitemap.xml`.

## 2026-04-27 AEO Learning Center Starter

## Files Changed

- `lib/aeo/topics.ts`
- `app/learn/page.tsx`
- `app/learn/[slug]/page.tsx`
- `components/navigation.tsx`
- `docs/VESTBLOCK_AEO_PLAYBOOK.md`

## Features Added

- Expanded the AEO topic registry with customer-facing descriptions, audiences, takeaways, next steps, FAQs, and related offer paths.
- Added a public `/learn` hub for credit repair, dispute, business credit, funding, and credit builder topics.
- Added static `/learn/[slug]` guide pages with metadata, FAQ schema, related guides, compliance-safe disclaimers, and tool CTAs.
- Added a top navigation link to the learning center.

## Verification

- `corepack pnpm run lint` passes with existing warnings only.
- `corepack pnpm exec tsc --noEmit` passed.
- `corepack pnpm audit --json` reports zero vulnerabilities.
- `corepack pnpm run build` passed with local dummy production env values and generated `/learn` plus 16 static topic pages.

## 2026-04-27 ESLint CLI Migration

## Files Changed

- `package.json`
- `pnpm-lock.yaml`
- `eslint.config.mjs`

## Features Added

- Replaced the deprecated interactive `next lint` script with the repeatable ESLint CLI.
- Added a Next-compatible flat ESLint config for the current Next 15 runtime.
- Pinned ESLint packages to compatible versions and narrowed the `minimatch` override for ESLint's legacy config helper.
- Kept inherited cleanup findings as warnings so lint is useful now without blocking production upgrades.

## Verification

- `corepack pnpm run lint` passes with warnings only.
- `corepack pnpm exec tsc --noEmit` passed.
- `corepack pnpm audit --json` reports zero vulnerabilities.
- `corepack pnpm run build` passed with local dummy production env values.

## 2026-04-27 Admin Dashboard Search And Filters

## Files Changed

- `app/admin-panel/page.tsx`

## Features Added

- Added dashboard search and filter controls for credit reports, users, alerts, admin tasks, recent activity, payments, and funding leads.
- Added filtered result counts so admins can see how much of the operational queue is currently visible.
- Kept filtering client-side against the existing protected admin dashboard payload to avoid database/schema risk.

## Verification

- `corepack pnpm exec tsc --noEmit` passed.
- `corepack pnpm audit --json` reports zero vulnerabilities.
- `corepack pnpm run build` passed with local dummy production env values.
- `corepack pnpm run lint` remains blocked by Next's deprecated interactive lint setup prompt.

## 2026-04-27 Credit Workflow Operator Actions

## Files Changed

- `app/api/upload-credit-report/route.ts`
- `app/api/admin/reports/[reportId]/actions/route.ts`
- `app/admin-panel/reports/[reportId]/page.tsx`

## Features Added

- Centralized credit report upload bookkeeping through `createCreditReportRecord()` so report creation, email alerts, admin tasks, and activity logging use the same workflow path.
- Added protected admin report actions for resending upload emails, resending analysis-ready emails, and creating manual follow-up tasks.
- Added an Operator Actions panel on the admin report detail page.

## Verification

- `corepack pnpm exec tsc --noEmit` passed.
- `corepack pnpm audit --json` reports zero vulnerabilities.
- `corepack pnpm run build` passed with local dummy production env values.
- `corepack pnpm run lint` remains blocked by Next's deprecated interactive lint setup prompt.

## 2026-04-27 Credit Report Operator Timeline

## Files Changed

- `app/api/admin/reports/[reportId]/route.ts`
- `app/admin-panel/reports/[reportId]/page.tsx`
- `lib/admin/reportTimeline.ts`

## Features Added

- Added a reusable admin timeline builder for credit report operations.
- Extended the admin report detail API with related admin tasks, a combined workflow timeline, and an operational summary.
- Upgraded the admin report detail page with next-best-action guidance, workflow health badges, a chronological activity view, and inline admin task status updates.

## Verification

- `corepack pnpm exec tsc --noEmit` passed.
- `corepack pnpm audit --json` reports zero vulnerabilities.
- `corepack pnpm run build` passed with local dummy production env values.
- `corepack pnpm run lint` is still blocked by Next's deprecated interactive lint setup prompt.

## 2026-04-27 Type Safety Stabilization

## Files Changed

- `app/api/job-status/[jobId]/route.ts`
- `app/api/side-hustle-chat/route.ts`
- `app/user-hub/page.tsx`
- `app/tools/my-dispute-letters/page.tsx`
- `components/chat-interface.tsx`
- `components/interactive-roadmap.tsx`
- `components/analysis-result-client-view.tsx`
- `components/credit-cards-tab.tsx`
- `components/side-hustles-tab.tsx`
- `components/enhanced-credit-analyzer-client.tsx`
- `components/file-upload.tsx`
- `components/financial-goal-card.tsx`
- `components/auth-debug.tsx`
- `components/ui/alert.tsx`
- `components/ui/badge.tsx`
- `components/ui/calendar.tsx`
- `components/ui/chart.tsx`
- `components/ui/toast.tsx`
- `lib/credit-report-extractor.ts`
- `lib/semantic-chunking.ts`

## Features Added

- Cleared the repo-wide TypeScript check so future credit workflow and dashboard refactors can catch real regressions.
- Made `ChatInterface` work in both standalone mode and controlled dashboard chat mode.
- Hardened job status AI prompt handling and side-hustle OpenAI configuration errors.
- Made roadmap, recommendation, alert, badge, toast, calendar, chart, upload, and diagnostic UI helpers compatible with the current dependency versions.
- Preserved existing runtime behavior while tightening types around report extraction and semantic chunking.

## Verification

- `pnpm exec tsc --noEmit` passed.
- `pnpm audit` reports zero vulnerabilities.
- `pnpm run build` passed with local dummy production env values.

## 2026-04-27 AI SDK Security Cleanup

## Files Changed

- `app/api/chat-with-analysis/route.ts`
- `app/api/background-analyzer/route.ts`
- `lib/openai-service.ts`
- `package.json`
- `pnpm-lock.yaml`
- `package-lock.json`

## Features Added

- Removed the direct vulnerable `ai` package dependency after replacing its two server-route usages with the existing OpenAI SDK pattern.
- Removed the now-unused `@ai-sdk/openai` server provider package.
- Kept `@ai-sdk/react` pinned for existing client chat hook compatibility.
- Converted `/api/chat-with-analysis` to stream text from the OpenAI SDK directly.
- Converted `/api/background-analyzer` to use OpenAI JSON mode with Zod validation instead of `generateObject`.
- Declared pnpm as the project package manager and removed `package-lock.json` so Vercel/GitHub/local installs use one lockfile source of truth.

## Verification

- `pnpm audit` reports zero vulnerabilities.

## 2026-04-27 Runtime Framework Upgrade

## Files Changed

- `package.json`
- `package-lock.json`
- `pnpm-lock.yaml`
- `next.config.mjs`
- `lib/supabase/server.ts`
- `lib/auth/admin.ts`
- `lib/openai-service.ts`
- `lib/paypal/accessToken.ts`
- `app/admin-panel/reports/[reportId]/page.tsx`
- `app/admin-panel/users/[userId]/page.tsx`
- `app/api/admin/reports/[reportId]/route.ts`
- `app/api/admin/users/[userId]/route.ts`
- `app/api/biz-credit/[id]/regenerate/route.ts`
- `app/api/capture-order/route.ts`
- `app/api/chat-direct/route.ts`
- `app/api/chat-with-analysis/route.ts`
- `app/api/create-order/route.ts`
- `app/api/dispute-letters/[id]/pdf/route.ts`
- `app/api/dispute-letters/[id]/regenerate/route.ts`
- `app/api/generate-letter/route.ts`
- `app/api/job-status/route.ts`
- `app/api/job-status/[jobId]/route.ts`
- `app/api/webhook/route.ts`
- `app/credit-dashboard/[reportId]/page.tsx`

## Features Added

- Upgraded the production framework runtime to Next.js `15.5.15`.
- Upgraded React and React DOM to `19.2.5`.
- Upgraded React type packages for React 19 compatibility.
- Moved Next server package externalization from the deprecated experimental key to `serverExternalPackages`.
- Set an explicit `outputFileTracingRoot` so local builds do not infer the wrong workspace root when parent folders contain lockfiles.
- Added a pnpm override for Next's nested PostCSS dependency so production pnpm installs resolve to patched PostCSS `8.5.12`.
- Updated dynamic admin/report routes for Next 15 async route params.
- Updated Supabase server auth cookie access for Next 15's async `cookies()` API.
- Moved shared PayPal access-token generation out of route modules and into `lib/paypal/accessToken.ts`.
- Pinned `@ai-sdk/react` to the Vercel AI SDK generation used by the existing chat UI and updated the chat streaming route response helper.
- Added `supports-color` to satisfy Axios/debug's optional server build import and reduce noisy build warnings.

## Known Remaining Security Work

- Superseded by the AI SDK security cleanup above. The production pnpm audit is clean.

## 2026-04-27 Dependency Security Patch

## Files Changed

- `package.json`
- `package-lock.json`
- `pnpm-lock.yaml`

## Features Added

- Upgraded Next.js from `14.2.16` to `14.2.35` to remove the critical Next.js 14 middleware authorization advisory and several older Next.js 14 advisories.
- Upgraded Axios to `^1.15.2`.
- Upgraded direct PostCSS to `^8.5.12`.
- Added npm/pnpm overrides for patched transitive packages, including `follow-redirects`, `picomatch`, `glob`, `minimatch`, `brace-expansion`, `yaml`, `jsondiffpatch`, and `mdast-util-to-hast`.
- Synced both npm and pnpm lockfiles because the repo contains both and Vercel builds with pnpm.

## Known Remaining Security Work

- `npm audit` now reports only the remaining Next.js major-version advisories tied to Next 14 and its bundled PostCSS; clearing those requires a controlled Next 15/16 plus React upgrade.
- `pnpm audit` also reports a low AI SDK advisory that requires upgrading the `ai` package across a major version.

## 2026-04-27 Lifecycle Follow-Up Monitor

## Files Changed

- `app/api/cron/lifecycle-monitor/route.ts`
- `app/api/cron/credit-repair-monitor/route.ts`
- `lib/system/cronAuth.ts`
- `lib/admin/tasks.ts`
- `lib/system/logEvent.ts`
- `vercel.json`
- `docs/VESTBLOCK_AUTOMATION_ROADMAP.md`
- `.agents/skills/vestblock/user-lifecycle-automation.md`
- `.agents/skills/vestblock/support-retention-operator.md`

## Features Added

- Added protected daily lifecycle cron for follow-up automation.
- Creates admin tasks for signups older than 48 hours with no credit report upload.
- Creates high-priority admin tasks for paid customers older than 24 hours with no upload.
- Creates admin tasks for new leads older than 24 hours without follow-up.
- Logs lifecycle follow-up events to `admin_activity`.
- Extracted shared `CRON_SECRET` authorization helper for scheduled routes.

## 2026-04-26 Credit Workflow Monitor

## Files Changed

- `app/api/cron/credit-repair-monitor/route.ts`
- `vercel.json`
- `lib/admin/tasks.ts`
- `lib/system/logEvent.ts`
- `lib/openai-server.ts`
- `next.config.mjs`
- `docs/VESTBLOCK_AUTOMATION_ROADMAP.md`
- `.agents/skills/vestblock/credit-report-workflow.md`

## Features Added

- Added daily Vercel cron for stalled credit repair workflow checks.
- Added token-protected `/api/cron/credit-repair-monitor` route.
- Creates high-priority admin tasks when reports remain in `uploaded`, `extracting_text`, `text_extracted`, or `analyzing` longer than expected.
- Logs `credit_analysis_stalled` events to `admin_activity`.
- Uses existing admin task duplicate protection to avoid repeat queue spam.
- Cleaned the server OpenAI client initialization so builds and production logs are quieter.
- Merged duplicate Next.js `experimental` config keys so all intended settings are active.

## 2026-04-26 Production Logging Cleanup

## Files Changed

- `lib/supabase/server.ts`
- `app/api/upload-credit-report/route.ts`
- `app/api/webhook/route.ts`
- `app/api/paypal-webhook/route.ts`
- `app/dashboard/page.tsx`
- `docs/VESTBLOCK_SYSTEM_AUDIT.md`

## Features Added

- Removed Supabase cookie/session dump logging from the server client helper.
- Normalized the server Supabase helper to prefer `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Removed dashboard logging of PayPal return tokens and approval links.
- Removed raw credit report text, extracted negative items, profile rows, PayPal webhook bodies, PayPal headers, and PayPal secrets from logs.

## 2026-04-26 Debug Route Hardening

## Files Changed

- `middleware.ts`
- `app/api/execute-sql/route.ts`
- `app/api/run-db-setup/route.ts`
- `app/api/setup-database/route.ts`
- `docs/VESTBLOCK_SYSTEM_AUDIT.md`
- `.agents/skills/vestblock/security-privacy-audit.md`

## Features Added

- Added `/admin/test` and `/api/execute-sql` to admin-only middleware protection.
- Added route-level admin checks to the SQL console and database setup APIs.
- Disabled raw SQL execution unless `ENABLE_ADMIN_SQL_CONSOLE=true`.
- Disabled legacy database setup APIs unless `ENABLE_DATABASE_SETUP_ROUTES=true`.

## 2026-04-26 Operations Upgrade

## 2026-04-26 Admin Detail And Reliability Pass

## 2026-04-26 Supabase Restore And Storage Hardening

## 2026-04-26 Production Hardening Pass

## 2026-04-26 Operator Skills Expansion

## 2026-04-26 Admin Task Queue Upgrade

## Files Changed

- `db/migrations/022-create-admin-tasks.sql`
- `app/api/admin/tasks/route.ts`
- `app/api/admin/dashboard/route.ts`
- `app/admin-panel/page.tsx`
- `docs/VESTBLOCK_AUTOMATION_ROADMAP.md`

## Features Added

- Added persistent `admin_tasks` table with RLS.
- Added protected admin task API for list/create/update.
- Added admin dashboard Tasks tab.
- Added open task metric.
- Added task status updates from the dashboard.
- Seeded a high-priority restored-report backlog task for imported reports still in `uploaded`.

## Files Changed

- `.agents/skills/vestblock/production-launch-verification.md`
- `.agents/skills/vestblock/vercel-supabase-release-operator.md`
- `.agents/skills/vestblock/revenue-operations-operator.md`
- `.agents/skills/vestblock/analytics-conversion-operator.md`
- `.agents/skills/vestblock/support-retention-operator.md`
- `.agents/skills/vestblock/security-privacy-audit.md`
- `.agents/skills/vestblock/credit-repair-qa-operator.md`
- `.agents/skills/vestblock/partner-offer-operator.md`
- `docs/VESTBLOCK_AUTOMATION_ROADMAP.md`

## Features Added

- Added launch verification skill for deploys, domains, env vars, and smoke testing.
- Added Vercel/Supabase release skill for safe production env and domain work.
- Added revenue operations skill for paid users, PayPal, upgrades, and checkout follow-up.
- Added analytics/conversion skill for privacy-safe funnel events.
- Added support/retention skill for admin follow-up and lifecycle tasks.
- Added security/privacy audit skill for RLS, storage, logs, and debug route reviews.
- Added credit repair QA skill for upload, analysis, letters, and admin workflows.
- Added partner offer skill for funding, referral, business credit, and lead operations.

## Files Changed

- `middleware.ts`
- `app/api/test-openai/route.ts`
- `app/api/test-openai-simple/route.ts`
- `app/api/test-streaming/route.ts`
- `app/credit-upload/page.tsx`
- `components/navigation.tsx`

## Features Added

- Protected diagnostic pages and setup/test APIs behind authenticated admin access.
- Prevented OpenAI test APIs from running during static build collection.
- Removed noisy navigation and credit upload debug logs from production-rendered pages.
- Updated Vercel Production Postgres env vars to the new VestBlock Supabase database.

## Files Changed

- `db/migrations/021-harden-storage-buckets.sql`

## Database Work Completed

- Connected to the new VestBlock Supabase project in `us-east-2`.
- Restored the legacy cluster backup into the new project.
- Applied `db/migrations/020-vestblock-ops-automation.sql`.
- Confirmed restored app tables, auth users, credit reports, analysis jobs, dispute letters, roadmaps, and storage buckets.
- Confirmed `contact@vestblock.io` exists as an admin profile and matches an auth user.
- Set private financial storage buckets to private.
- Added owner-scoped storage policies for credit reports and dispute letters.

## Remaining Vercel Step

- Replace Production `SUPABASE_SERVICE_ROLE_KEY` with the new VestBlock Supabase service-role key, then redeploy.

## Files Changed

- `app/admin-panel/page.tsx`
- `app/admin-panel/reports/[reportId]/page.tsx`
- `app/admin-panel/users/[userId]/page.tsx`
- `app/api/admin/dashboard/route.ts`
- `app/api/admin/reports/[reportId]/route.ts`
- `app/api/admin/users/[userId]/route.ts`
- `app/api/biz-credit/route.ts`
- `app/api/biz-credit/[id]/regenerate/route.ts`
- `app/tools/business-credit/page.tsx`
- `app/tools/grants/page.tsx`
- `app/tools/my-dispute-letters/page.tsx`

## Features Added

- Admin credit report detail page with report metadata, signed file access, analysis data, generated letters, email events, and manual review notes.
- Admin user detail page with profile, subscription, reports, payments, leads, and email activity.
- Admin dashboard links now open internal admin detail views.
- User management table now includes a direct user detail action.
- Admin report status saves keep the current status when only notes are changed.
- Admin detail APIs use safe query fallbacks so missing emails or file paths do not create invalid Supabase filters.
- Pro-only tools now redirect from client effects instead of triggering navigation during prerender.
- Business credit JSON catalog imports now use the default JSON import pattern expected by Next.js.

## Verification

- `npm run build` passed with local dummy env values.
- The previous `location is not defined` prerender errors on pro-only tools are resolved.
- The previous JSON named-export build warning for the business credit catalog is resolved.

## Files Changed

- `app/admin-panel/page.tsx`
- `app/api/admin/dashboard/route.ts`
- `app/api/admin/credit-reports/status/route.ts`
- `app/api/upload-credit-report/route.ts`
- `app/api/create-order/route.ts`
- `app/api/capture-order/route.ts`
- `lib/auth/admin.ts`
- `lib/email/sendEmail.ts`
- `lib/system/logEvent.ts`
- `lib/supabase/admin.ts`
- `lib/workflows/creditRepairWorkflow.ts`
- `lib/aeo/topics.ts`
- `db/migrations/020-vestblock-ops-automation.sql`
- `docs/VESTBLOCK_SYSTEM_AUDIT.md`
- `docs/VESTBLOCK_AUTOMATION_ROADMAP.md`
- `docs/VESTBLOCK_AEO_PLAYBOOK.md`
- `.agents/skills/vestblock/*.md`

## Features Added

- Admin task automation helper.
- Automatic admin tasks for new credit report uploads.
- Automatic admin tasks for completed credit analyses.
- Automatic urgent admin tasks for failed credit analyses.
- Automatic admin tasks when reports are marked `needs_review`.
- Duplicate guard for open workflow tasks tied to the same report.
- Protected admin dashboard data API.
- Admin overview metrics.
- Credit Repair Command Center.
- Manual credit report status updates.
- User management table.
- Alerts and notifications panel.
- Recent activity feed.
- Payment and funding lead visibility.
- Resend email utility.
- Upload received emails.
- Analysis completed emails.
- Failure alert emails.
- New paid customer alert.
- System event logging wrapper.
- Central credit repair workflow status module.
- AEO topic starter registry.
- Codex operator skills for future sessions.

## Env Vars Required

- `RESEND_API_KEY`
- `ADMIN_ALERT_EMAIL`
- `FROM_EMAIL`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`
- `CRON_SECRET`

Optional payment environment:

- `PAYPAL_ENV=sandbox` for test payments
- `PAYPAL_ENV=live` for real PayPal payments

Optional legacy compatibility:

- `NEXT_PUBLIC_ADMIN_EMAIL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `RESEND_EMAIL`
- `WEB_HOST_URL`

Optional locked-down diagnostics:

- `ENABLE_ADMIN_SQL_CONSOLE=true`
- `ENABLE_DATABASE_SETUP_ROUTES=true`

## Database Changes Required

Run these Supabase migrations in order:

- `db/migrations/020-vestblock-ops-automation.sql`
- `db/migrations/021-harden-storage-buckets.sql`
- `db/migrations/022-create-admin-tasks.sql`
- `db/migrations/023-admin-task-automation-dedupe.sql`

They add:

- Credit report workflow columns.
- `email_events`
- `admin_activity`
- `admin_tasks`
- Private storage bucket hardening.
- Duplicate protection for open report-specific admin tasks.
- Admin RLS helper and policies.
- Profile role/subscription columns if missing.

## Manual Setup Steps

1. Add env vars in Vercel.
2. Run the Supabase migration.
3. Set at least one admin profile to `role = 'admin'`.
4. Verify Resend domain/from email.
5. Confirm PayPal return URL points to the intended dashboard/upload route.

## Known Issues

- `background-analyzer` still contains placeholder logic and should be refactored before being used as the canonical analysis worker.
- Supabase generated TypeScript types are stale relative to migrations.
- Debug/setup/test routes are middleware-gated for admins; raw SQL and database setup APIs also require explicit env flags before they run.
- `npm run lint` opens the Next.js ESLint setup prompt because no ESLint config is committed.
- `npx tsc --noEmit` currently fails on broad pre-existing type errors across unrelated routes/components.
- `npm run build` requires production-like env vars because some existing API routes instantiate OpenAI/Supabase during build collection.

## Verification

- `git diff --check` passed.
- `npm run build` passed when run with local dummy env values for Supabase, OpenAI, PayPal, and Resend.
- Production Vercel deploy passed for the admin task queue release.
- `npm run build` without env values failed on missing `OPENAI_API_KEY` in an existing biz-credit API route.

## Next Recommended Tasks

- Regenerate Supabase types.
- Remove legacy setup/debug routes after production recovery workflows are no longer needed.
- Add abandoned checkout and upload reminder automations.

## 2026-04-28 - Priced Offer Routing And Rendering

- Added a new shared priced-offer catalog in `lib/services/pricedOffers.ts`.
- Attached every current priced offer to a canonical VestBlock service route, public service-guide slug, and CTA path.
- Expanded `/services/[slug]` so paid offers can render as first-class service guides with price badges and structured data.
- Updated `/pricing` so higher-touch packages and Funding Assistant plans link to real service pages and action routes.
- Updated `/services/financial-growth` so each package can be opened as its own service page and preselect itself in the request form.
- Added query-driven package preselection to the financial-service request form.
- Verification:
  - `npx tsc --noEmit` passed.
  - `corepack pnpm lint` passed with warning-only repo output.
  - `corepack pnpm build` passed.

## 2026-04-28 - AI Service Deliverables

- Added `db/migrations/029-create-service-deliverables.sql` for durable paid-service deliverable storage.
- Added `lib/services/aiServiceDeliverables.ts` to generate first-pass AI deliverables for every financial service package using the existing OpenAI setup.
- Updated `app/api/service-interest/route.ts` so new paid service requests now trigger AI generation automatically after lead creation.
- Added `app/api/admin/service-deliverables/[leadId]/route.ts` so admins can load and regenerate deliverables safely.
- Updated `app/admin/leads/page.tsx` so service-package leads show deliverable status, summary, recommended actions, review focus, and a regenerate control.
- Added fallback storage to `leads.form_data.aiServiceDeliverable` so the automation still works before migration `029` is run.
- Verification:
  - `npx tsc --noEmit` passed.
  - `corepack pnpm lint` passed with warning-only repo output.
  - `corepack pnpm build` passed.

## 2026-04-28 - Service Deliverable Lifecycle, Email Delivery, And Customer Dashboard

- Added `db/migrations/030-service-deliverable-lifecycle.sql` to support the customer-delivery lifecycle on `service_deliverables`.
- Expanded the service deliverable status flow to `requested -> generating -> ready_for_review -> sent_to_client -> failed`.
- Added `markServiceDeliverableSent(...)` and persisted `customer_sent_at` / `provider_message_id` metadata where supported.
- Added `sendUserServiceDeliverableReadyEmail(...)` so paid service deliverables can be emailed to clients with a dashboard link and next actions.
- Added `app/api/admin/service-deliverables/[leadId]/send/route.ts` so admins can send ready deliverables to customers from the lead workflow.
- Added `app/api/service-deliverables/route.ts` and `app/dashboard/services/page.tsx` so customers can view delivered services inside the authenticated dashboard.
- Updated dashboard navigation and the main dashboard homepage to surface the new `My Services` area.
- Updated `app/admin/leads/page.tsx` so operators can send deliverables to clients and see delivery timestamps from the lead detail view.
- Verification:
  - `npx tsc --noEmit` passed.
  - `corepack pnpm lint` passed with warning-only repo output.
  - `corepack pnpm build` passed.
  - Production deploy passed on `https://vestblock.io`.
  - `/dashboard/services` redirects unauthenticated users to login.
  - `/api/service-deliverables` returns `401 Authentication required.` when unauthenticated.
  - `/api/admin/service-deliverables/[leadId]/send` returns `401 Admin access required.` when unauthenticated.

## 2026-04-28 - Spanish Funding Cluster Expansion

- Expanded `lib/aeo/topics.ts` with six new Spanish funding and business-credit topics:
  - `requisitos-para-financiamiento-comercial`
  - `credito-comercial-para-negocios`
  - `documentos-para-solicitar-financiamiento`
  - `como-mejorar-la-elegibilidad-para-financiamiento`
  - `lineas-de-credito-comercial`
  - `subvenciones-para-pequenos-negocios-en-espanol`
- Added first-class topic language support so Spanish topic pages no longer seed with English section headings.
- Updated `lib/content/topicSeedAssets.ts` to generate Spanish body copy, Spanish CTA labels, and better localized resource-page presentation.
- Updated `app/es/vestblock/page.tsx` to work as a stronger cluster hub by linking directly to the Spanish resource guides.
- Updated `app/resources/[slug]/page.tsx` so published Spanish resources render with Spanish-facing badges and CTA language.
- Updated `app/learn/[slug]/page.tsx` so Spanish guide routes use Spanish labels, Spanish CTA copy, and `og:locale` / `inLanguage` metadata instead of English wrapper text.
- Published the six new Spanish resource pages into `content_assets` using the production environment and live Supabase content store.
- Verification:
  - `corepack pnpm build` passed.
  - `npx tsc --noEmit` passed.
  - `corepack pnpm lint` passed with warning-only repo output.
  - Production deploy passed on `https://vestblock.io`.
  - Live `200` checks passed for `/es/vestblock` and the new Spanish resource URLs.
  - Live `sitemap.xml` now includes the new Spanish `learn` and `resources` URLs.

## 2026-04-29 - Lead Intelligence Engine

- Added `db/migrations/031-create-lead-intelligence-engine.sql`.
- Expanded the existing `leads` table to support source-aware lead intelligence fields:
  - `source`
  - `source_url`
  - `category`
  - `external_id`
  - `business_name`
  - `property_address`
  - `mailing_address`
  - `website`
  - `city`
  - `state`
  - `zip`
  - `language_signal`
  - `pain_signal`
  - `best_offer`
  - `lead_score`
  - `status_detail`
  - `unsubscribe_note`
  - `last_contacted_at`
  - `metadata_json`
- Added new lead-intelligence tables with admin-only RLS:
  - `lead_sources`
  - `lead_scores`
  - `outreach_messages`
  - `scrape_runs`
  - `lead_notes`
- Seeded example lead sources for:
  - Wisconsin DFI business filings
  - Cincinnati code enforcement
  - Milwaukee Accela enforcement
  - Google Places business search
  - SAM.gov opportunities
- Added lead intelligence libraries:
  - `lib/leads/scoring.ts`
  - `lib/leads/outreach.ts`
  - `lib/leads/repository.ts`
  - `lib/leads/service.ts`
  - `lib/leads/website-analysis.ts`
  - `lib/leads/connectors/*`
- Added admin auth helper for lead-intelligence APIs:
  - `lib/leads/admin-auth.ts`
- Added lead-intelligence API routes:
  - `/api/leads/scrape/new-businesses`
  - `/api/leads/scrape/code-violations`
  - `/api/leads/scrape/google-places`
  - `/api/leads/scrape/sam`
  - `/api/leads/score`
  - `/api/leads/generate-outreach`
  - `/api/leads/export`
- Rebuilt `/admin/leads` into a lead-intelligence dashboard with:
  - source / offer / city / status / score filtering
  - inline status updates
  - outreach regeneration
  - CSV export
  - lead detail routing
- Added:
  - `/admin/leads/[id]`
  - `/admin/lead-sources`
  - `/admin/scrape-runs`
- Added lead-intelligence setup doc:
  - `docs/VESTBLOCK_LEAD_INTELLIGENCE_README.md`
- Added `db/migrations/032-add-outscraper-lead-source.sql` to seed an optional Outscraper Google Maps source.
- Added `db/migrations/033-fix-lead-upsert-conflict.sql` to align lead upserts with a real `UNIQUE (source, external_id)` constraint.
- Added `.agents/skills/vestblock/lead-intelligence-operator.md` for future Codex/operator sessions.
- Added `lib/leads/connectors/outscraper-google-maps.ts` and upgraded `/api/leads/scrape/google-places` to support:
  - `provider: auto`
  - `provider: google`
  - `provider: outscraper`
- Upgraded `/admin/lead-sources` with:
  - direct scrape-run controls
  - provider readiness cards for Google Places, Outscraper, and SAM.gov
- Fixed the Cincinnati code-enforcement connector so the live Socrata date filter returns real results instead of `400`.
- Fixed lead ingestion so source/external-id upserts work against the live database instead of failing on `ON CONFLICT`.
- Upgraded provider-backed scrape routes to return `503` readiness payloads when keys are missing instead of generic `500`s.
- Verification:
  - `npx tsc --noEmit` passed.
  - `corepack pnpm lint` passed with warning-only repo output.
  - `corepack pnpm build` passed.
  - Local production server QA with Supabase-backed temp admin auth passed:
    - `GET /api/admin/leads` -> `200`
    - `POST /api/leads/scrape/new-businesses` -> `200`
    - `POST /api/leads/score` -> `200`
    - `POST /api/leads/generate-outreach` -> `200`
    - `POST /api/leads/scrape/google-places` -> `503` with missing-provider detail when no key is configured
    - `POST /api/leads/scrape/sam` -> `503` with missing-provider detail when no key is configured

## 2026-04-29 - Daily Content Publisher

- Added `lib/content/dailyPublisher.ts`.
- Added `app/api/cron/content-publisher/route.ts`.
- Added a daily Vercel cron in `vercel.json`:
  - `/api/cron/content-publisher` at `30 17 * * *`
- Daily publisher behavior:
  - publishes existing SEO drafts / ready assets first
  - then seeds and publishes a small batch of missing AEO topic pages
  - defaults to `2` pages per day
  - prefers Spanish content by default
  - avoids duplicate slug creation
- Added roadmap documentation for:
  - `DAILY_CONTENT_PUBLISH_LIMIT`
  - `DAILY_CONTENT_PUBLISH_PREFER_SPANISH`
  - `DAILY_CONTENT_PUBLISH_CLUSTERS`

## 2026-04-30 - AI Receptionist, Booking, And Website Offer Audit

- Added `lib/services/automationPackages.ts` as the shared source of truth for:
  - `AI Receptionist Launch`
  - `AI Receptionist + Appointment Booking`
  - `Website Upgrade Sprint`
- Updated `lib/services/pricedOffers.ts` to attach those offers to the central priced-offer system so each priced service now has:
  - a canonical service slug
  - a public service-guide page
  - a primary request route
- Rebuilt `app/ai-assistant/page.tsx` into a real offer page with:
  - unified pricing
  - package selection by query param
  - a request form that stores the selected package in the lead record
  - clearer customer language for lead capture, booking, and website upgrades
- Updated `app/api/ai-assistant-request/route.ts` to:
  - validate input with `zod`
  - save `business_name`, `website`, `best_offer`, `category`, and package metadata into `leads`
  - return an actual `500` when the request cannot be stored instead of falsely reporting success
- Updated pricing and service discovery copy across:
  - `app/pricing/page.tsx`
  - `app/services/page.tsx`
  - `lib/services/serviceDirectory.ts`
  - `lib/content/marketingServices.ts`
  - `lib/seo/serviceSeoPages.ts`
  - `app/ai-assistant/layout.tsx`
  - `components/how-it-works.tsx`
  - `app/admin-panel/page.tsx`
- Fixed duplicate service-page title tags on priced service routes by removing the extra brand suffix from generated priced-offer SEO titles.
- Verification:
  - `corepack pnpm lint` passed with existing warning-only repo output.
  - `corepack pnpm build` passed.
  - `npx tsc --noEmit` passed after build.
  - Local production QA passed on:
    - `/ai-assistant`
    - `/pricing`
    - `/services/ai-receptionist-launch`
    - `/services/website-upgrade-sprint`
  - Invalid `/api/ai-assistant-request` payload returns `400`.
  - Valid `/api/ai-assistant-request` payload succeeds when run with production Vercel env vars loaded.

## 2026-04-30 - Credit Repair Methods Audit

- Added `docs/VESTBLOCK_CREDIT_METHODS_AUDIT.md` to document the current VestBlock credit repair method stack, missing methods, and safe positioning rules.
- Added `.agents/skills/vestblock/credit-repair-methods-operator.md` so future Codex/operator sessions keep credit-method content grounded in real consumer-rights workflows.
- Added `docs/VESTBLOCK_CREDIT_BOOST_STACK.md` and `.agents/skills/vestblock/credit-boost-pack-operator.md` to capture the 30-90 day positive-history boost-pack logic for future operator sessions.
- Added `lib/credit/side-hustle-playbook.ts` to mix curated side hustles from the VestBlock side-hustle playbook directly into product recommendations and fallback UI.
- Expanded `lib/aeo/topics.ts` with new compliance-safe credit repair topics:
  - `credit-repair-methods`
  - `direct-furnisher-dispute`
  - `statement-of-dispute`
  - `identity-theft-block-and-fraud-alerts`
  - `reinserted-information-after-dispute`
  - `mixed-file-and-personal-info-disputes`
  - `outdated-negative-information`
- These topics are now live through the existing `/learn/[slug]` dynamic route and are eligible for SEO/resource seeding through VestBlock’s content automation system.
- Expanded the backend dispute workflow in:
  - `lib/letters/templates.tsx`
  - `lib/letters/ai.ts`
  - `lib/extract-negative-items.ts`
  so automated dispute generation can now support direct furnisher disputes, method-of-verification follow-up, statement-of-dispute requests, identity-theft block framing, mixed-file disputes, outdated-information review, and personal-information correction.
- Added deterministic credit-analysis enrichment in:
  - `lib/credit/recommendation-engine.ts`
  - `app/api/job-status/[jobId]/route.ts`
  - `lib/prompt-utils.ts`
  so completed analyses now get a boost-pack action sequence, richer credit-builder/card recommendations, and side-hustle recommendations even when AI output is sparse.
- Added `components/credit-boost-pack.tsx` and wired `components/analysis-result-client-view.tsx` to show a dedicated `Boost Pack` tab, plus always-rendered score-based card and income guidance.
- Added a post-signup onboarding email flow in:
  - `app/api/auth/post-signup/route.ts`
  - `lib/email/sendEmail.ts`
  - `contexts/auth-context.tsx`
  so new users immediately receive a “download your free credit report” email pointing them to `AnnualCreditReport.com`, and the delayed upload reminder now repeats that official source.
- Reframed `app/super-dispute/page.tsx` to remove unsupported “maximum results / higher success rate / proven” language and replace it with compliance-safe workflow copy.
- Reframed `app/tools/dispute-letters/page.tsx` so the advanced dispute tool is described as more tailored and organized, not as a guaranteed superior-results engine.
- Verification:
  - `corepack pnpm lint` passed with warning-only output.
  - `corepack pnpm build` passed.
  - `npx tsc --noEmit` passed after build.
  - `/learn` static generation increased to include the new credit-method pages.
  - The build also passed after wiring the boost-pack enrichment and result tabs.
  - Production smoke checks passed on:
    - `/super-dispute`
    - `/learn/credit-repair-methods`
    - `/learn/direct-furnisher-dispute`
    - `/learn/statement-of-dispute`
    - `/learn/identity-theft-block-and-fraud-alerts`
    - `/learn/reinserted-information-after-dispute`
    - `/learn/mixed-file-and-personal-info-disputes`
    - `/learn/outdated-negative-information`

## 2026-05-01 - Growth Automation Engine Upgrade

- Added `db/migrations/034-growth-automation-upgrade.sql`.
- Expanded the lead schema with:
  - urgency/contactability/language/outreach fields
  - follow-up scheduling fields
  - richer website audit storage
  - outreach send status tracking
- Added `outreach_send_events` with admin-only RLS.
- Expanded lead scoring in:
  - `lib/leads/scoring.ts`
  - `lib/leads/types.ts`
  - `lib/leads/schemas.ts`
- Expanded website weakness detection in:
  - `lib/leads/website-analysis.ts`
- Expanded lead-source and offer constants in:
  - `lib/leads/constants.ts`
- Expanded outreach generation in:
  - `lib/leads/outreach.ts`
  - `lib/leads/service.ts`
  - `lib/leads/repository.ts`
- Added outbound provider support in:
  - `lib/leads/outbound.ts`
  supporting:
  - Gmail / Google Workspace via OAuth refresh token
  - Resend fallback
- Added daily growth automation orchestrator:
  - `lib/leads/dailyAutomation.ts`
- Added daily cron routes:
  - `/api/cron/leads-scrape`
  - `/api/cron/leads-score`
  - `/api/cron/leads-outreach`
  - `/api/cron/leads-followup`
- Updated `vercel.json` to schedule the new lead cron jobs.
- Added outreach approval/send admin routes:
  - `/api/admin/leads/[id]/outreach`
  - `/api/admin/leads/bulk`
- Expanded `/api/admin/leads` to support:
  - source / offer / city / state / language / outreach filters
  - queue summary metrics
  - failed scrape visibility
- Enriched direct lead intake routes so funding, service, automation, and real-estate hand-raisers map back into the unified lead model:
  - `/api/funding-lead`
  - `/api/service-interest`
  - `/api/real-estate-lead`
  - `/api/sell-lead`
- Upgraded admin leads UI with:
  - queue summary cards
  - automation health
  - outreach approval bulk actions
  - source / offer / state / language filtering
  - send-ready indicators
- Added operator docs:
  - `docs/VESTBLOCK_GROWTH_AUTOMATION_AUDIT.md`
  - `docs/VESTBLOCK_OUTREACH_SYSTEM.md`
  - `docs/VESTBLOCK_LEAD_SOURCES.md`
- Added reusable operator skills:
  - `.agents/skills/vestblock/growth-automation-operator.md`
  - `.agents/skills/vestblock/urban-business-outreach.md`
  - `.agents/skills/vestblock/website-weakness-audit.md`
  - `.agents/skills/vestblock/real-estate-distress-outreach.md`
  - `.agents/skills/vestblock/spanish-business-growth.md`
  - `.agents/skills/vestblock/lead-scoring-and-offer-matching.md`
  - `.agents/skills/vestblock/compliant-outreach-operations.md`
- Verification:
  - `npx tsc --noEmit` passed.
  - `corepack pnpm build` passed.

## 2026-05-01 - Market Expansion Engine + CSV Lead Ops

- Added `db/migrations/035-market-expansion-and-csv-ops.sql` and applied it to Supabase.
- Added national market expansion support with:
  - `target_markets`
  - `lead_suppressions`
  - market scoring, rotation, and performance feedback
- Added `lib/leads/marketExpansion.ts` for:
  - daily city discovery
  - large / mid / small market rotation
  - niche rotation
  - 30-day re-scrape controls
  - performance-based re-queueing
- Expanded `lib/leads/dailyAutomation.ts` so daily lead runs now:
  - discover and queue new markets
  - scrape city-by-city
  - tag leads with market / niche / expansion batch data
  - enforce suppression, score, bounce-risk, and approval checks before send
  - send an operator daily market report
- Added new cron routes:
  - `/api/cron/discover-markets`
  - `/api/cron/daily-lead-run`
  - `/api/cron/send-outreach`
  - `/api/cron/update-market-performance`
- Updated `vercel.json` with the new market-expansion schedules.
- Added CSV lead management:
  - `/api/admin/leads/import`
  - expanded `/api/leads/export`
  - bulk campaign / pause / delete actions
  - dashboard import/export flows
- Expanded lead detail and dashboard UI with:
  - niche
  - campaign
  - delivery status
  - website audit detail
  - score explanation
  - market context
- Added market admin page:
  - `/admin/market-expansion`
- Added reusable operator skill:
  - `.agents/skills/vestblock/market-expansion-operator.md`
- Verification:
  - `npx tsc --noEmit` passed.
  - `corepack pnpm lint` passed with warning-only repo output.
  - `corepack pnpm build` passed.

## 2026-05-01 - Growth Focus Tightening

- Disabled SAM.gov matching by default in the live lead engine unless `LEADS_ENABLE_SAM=true`.
- Updated `/api/leads/scrape/sam` to return a clean disabled response instead of behaving like an unfinished required source.
- Updated growth-source docs to reflect that VestBlock can continue expanding through:
  - state business filings
  - city / county licensing data
  - code-enforcement and property datasets
  - CSV lead imports
  even without Google Places or Outscraper.

## 2026-05-01 - Google Growth Automation Activation

- Created and wired Google production credentials for VestBlock outreach automation:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_REFRESH_TOKEN`
  - `GOOGLE_WORKSPACE_SENDER`
  - corrected `GOOGLE_PLACES_API_KEY`
- Enabled `Places API (New)` in the `VestBlock Outreach` Google Cloud project so live maps scraping can run against the production key.
- Verified the Gmail OAuth refresh-token exchange works against Google.
- Verified the production daily lead engine now completes with real Google Places market results instead of failing on provider setup.
- Optimized `searchGooglePlaces()` and the daily lead automation so the cron no longer times out by deferring expensive website audits out of the hot scrape path.
- Verified:
  - `corepack pnpm build` passed
  - `npx tsc --noEmit` passed

## 2026-05-02 - Buyer Network Engine

- Added migration `041-create-buyer-network-engine.sql` to create the buyer network schema:
  - `buyers`
  - `buyer_buy_boxes`
  - `buyer_markets`
  - `buyer_contacts`
  - `buyer_outreach_messages`
  - `buyer_outreach_runs`
  - `buyer_notes`
  - `buyer_matches`
  - `buyer_performance`
  - `buyer_relationship_events`
- Added the core buyer engine under `lib/buyers/`:
  - public buyer discovery
  - buyer website analysis
  - scoring
  - outreach generation
  - property-to-buyer matching
  - automation helpers
- Added buyer admin APIs:
  - `/api/admin/buyers`
  - `/api/admin/buyers/[id]`
  - `/api/admin/buyers/[id]/notes`
  - `/api/admin/buyers/[id]/outreach`
  - `/api/admin/buyers/bulk`
- Added property match API:
  - `/api/buyers/match`
- Added buyer cron routes:
  - `/api/cron/buyers-discover`
  - `/api/cron/buyers-score`
  - `/api/cron/buyers-outreach`
  - `/api/cron/buyers-followup`
  - `/api/cron/buyers-performance`
- Added buyer admin pages:
  - `/admin/buyers`
  - `/admin/buyers/[id]`
  - `/admin/buyer-outreach`
  - `/admin/buyer-matches`
- Added buyer-network navigation into the main admin dashboard.
- Integrated buyer matching into `/api/sell-lead` and `/api/real-estate-lead` so live property intake can persist buyer matches automatically.
- Added buyer cron schedules to `vercel.json`.
- Added operator docs:
  - `docs/VESTBLOCK_BUYER_NETWORK_STRATEGY.md`
  - `docs/VESTBLOCK_BUYER_AUTOMATION.md`
  - `docs/VESTBLOCK_BUYER_MATCHING.md`

## 2026-05-02 - Daily Intelligence And Entity SEO Expansion

- Added migration `042-daily-intelligence-and-entity-seo.sql` to create:
  - `daily_growth_reports`
  - `daily_growth_report_sections`
  - `entity_seo_opportunities`
  - `entity_seo_runs`
  - `entity_seo_performance_snapshots`
- Added the daily reporting engine in `lib/reporting/dailyIntelligence.ts`.
- Added reporting repository/types under `lib/reporting/`.
- Added the entity SEO expansion engine in `lib/content/entitySeoExpansion.ts`.
- Added cron routes:
  - `/api/cron/entity-seo-expansion`
  - `/api/cron/daily-ops-report`
- Added admin SEO opportunity API:
  - `/api/admin/seo-opportunities`
- Added admin surfaces:
  - `/admin/reports/daily`
  - `/admin/reports/daily/[date]`
  - `/admin/seo-opportunities`
- Added admin-panel links for daily reporting and SEO opportunities.
- Wired safe entity-driven SEO pages to create/publish `content_assets` automatically.
- Added operator docs:
  - `docs/VESTBLOCK_DAILY_INTELLIGENCE_AUDIT.md`
  - `docs/VESTBLOCK_DAILY_REPORTING.md`
  - `docs/VESTBLOCK_ENTITY_SEO_EXPANSION.md`

## 2026-05-01 - Real Estate Seller Messaging and Email Guardrails

- Repositioned real-estate and code-violation outreach so VestBlock speaks like a buyer/operator:
  - direct-sale conversations
  - investor review
  - practical seller options
- Removed cleanup-style phrasing from seller-facing lead messaging and scoring angles.
- Updated Milwaukee and Cincinnati property-source connectors to bias toward seller motivation and direct-sale options.
- Improved admin lead outreach errors so missing-email leads explain that phone, SMS, or DM should be used instead of failing with a vague send error.
- Disabled the admin email `Send now` action when a lead does not have a usable email address and surfaced an inline warning in the lead detail view.
- Verified:
  - `corepack pnpm build` passed
  - `npx tsc --noEmit` passed
  - `corepack pnpm lint` passed with warning-only output

## 2026-05-02 - Public Lead Email Enrichment

- Added public website email enrichment in `lib/leads/email-enrichment.ts`.
- Added a new cron route, `/api/cron/leads-enrich-email`, to harvest public contact emails from business websites and contact/about pages before scoring and outreach.
- Wired enrichment results into lead records, including:
  - primary email when a strong public match is found
  - ranked public email candidates
  - enrichment confidence, status, and source URLs
- Added conservative robots.txt checks and same-domain/business-stem scoring so the extractor prefers real business emails over stray third-party addresses.
- Added the daily cron schedule for email enrichment in `vercel.json`.
  - production deploy passed
  - `/api/cron/daily-lead-run?dryRun=1` returned successful Google Places lead batches in production

## 2026-05-01 - Morning Lead Engine Reliability Pass

- Moved expensive lead enrichment out of the scrape ingest path so the daily market scrape can stay fast under Google Places volume.
- Updated `lib/leads/service.ts` so daily lead ingestion can skip scoring during scrape and let the scheduled scoring pass handle enrichment.
- Added `scoreAndPersistLead()` to centralize:
  - scoring
  - website-audit persistence
  - email validity tagging
  - bounce-risk estimation
  - high-intent lead automation triggers
- Updated `lib/leads/scoring.ts` to reuse cached website-audit data when available instead of re-fetching the same site on every re-score.
- Tightened `listLeadsForScoring()` so the morning scoring pass prioritizes unscored / stale leads instead of churning the full table.
- Split lead follow-up and outbound email send behavior:
  - `/api/cron/leads-followup` now focuses on follow-up queue creation
  - `/api/cron/send-outreach` now focuses on approved send attempts
- Removed the duplicate scheduled scrape path from `vercel.json` so VestBlock does not run two identical market scrapes every morning.
- Increased the default outreach draft generation cap from `100` to `250` to better match real scrape volume.
- Added admin morning digests for:
  - enrichment/scoring
  - outreach draft generation
  - send queue status
- Hardened boolean env parsing so values like `false` with trailing whitespace do not accidentally behave strangely.
- Verified:
  - `corepack pnpm build` passed
  - `npx tsc --noEmit` passed

## 2026-05-01 - Email-Ready Lead Prioritization

- Updated `/api/admin/leads` so the lead queue can prioritize usable-email records first or filter to email-ready-only mode.
- Added email readiness summary counting to the admin lead dashboard.
- Added an `Email ready first / Email ready only / All leads` control in `/admin/leads`.
- Added visible readiness badges on each lead row so operators can start with sendable leads immediately.
- Extended `/api/leads/export` and `exportLeadsSchema` so email-ready-only exports match the outreach queue view.
- Verified:
  - `corepack pnpm build` passed
  - `npx tsc --noEmit` passed
  - production deploy passed at `https://vestblock.io`

## 2026-05-01 - Continuous Improvement Engine

- Added migration `036-continuous-improvement-engine.sql` to create VestBlock's daily learning layer:
  - `improvement_runs`
  - `improvement_insights`
  - `research_briefs`
  - `strategy_updates`
  - `experiment_results`
  - `prompt_versions`
  - `score_adjustments`
  - `outreach_variants`
  - `market_performance_snapshots`
  - `method_performance_snapshots`
  - `daily_operator_reports`
- Extended `content_assets` with indexing / refresh fields.
- Extended `service_deliverables` with customer-view / response / upgrade signals.
- Added `lib/improvement/continuous-improvement.ts` to analyze recent results, record insights, queue strategy changes, auto-apply low-risk adjustments, and store a daily operator report.
- Added curated research ingestion and recommendation storage.
- Wired live score adjustments into `lib/leads/scoring.ts`.
- Wired live outreach variants into `lib/leads/outreach.ts`.
- Added admin review surfaces:
  - `/admin/improvement`
  - `/admin/research`
  - `/admin/experiments`
- Added strategy approval/apply API:
  - `/api/admin/improvement/strategy-updates/[id]`
- Added scheduled optimization routes:
  - `/api/cron/improvement-review`
  - `/api/cron/research-digest`
  - `/api/cron/optimize-outreach`
  - `/api/cron/optimize-markets`
  - `/api/cron/optimize-content`
  - `/api/cron/optimize-credit-funding`
- Added admin-panel links for the new improvement surfaces.
- Added operator docs and skills for keeping the learning loop stable and understandable.

## 2026-05-02 - Lender Network Engine

- Added migration `039-create-lender-network-engine.sql` to create the lender network schema:
  - `lenders`
  - `lender_products`
  - `lender_markets`
  - `lender_programs`
  - `lender_contacts`
  - `lender_outreach_messages`
  - `lender_outreach_runs`
  - `lender_notes`
  - `lender_matches`
  - `lender_performance`
  - `lender_relationship_events`
- Added the core lender engine under `lib/lenders/`:
  - public lender discovery
  - site analysis
  - scoring
  - outreach generation
  - borrower-to-lender matching
  - automation helpers
- Added lender admin APIs:
  - `/api/admin/lenders`
  - `/api/admin/lenders/[id]`
  - `/api/admin/lenders/[id]/notes`
  - `/api/admin/lenders/[id]/outreach`
  - `/api/admin/lenders/bulk`
- Added borrower match API:
  - `/api/lenders/match`
- Added lender cron routes:
  - `/api/cron/lenders-discover`
  - `/api/cron/lenders-score`
  - `/api/cron/lenders-outreach`
  - `/api/cron/lenders-followup`
  - `/api/cron/lenders-performance`
- Added admin lender pages:
  - `/admin/lenders`
  - `/admin/lenders/[id]`
  - `/admin/lender-programs`
  - `/admin/lender-outreach`
  - `/admin/lender-matches`
- Integrated lender matching into `/api/funding/recommendation` so funding recommendations can persist lender matches automatically.
- Added lender cron schedules to `vercel.json`.
- Added operator docs:
  - `docs/VESTBLOCK_LENDER_NETWORK_STRATEGY.md`
  - `docs/VESTBLOCK_LENDER_AUTOMATION.md`
  - `docs/VESTBLOCK_LENDER_MATCHING.md`
- Upgraded lender outreach so the first touch stays focused on fit and relationship-building, while follow-up drafts now include:
  - lender qualification questions
  - partner-intake prompts
  - softer referral-program / compensation discovery language where legally appropriate
- Saved lender outreach qualification and economics guidance into outreach message metadata so it renders in the admin lender detail view.
- Added lender-detail UI safeguards so email send actions stay disabled when no usable lender email exists.
- Verified:
  - `corepack pnpm build` passed
  - `npx tsc --noEmit` passed
