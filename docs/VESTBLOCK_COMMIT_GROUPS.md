# VestBlock Commit Groups

Generated from current git status on 2026-05-08. Total changed/untracked entries: 441.

Use this as a staging guide. Do not commit all groups together unless Rob explicitly asks for one large checkpoint commit.

## 01 cleanup-platform-config

Small cross-cutting safety/config cleanup that should be reviewed first.

Count: 18

- `M` `.gitignore`
- `M` `components/ui/button.tsx`
- `M` `components/ui/command.tsx`
- `M` `components/ui/input.tsx`
- `M` `components/ui/select.tsx`
- `M` `components/ui/sidebar.tsx`
- `M` `components/ui/textarea.tsx`
- `M` `contexts/auth-context.tsx`
- `??` `lib/auth/access-server.ts`
- `??` `lib/auth/access.ts`
- `??` `lib/auth/client-admin.ts`
- `M` `lib/supabase/client.ts`
- `M` `lib/system/logEvent.ts`
- `M` `middleware.ts`
- `M` `package.json`
- `M` `pnpm-lock.yaml`
- `M` `tsconfig.json`
- `M` `vercel.json`

## 02 docs-system-map

Source-of-truth docs, archive moves, and operating runbooks.

Count: 62

- `??` `.agents/skills/vestblock/admin-intelligence-operator.md`
- `??` `.agents/skills/vestblock/agentic-conversion-operator.md`
- `??` `.agents/skills/vestblock/ai-citation-growth-operator.md`
- `??` `.agents/skills/vestblock/compliant-outreach-operations.md`
- `??` `.agents/skills/vestblock/continuous-improvement-operator.md`
- `??` `.agents/skills/vestblock/credit-boost-pack-operator.md`
- `??` `.agents/skills/vestblock/credit-method-improvement.md`
- `??` `.agents/skills/vestblock/credit-repair-methods-operator.md`
- `??` `.agents/skills/vestblock/funding-strategy-improvement.md`
- `??` `.agents/skills/vestblock/growth-automation-operator.md`
- `??` `.agents/skills/vestblock/lead-intelligence-operator.md`
- `??` `.agents/skills/vestblock/lead-scoring-and-offer-matching.md`
- `??` `.agents/skills/vestblock/market-expansion-operator.md`
- `??` `.agents/skills/vestblock/market-learning-loop.md`
- `??` `.agents/skills/vestblock/nexus-sprint-orchestrator.md`
- `??` `.agents/skills/vestblock/outreach-optimization.md`
- `??` `.agents/skills/vestblock/real-estate-distress-outreach.md`
- `??` `.agents/skills/vestblock/research-ingestion.md`
- `??` `.agents/skills/vestblock/self-evolution-operator.md`
- `??` `.agents/skills/vestblock/seo-aeo-learning-loop.md`
- `??` `.agents/skills/vestblock/signal-based-outbound-operator.md`
- `??` `.agents/skills/vestblock/spanish-business-growth.md`
- `??` `.agents/skills/vestblock/urban-business-outreach.md`
- `??` `.agents/skills/vestblock/website-weakness-audit.md`
- `??` `docs/archive/`
- `??` `docs/DEALVAULT_AUDIT.md`
- `??` `docs/DEALVAULT_DEPLOYMENT.md`
- `??` `docs/DEALVAULT_INTEGRATION.md`
- `??` `docs/DEALVAULT_PRODUCT_STRATEGY.md`
- `??` `docs/DEALVAULT_SECURITY.md`
- `??` `docs/DEALVAULT_SEO_AEO_STRATEGY.md`
- `??` `docs/ENV_VARS_REQUIRED.md`
- `??` `docs/GITHUB_AGENT_INTEGRATIONS.md`
- `??` `docs/VESTBLOCK_AGENT_OPERATING_SYSTEM.md`
- `??` `docs/VESTBLOCK_AI_REVENUE_ENGINE_AUDIT.md`
- `M` `docs/VESTBLOCK_AUTOMATION_ROADMAP.md`
- `??` `docs/VESTBLOCK_BUYER_AUTOMATION.md`
- `??` `docs/VESTBLOCK_BUYER_MATCHING.md`
- `??` `docs/VESTBLOCK_BUYER_NETWORK_STRATEGY.md`
- `M` `docs/VESTBLOCK_CHANGELOG.md`
- `??` `docs/VESTBLOCK_CONTINUOUS_IMPROVEMENT_AUDIT.md`
- `??` `docs/VESTBLOCK_CREDIT_BOOST_STACK.md`
- `??` `docs/VESTBLOCK_CREDIT_METHODS_AUDIT.md`
- `??` `docs/VESTBLOCK_CURRENT_SYSTEM.md`
- `??` `docs/VESTBLOCK_DAILY_INTELLIGENCE_AUDIT.md`
- `??` `docs/VESTBLOCK_DAILY_REPORTING.md`
- `??` `docs/VESTBLOCK_ENTITY_SEO_EXPANSION.md`
- `??` `docs/VESTBLOCK_EXTERNAL_AUDIT_READINESS.md`
- `??` `docs/VESTBLOCK_GOV_INTELLIGENCE.md`
- `??` `docs/VESTBLOCK_GROWTH_AUTOMATION_AUDIT.md`
- `??` `docs/VESTBLOCK_LEAD_INTELLIGENCE_README.md`
- `??` `docs/VESTBLOCK_LEAD_SOURCES.md`
- `??` `docs/VESTBLOCK_LENDER_AUTOMATION.md`
- `??` `docs/VESTBLOCK_LENDER_MATCHING.md`
- `??` `docs/VESTBLOCK_LENDER_NETWORK_STRATEGY.md`
- `??` `docs/VESTBLOCK_OPTIMIZATION_LOOP.md`
- `??` `docs/VESTBLOCK_OUTREACH_SYSTEM.md`
- `??` `docs/VESTBLOCK_PRODUCTION_READINESS.md`
- `??` `docs/VESTBLOCK_REAL_ESTATE_LEAD_ENGINE.md`
- `??` `docs/VESTBLOCK_RESEARCH_ENGINE.md`
- `??` `docs/VESTBLOCK_STACK_FIT_AUDIT.md`
- `M` `docs/VESTBLOCK_SYSTEM_AUDIT.md`

## 03 public-website-services

Public buyer-facing website, service pages, metadata, and marketing components.

Count: 57

- `M` `app/ai-assistant/layout.tsx`
- `M` `app/ai-assistant/page.tsx`
- `M` `app/business-setup/page.tsx`
- `??` `app/dealvault/`
- `M` `app/es/vestblock/page.tsx`
- `M` `app/funding/business-funding-strategy/layout.tsx`
- `M` `app/funding/business-funding-strategy/page.tsx`
- `M` `app/funding/layout.tsx`
- `M` `app/funding/page.tsx`
- `??` `app/get-started/`
- `M` `app/globals.css`
- `??` `app/icon.png`
- `M` `app/layout.tsx`
- `M` `app/learn/[slug]/page.tsx`
- `M` `app/learn/page.tsx`
- `??` `app/opengraph-image.tsx`
- `M` `app/page.tsx`
- `??` `app/pricing/`
- `M` `app/real-estate-funding/page.tsx`
- `M` `app/real-estate-funding/thanks/page.tsx`
- `M` `app/resources/[slug]/page.tsx`
- `M` `app/robots.ts`
- `M` `app/sell/layout.tsx`
- `M` `app/sell/page.tsx`
- `M` `app/services/[slug]/page.tsx`
- `M` `app/services/financial-growth/page.tsx`
- `M` `app/services/page.tsx`
- `M` `app/sitemap.ts`
- `??` `app/smart-contracts/`
- `??` `app/visibility-expansion/`
- `M` `components/business-types-grid.tsx`
- `M` `components/cta-footer.tsx`
- `M` `components/financial-service-interest-form.tsx`
- `??` `components/get-started-page.tsx`
- `M` `components/hero-section.tsx`
- `M` `components/how-it-works.tsx`
- `??` `components/marketing/`
- `M` `components/metrics-section.tsx`
- `M` `components/navigation.tsx`
- `M` `components/property-cta-section.tsx`
- `M` `components/service-cards.tsx`
- `??` `components/site-preview-showcase.tsx`
- `??` `components/visibility-expansion-page.tsx`
- `M` `lib/aeo/topics.ts`
- `M` `lib/seo/llmFeed.ts`
- `M` `lib/seo/serviceSeoPages.ts`
- `M` `lib/seo/site.ts`
- `M` `lib/seo/structuredData.ts`
- `??` `lib/services/aiServiceDeliverables.ts`
- `??` `lib/services/automationPackages.ts`
- `M` `lib/services/financialSkillsets.ts`
- `??` `lib/services/pricedOffers.ts`
- `M` `lib/services/serviceDirectory.ts`
- `??` `lib/services/servicePackages.ts`
- `??` `lib/services/sitePreview.ts`
- `??` `lib/services/smallBusinessTemplates.ts`
- `??` `lib/services/visibilityExpansionPackages.ts`

## 04 dealvault-smart-contracts

DealVault app module, smart contracts, blockchain helpers, contract scripts, and contract docs.

Count: 17

- `??` `app/api/dealvault/`
- `??` `app/dashboard/dealvault/`
- `??` `components/dealvault/`
- `??` `contracts/`
- `??` `deployments/`
- `??` `hardhat.config.ts`
- `??` `lib/blockchain/`
- `??` `lib/dealvault/`
- `??` `public/dealvault/`
- `??` `scripts/checkDealVaultDeployReadiness.ts`
- `??` `scripts/copyAbis.ts`
- `??` `scripts/deployDealVault.ts`
- `??` `scripts/diagnoseMilestoneMainnet.ts`
- `??` `scripts/estimateDealVaultProofGas.ts`
- `??` `scripts/liveTestDealVaultProof.ts`
- `??` `scripts/smokeDealVault.ts`
- `??` `scripts/verifyDealVaultUiFlow.mjs`

## 05 lead-outreach-growth-automation

Lead intelligence, outreach queues, lender/buyer networks, PR engine, market expansion, and cron routes.

Count: 105

- `??` `app/admin/buyers/`
- `??` `app/admin/lead-sources/`
- `??` `app/admin/leads/[id]/`
- `M` `app/admin/leads/page.tsx`
- `??` `app/admin/lenders/`
- `??` `app/admin/market-expansion/`
- `??` `app/admin/pr-engine/`
- `??` `app/admin/research/`
- `??` `app/admin/scrape-runs/`
- `??` `app/admin/seo-opportunities/`
- `??` `app/api/admin/buyers/`
- `??` `app/api/admin/content/seed-topics/`
- `??` `app/api/admin/content/seed/`
- `??` `app/api/admin/content/seo-export/`
- `??` `app/api/admin/leads/[id]/`
- `??` `app/api/admin/leads/bulk/`
- `M` `app/api/admin/leads/export/route.ts`
- `??` `app/api/admin/leads/import/`
- `M` `app/api/admin/leads/route.ts`
- `??` `app/api/admin/lenders/`
- `??` `app/api/admin/markets/`
- `??` `app/api/admin/pr-engine/`
- `??` `app/api/admin/sam/`
- `??` `app/api/admin/seo-opportunities/`
- `??` `app/api/buyers/`
- `??` `app/api/cron/buyers-discover/`
- `??` `app/api/cron/buyers-followup/`
- `??` `app/api/cron/buyers-outreach/`
- `??` `app/api/cron/buyers-performance/`
- `??` `app/api/cron/buyers-score/`
- `??` `app/api/cron/content-publisher/`
- `??` `app/api/cron/daily-lead-run/`
- `??` `app/api/cron/daily-ops-report/`
- `??` `app/api/cron/discover-markets/`
- `??` `app/api/cron/entity-seo-expansion/`
- `??` `app/api/cron/growth-scoreboard-monitor/`
- `??` `app/api/cron/improvement-review/`
- `??` `app/api/cron/leads-enrich-email/`
- `??` `app/api/cron/leads-followup/`
- `??` `app/api/cron/leads-outreach/`
- `??` `app/api/cron/leads-score/`
- `??` `app/api/cron/leads-scrape/`
- `??` `app/api/cron/leads-throughput/`
- `??` `app/api/cron/lenders-discover/`
- `??` `app/api/cron/lenders-followup/`
- `??` `app/api/cron/lenders-outreach/`
- `??` `app/api/cron/lenders-performance/`
- `??` `app/api/cron/lenders-score/`
- `??` `app/api/cron/optimize-content/`
- `??` `app/api/cron/optimize-credit-funding/`
- `??` `app/api/cron/optimize-markets/`
- `??` `app/api/cron/optimize-outreach/`
- `??` `app/api/cron/partners-send-autopilot/`
- `??` `app/api/cron/pr-engine-city-expansion/`
- `??` `app/api/cron/pr-engine-discovery/`
- `??` `app/api/cron/pr-engine-monitor/`
- `??` `app/api/cron/pr-engine-outreach-queue/`
- `??` `app/api/cron/pr-engine-pitch-generation/`
- `??` `app/api/cron/pr-engine-weekly-learning/`
- `??` `app/api/cron/research-digest/`
- `??` `app/api/cron/sam-alert-delivery/`
- `??` `app/api/cron/sam-assistance-refresh/`
- `??` `app/api/cron/sam-award-monitor/`
- `??` `app/api/cron/sam-exclusion-rechecks/`
- `??` `app/api/cron/sam-match-scoring/`
- `??` `app/api/cron/sam-opportunity-ingest/`
- `??` `app/api/cron/send-outreach/`
- `??` `app/api/cron/update-market-performance/`
- `??` `app/api/leads/`
- `??` `app/api/lenders/`
- `??` `lib/analytics/`
- `??` `lib/buyers/`
- `??` `lib/content/dailyPublisher.ts`
- `??` `lib/content/entitySeoExpansion.ts`
- `M` `lib/content/marketingServices.ts`
- `??` `lib/content/seedAssets.ts`
- `??` `lib/content/topicSeedAssets.ts`
- `??` `lib/email/hunter.ts`
- `M` `lib/email/sendEmail.ts`
- `??` `lib/improvement/`
- `??` `lib/leads/admin-auth.ts`
- `??` `lib/leads/autopilot.ts`
- `??` `lib/leads/connectors/`
- `??` `lib/leads/constants.ts`
- `??` `lib/leads/csv.ts`
- `??` `lib/leads/dailyAutomation.ts`
- `??` `lib/leads/email-enrichment.ts`
- `M` `lib/leads/leadAutomation.ts`
- `??` `lib/leads/marketExpansion.ts`
- `??` `lib/leads/marketPresets.ts`
- `??` `lib/leads/outbound.ts`
- `??` `lib/leads/outreach.ts`
- `??` `lib/leads/real-estate-inventory.ts`
- `??` `lib/leads/repository.ts`
- `??` `lib/leads/schemas.ts`
- `??` `lib/leads/scoring.ts`
- `??` `lib/leads/service.ts`
- `??` `lib/leads/source-keys.ts`
- `??` `lib/leads/types.ts`
- `??` `lib/leads/utils.ts`
- `??` `lib/leads/website-analysis.ts`
- `??` `lib/lenders/`
- `??` `lib/outreach/`
- `??` `lib/pr/`
- `??` `lib/reporting/`

## 06 admin-internal-tools

Admin dashboards and internal operations UI.

Count: 25

- `??` `app/admin-panel/layout.tsx`
- `M` `app/admin-panel/page.tsx`
- `M` `app/admin-panel/reports/[reportId]/page.tsx`
- `M` `app/admin-panel/users/[userId]/page.tsx`
- `??` `app/admin/blockchain/`
- `??` `app/admin/buyer-matches/`
- `??` `app/admin/buyer-outreach/`
- `??` `app/admin/dealvault/`
- `??` `app/admin/experiments/`
- `??` `app/admin/funding/`
- `??` `app/admin/improvement/`
- `??` `app/admin/layout.tsx`
- `??` `app/admin/lender-matches/`
- `??` `app/admin/lender-outreach/`
- `??` `app/admin/lender-programs/`
- `??` `app/admin/page.tsx`
- `??` `app/admin/reports/`
- `M` `app/admin/test/page.tsx`
- `??` `components/access-status-card.tsx`
- `??` `components/admin/`
- `??` `components/workspace-activity-panel.tsx`
- `??` `lib/admin/diagnostics.ts`
- `??` `lib/admin/growthScoreboard.ts`
- `??` `lib/admin/navigation.ts`
- `M` `lib/admin/tasks.ts`

## 07 funding-credit-tools

Credit upload, dispute letters, funding assistant, grants, roadmap, PDFs, and related APIs.

Count: 67

- `M` `app/api/background-analyzer/route.ts`
- `M` `app/api/biz-credit/[id]/regenerate/route.ts`
- `M` `app/api/biz-credit/route.ts`
- `M` `app/api/capture-order/route.ts`
- `M` `app/api/create-order/route.ts`
- `M` `app/api/dispute-letters/[id]/pdf/route.ts`
- `M` `app/api/dispute-letters/[id]/regenerate/route.ts`
- `M` `app/api/dispute-letters/list/route.ts`
- `M` `app/api/dispute-letters/regenerate/route.ts`
- `M` `app/api/dispute-letters/signed-url/route.ts`
- `M` `app/api/funding-lead/route.ts`
- `??` `app/api/funding/`
- `M` `app/api/grants/route.ts`
- `M` `app/api/initiate-analysis/route.ts`
- `M` `app/api/job-status/[jobId]/route.ts`
- `M` `app/api/process-payment/route.ts`
- `M` `app/api/real-estate-lead/route.ts`
- `M` `app/api/sell-lead/route.ts`
- `M` `app/api/upload-credit-report/route.ts`
- `??` `app/dashboard/funding/`
- `M` `app/enhanced-credit-analyzer/page.tsx`
- `M` `app/roadmap/page.tsx`
- `M` `app/super-dispute/page.tsx`
- `M` `app/tools/business-credit/layout.tsx`
- `M` `app/tools/business-credit/page.tsx`
- `M` `app/tools/dispute-letters/page.tsx`
- `M` `app/tools/grants/layout.tsx`
- `M` `app/tools/grants/page.tsx`
- `??` `app/tools/my-dispute-letters/layout.tsx`
- `M` `app/tools/my-dispute-letters/page.tsx`
- `M` `app/user-hub/page.tsx`
- `M` `components/analysis-result-client-view.tsx`
- `??` `components/credit-boost-pack.tsx`
- `M` `components/credit-tools-section.tsx`
- `M` `components/debug-report-analyzer.tsx`
- `M` `components/direct-credit-analyzer.tsx`
- `??` `components/funding-admin-dashboard.tsx`
- `??` `components/funding-assistant-dashboard.tsx`
- `M` `components/funding-eligibility-checker.tsx`
- `M` `components/premade-roadmap-generator.tsx`
- `M` `components/side-hustles-tab.tsx`
- `M` `lib/bizcredit/rewriteReasonsJSON.ts`
- `??` `lib/credit/`
- `M` `lib/extract-negative-items.ts`
- `M` `lib/funding/cardStacking.ts`
- `??` `lib/funding/events.ts`
- `M` `lib/funding/fundingStrategyAutomation.ts`
- `??` `lib/funding/mock-data.ts`
- `??` `lib/funding/payment-plans.ts`
- `??` `lib/funding/publicFundingRecommendation.ts`
- `??` `lib/funding/repository.ts`
- `??` `lib/funding/schemas.ts`
- `??` `lib/funding/server.ts`
- `??` `lib/funding/strategy-engine.ts`
- `??` `lib/funding/types.ts`
- `M` `lib/grants/letter.ts`
- `M` `lib/letters/ai.ts`
- `M` `lib/letters/templates.tsx`
- `M` `lib/payments/products.ts`
- `M` `lib/pdf-extraction-service-fallback.ts`
- `M` `lib/pdf-extraction-service.ts`
- `??` `lib/pdf/`
- `M` `lib/pdfco-service.ts`
- `M` `lib/text-utils.ts`
- `M` `lib/workflows/creditRepairWorkflow.ts`
- `M` `lib/workflows/disputeLetterAutomation.ts`
- `M` `lib/workflows/processCreditReportAnalysis.ts`

## 08 database-migrations-types

Supabase migrations, schema assets, and generated/maintained database types.

Count: 26

- `??` `db/migrations/028-create-funding-assistant.sql`
- `??` `db/migrations/029-create-service-deliverables.sql`
- `??` `db/migrations/030-service-deliverable-lifecycle.sql`
- `??` `db/migrations/031-create-lead-intelligence-engine.sql`
- `??` `db/migrations/032-add-outscraper-lead-source.sql`
- `??` `db/migrations/033-fix-lead-upsert-conflict.sql`
- `??` `db/migrations/034-growth-automation-upgrade.sql`
- `??` `db/migrations/035-market-expansion-and-csv-ops.sql`
- `??` `db/migrations/036-continuous-improvement-engine.sql`
- `??` `db/migrations/037-continuous-improvement-engine-finalize.sql`
- `??` `db/migrations/038-add-lead-score-segment-columns.sql`
- `??` `db/migrations/039-create-lender-network-engine.sql`
- `??` `db/migrations/040-fix-lender-upsert-constraints.sql`
- `??` `db/migrations/041-create-buyer-network-engine.sql`
- `??` `db/migrations/042-daily-intelligence-and-entity-seo.sql`
- `??` `db/migrations/043-analysis-job-and-credit-report-compat.sql`
- `??` `db/migrations/044-create-partner-portal-access.sql`
- `??` `db/migrations/045-create-sam-intelligence.sql`
- `??` `db/migrations/046-create-pr-engine.sql`
- `??` `db/migrations/047-upgrade-pr-engine-automation.sql`
- `??` `db/migrations/048-add-visibility-expansion-lead-type.sql`
- `??` `db/migrations/049-upgrade-chat-history.sql`
- `??` `db/migrations/050-upgrade-user-documents.sql`
- `??` `db/migrations/051-create-chat-and-document-foundations.sql`
- `??` `supabase/`
- `M` `types/supabase.ts`

## 09 chat-documents-partners-portals

Chat history, document foundations, partner portals, health/site preview, and related APIs.

Count: 24

- `??` `app/api/auth/`
- `??` `app/api/chat/history/`
- `M` `app/api/chat/route.ts`
- `??` `app/api/documents/`
- `??` `app/api/health/`
- `??` `app/api/inngest/`
- `??` `app/api/portal/`
- `??` `app/api/service-deliverables/`
- `M` `app/api/service-interest/route.ts`
- `??` `app/api/site-preview/`
- `??` `app/api/visibility-expansion-request/`
- `M` `app/chat/page.tsx`
- `??` `app/dashboard/services/`
- `??` `app/partners/`
- `??` `components/partners/`
- `??` `components/providers/`
- `??` `lib/ai/`
- `??` `lib/chat/`
- `??` `lib/debug/`
- `??` `lib/documents/`
- `??` `lib/inngest/`
- `??` `lib/partners/`
- `??` `lib/sam/`
- `??` `lib/utils/`

## 10 qa-tests

Playwright and smoke test assets not already grouped with contracts.

Count: 4

- `??` `playwright.config.ts`
- `??` `scripts/manual-ops-batch.ts`
- `??` `scripts/send-retry-batch.ts`
- `??` `tests/`

## 11 legacy-review-before-action

Deletion candidates, redirects, old debug pages, or files that need human review before removal.

Count: 16

- `M` `app/access/page.tsx`
- `D` `app/api/analyze-report/route.ts`
- `M` `app/api/test-analysis/route.ts`
- `M` `app/api/test-formdata/route.ts`
- `M` `app/api/test-openai-connection/route.ts`
- `M` `app/api/test-openai-simple/route.ts`
- `M` `app/api/test-openai/route.ts`
- `M` `app/api/test-streaming/route.ts`
- `M` `app/auth-debug/page.tsx`
- `M` `app/credit-report-diagnostic/page.tsx`
- `M` `app/test-analysis-debug/page.tsx`
- `M` `app/test-upload/page.tsx`
- `M` `components/auth-debug.tsx`
- `D` `components/enhanced-credit-analyzer-client.tsx`
- `D` `components/enhanced-credit-analyzer.tsx`
- `M` `components/openai-test.tsx`

## 12 unclassified-review

Anything not matched by the current organization rules.

Count: 20

- `M` `app/api/admin/dashboard/route.ts`
- `??` `app/api/admin/improvement/`
- `??` `app/api/admin/partner-portal/`
- `??` `app/api/admin/service-deliverables/`
- `M` `app/api/ai-assistant-request/route.ts`
- `M` `app/api/chat-direct/route.ts`
- `M` `app/api/chat-simple/route.ts`
- `M` `app/api/chat-with-analysis/route.ts`
- `M` `app/api/generate-pdf/route.ts`
- `M` `app/api/generate-roadmap/route.ts`
- `M` `app/credit-upload/page.tsx`
- `M` `app/dashboard/page.tsx`
- `M` `app/login/page.tsx`
- `M` `app/register/page.tsx`
- `M` `lib/openai-service.ts`
- `M` `lib/prompt-utils.ts`
- `M` `lib/server-document-processor.ts`
- `??` `public/google126f24c3ab4256f5.html`
- `??` `test/`
- `??` `vendor/`
