# VestBlock Gate 0 — Production Baseline and System Truth

Audit date: 2026-08-12
Production: <https://vestblock.io>
Status vocabulary: `working and verified`, `implemented but unverified`, `partial`, `configured but unused`, `missing`, `intentionally disabled`

## Recoverable production baseline

| Item | Evidence | Status |
| --- | --- | --- |
| Production domain | `https://vestblock.io` returned HTTP 200 | working and verified |
| Vercel project | `robert-sanders-projects-f3e473a9/v0-vest-block-rebuild` from `.vercel/project.json` and CLI inspection | working and verified |
| Approved deployment | `dpl_F9ga1JMyQs9yunvm5VZ4Eo4U78XN` / `https://v0-vest-block-rebuild-oxejpmy13.vercel.app` | working and verified |
| Production aliases | `vestblock.io`, `www.vestblock.io`, `v0-vest-block-rebuild.vercel.app` | working and verified |
| Approved source rollback point | `9905ed964e3dcf6d5495d4a6a944ca8e13c8db63` (`feat: preserve approved Material Ledger release`) | working and verified |
| Runtime-reported Git SHA | `/api/health` reports `2fcc5b6`; the deployment was built from the then-uncommitted Material Ledger tree | partial |
| Source/deployment relationship | Commit `9905ed9` preserves the exact application changes and assets used by deployment `dpl_F9ga...`; the SHA mismatch is metadata caused by deploying before committing | working and verified |
| Type safety | `pnpm typecheck` exited 0 after baseline capture | working and verified |
| Desktop evidence | `output/playwright/gated-completion/gate-0/production-desktop.png` | working and verified |
| Mobile evidence | `output/playwright/gated-completion/gate-0/production-mobile.png` | working and verified |

### Recovery instructions

To restore the exact hosted artifact without rebuilding, promote the preserved Vercel deployment:

```bash
cd "/Users/mrsanders/Downloads/Codex Folder"
pnpm dlx vercel promote https://v0-vest-block-rebuild-oxejpmy13.vercel.app
```

To restore from source without disturbing the current branch, create a recovery branch from the preserved commit, verify it, and deploy it to the existing linked project:

```bash
cd "/Users/mrsanders/Downloads/Codex Folder"
git switch -c codex/restore-material-ledger 9905ed964e3dcf6d5495d4a6a944ca8e13c8db63
pnpm typecheck
pnpm build
pnpm dlx vercel --prod
```

Do not create a second Vercel project during recovery.

## Public service truth table

HTTP results below were checked against `https://vestblock.io` on 2026-08-12. A successful route response proves reachability, not the complete downstream transaction.

| Public offering | Primary route | Access/result | Operational truth | Status |
| --- | --- | --- | --- | --- |
| VestBlock master homepage | `/` | 200 | Material Ledger release is live; current hero doorways are not links | partial |
| Goal intake | `/get-started` | 200 | Public intake route exists; it is not yet the unified free Next-Move Questionnaire | partial |
| Business funding eligibility | `/funding#free-eligibility-check` | 200 page | Form and recommendation code exist; live end-to-end lead delivery was not exercised in this gate | implemented but unverified |
| Funding preparation plan | `/funding/business-funding-strategy` | 200 | Paid-plan route exists; payment, CRM, and follow-up were not exercised | implemented but unverified |
| Business setup | `/business-setup` | 200 | Public preparation guidance exists | working and verified |
| Business credit tools | `/tools/business-credit` | 307 to login | Capability exists but is member-gated; homepage must disclose access | partial |
| Grants | `/tools/grants` | 307 to login | Capability exists but is member-gated; homepage must disclose access | partial |
| Funding and business-credit prep reviews | `/services/financial-growth` | route exists in source | Paid review offer exists; not live-tested in this gate | implemented but unverified |
| Spanish funding | `/es/vestblock` | route exists in source | Spanish route and partner destination exist; partner handoff was not tested | implemented but unverified |
| Real-estate funding | `/real-estate-funding` | 200 | Public deal/funding intake exists; no financing result is promised | implemented but unverified |
| Seller property review | `/sell` | 200 | Public seller intake exists; downstream review was not exercised | implemented but unverified |
| Buyer path | `/buyers` | 200 | Public buyer criteria route exists; matching and follow-up remain unverified | implemented but unverified |
| Lender path | `/lenders` | 200 | Public lender route exists; matching and follow-up remain unverified | implemented but unverified |
| Property analysis | `/property-analyzer` | 200 | Public analyzer route exists; report generation was not exercised | implemented but unverified |
| DealVault overview | `/dealvault` | 200 | Public explanation exists | working and verified |
| DealVault demo | `/dealvault/demo` | 200 | Public demo route exists; protected health endpoint returned 403 to an anonymous check as expected | partial |
| DealFlow Growth Support | `/dealflow-growth-system` | route exists in source | Paid offer exists; its real-estate scope must not redefine VestBlock | implemented but unverified |
| Credit report tools | `/credit-upload` | 307 to login | Capability exists but is member-gated; no public free value before login | partial |
| Dispute support | `/tools/dispute-letters` | 307 to login | Capability exists but is member-gated | partial |
| AI receptionist and website systems | `/ai-assistant` | 200 | Public paid-service intake exists; fulfillment not exercised | implemented but unverified |
| Visibility expansion | `/visibility-expansion` | 200 | Public paid-service route exists; delivery claims remain guarded | implemented but unverified |
| Services directory | `/services` | 200 | Public directory exists but is not yet integrated into the homepage narrative | partial |
| Pricing | `/pricing` | 200 | Public pricing route exists | working and verified |
| Resources | `/resources` | 200 | Public resource index exists | working and verified |
| Learning library | `/learn` and `/learn/:slug` | 200 index / dynamic source route | Content library exists; every slug was not individually live-tested | partial |
| Free Next-Move Questionnaire | `/next-move` | no route | Required unified public funnel is not built | missing |

## Page-route inventory

The repository contains 102 page routes. This grouping accounts for every page route at commit `9905ed9`.

| Route group | Routes | Status |
| --- | --- | --- |
| Public master and directory | `/`, `/get-started`, `/services`, `/services/:slug`, `/services/financial-growth`, `/pricing`, `/resources`, `/resources/:slug`, `/learn`, `/learn/:slug`, `/es/vestblock` | partial |
| Capital and preparation | `/funding`, `/funding/business-funding-strategy`, `/business-setup`, `/real-estate-funding`, `/real-estate-funding/thanks`, `/calculators`, `/property-analyzer` | implemented but unverified |
| Deals and partner intake | `/sell`, `/sell/:market`, `/buyers`, `/lenders`, `/deal-hunter`, `/dealflow-growth-system`, `/partners/buyers/:token`, `/partners/lenders/:token` | implemented but unverified |
| Opportunity and growth | `/ai-assistant`, `/visibility-expansion`, `/visibility-expansion/case-study`, `/visibility-expansion/proof-hub`, `/proof`, `/smart-contracts` | partial |
| Authentication | `/login`, `/register`, `/forgot-password`, `/reset-password`, `/affiliates/register`, `/affiliates/application-pending` | implemented but unverified |
| Authenticated customer tools | `/analysis/results/:jobId`, `/chat`, `/credit-dashboard/:reportId`, `/credit-upload`, `/dashboard`, `/dashboard/funding`, `/dashboard/services`, `/profile`, `/roadmap`, `/super-dispute`, `/tools/business-credit`, `/tools/dispute-letters`, `/tools/grants`, `/tools/my-dispute-letters`, `/user-hub` | implemented but unverified |
| Authenticated DealVault | `/dashboard/dealvault`, `/dashboard/dealvault/:dealId`, `/dashboard/dealvault/new`, `/dashboard/dealvault/milestone-vault`, `/dashboard/dealvault/partner-pay`, `/dashboard/dealvault/proof-vault` | implemented but unverified |
| Admin and operator surfaces | `/admin`; `/admin-panel`; `/admin-panel/reports/:reportId`; `/admin-panel/users/:userId`; all 33 `/admin/*` pages; `/dev/command-center-preview` | implemented but unverified |
| Protected diagnostics | `/auth-debug`, `/credit-report-diagnostic`, `/database-diagnostic`, `/setup-database`, `/admin/test` | intentionally disabled |

The admin set consists of: `/admin/blockchain`, `/admin/buyer-matches`, `/admin/buyer-outreach`, `/admin/buyers`, `/admin/buyers/:id`, `/admin/command-center`, `/admin/deal-hunter`, `/admin/dealflow`, `/admin/dealvault`, `/admin/experiments`, `/admin/funding`, `/admin/improvement`, `/admin/investor-partnerships`, `/admin/lead-sources`, `/admin/leads`, `/admin/leads/:id`, `/admin/lender-matches`, `/admin/lender-outreach`, `/admin/lender-programs`, `/admin/lenders`, `/admin/lenders/:id`, `/admin/market-expansion`, `/admin/pr-engine`, `/admin/reports/daily`, `/admin/reports/daily/:date`, `/admin/research`, `/admin/research-checklists`, `/admin/revenue-command`, `/admin/scrape-runs`, `/admin/seo-opportunities`, and `/admin/test`.

## Backend workflow inventory

The repository contains 202 route handlers. The groups below account for every handler by route family and observed purpose; existence is not counted as operational proof.

| Workflow family | Count | Scope | Status |
| --- | ---: | --- | --- |
| Admin and Command Center | 65 | `/api/admin/*`: leads, buyers, lenders, research, property intelligence, content, reports, tasks, DealVault, strategy, copilot/autopilot, outreach, service delivery | implemented but unverified |
| Scheduled strategy and operations | 56 | `/api/cron/*`: strategy, research, discovery, scoring, follow-up, seller, buyer, lender, investor, content, SEO/AEO, DealMachine, ATTOM, SAM.gov, mailbox, reports | partial |
| DealVault | 13 | create/update records, milestones, proof, certificates, payouts, health, pilot interest | implemented but unverified |
| AI and analysis | 11 | chat, roadmap, letters, PDFs, side-hustle guidance, OpenAI connectivity | implemented but unverified |
| Funding | 8 | applications, approvals, products, profile, progress, recommendation, payment plan | implemented but unverified |
| Partner network | 7 | buyer/lender signup, matching, portals, partner applications | implemented but unverified |
| Lead and service intake | 7 | funding, real estate, seller, service, visibility, scoring/export | implemented but unverified |
| Credit and dispute | 8 | credit analysis initiation/upload plus dispute letter generation, retrieval, status, PDF, signed URL | implemented but unverified |
| Webhooks and event transport | 6 | generic webhook, Resend, DealMachine, strategy source batch, Inngest | partial |
| Payments and orders | 3 | capture/create order, PayPal processing/webhook | implemented but unverified |
| Property intelligence | 3 | analyzer, report, property intelligence | implemented but unverified |
| Internal database operations | 3 | SQL and database setup routes; protected by middleware in production | intentionally disabled |
| Miscellaneous public/system endpoints | 12 | health, documents, grants, job status, site preview, and supporting endpoints | partial |

### Vercel-scheduled workflows

All 14 schedules exist in `vercel.json`; schedule presence does not prove the downstream work completed.

| Schedule | Route | Status |
| --- | --- | --- |
| `0 14,17,20,23 * * *` | `/api/cron/boss-daily-loop` | partial |
| `30 4 * * *` | `/api/cron/daily-ops-report` | implemented but unverified |
| `30 13,19 * * *` | `/api/cron/strategy-engine` | intentionally disabled |
| `0 11,18 * * *` | `/api/cron/strategy-source-orchestrator` | implemented but unverified |
| `30 21 * * *` | `/api/cron/seller-followup?excludeDealMachine=true` | intentionally disabled |
| `15 15 * * *` | `/api/cron/partner-network-pipeline` | intentionally disabled |
| `45 15 * * *` | `/api/cron/linkedin-task-queue?limit=40` | intentionally disabled |
| `15 * * * *` | `/api/cron/mailbox-sync` | implemented but unverified |
| `30 12 * * *` | `/api/cron/attom-enrichment?limit=10&mode=smart` | implemented but unverified |
| `15 5 * * *` | `/api/cron/improvement-review` | implemented but unverified |
| `0 10 * * *` | `/api/cron/aeo-site-audit` | implemented but unverified |
| `15 10 * * *` | `/api/cron/entity-seo-expansion` | implemented but unverified |
| `30 10 * * *` | `/api/cron/visibility-aeo-publisher?limit=2` | implemented but unverified |
| `0 12 * * *` | `/api/cron/visibility-indexing-push?inspectLimit=5` | implemented but unverified |

## Integration truth table

| Integration | Production configuration | Repository usage | Evidence/status |
| --- | --- | --- | --- |
| Vercel | linked project, domain, deployment, cron configuration present | hosting and schedules | working and verified |
| Supabase/Postgres | URL, anon, service role, JWT, pooled and direct database variables present | authentication, CRM-style data, DealVault, funding, admin | partial; `/api/health` reports Supabase configured, but a complete data journey was not run |
| OpenAI | `OPENAI_API_KEY` present | chat, content, grants, outreach drafting, roadmaps | implemented but unverified |
| Resend | API key and webhook secret present | transactional/outbound modules and delivery reconciliation | partial; no live test email was sent in Gate 0 |
| Outlook/Microsoft Graph | client ID, client secret, tenant ID, and acquisitions mailbox present | `lib/email/outlookMailbox.ts`, mailbox cron | implemented but unverified |
| Buffer | API key and VestBlock Facebook channel ID present | standalone Buffer content-calendar script only | configured but unused by the production app |
| n8n | webhook URL and webhook secret present; URL is not an absolute HTTP URL; API key missing | no application references to any n8n variable | partial / configured but unused / missing API key |
| ATTOM | API and cache/budget configuration present; enrichment flag on | property enrichment workflows | implemented but unverified |
| DealMachine | API and webhook credentials present | ingest, acquisition, and outreach workflows | implemented but unverified |
| Apify / Outscraper / Hunter | credentials present | discovery/enrichment scripts and routes | implemented but unverified |
| Google OAuth / Workspace / Search Console / Places | credentials and site values present | mailbox/search/places/indexing workflows | implemented but unverified |
| IndexNow | key present | indexing push | implemented but unverified |
| SAM.gov | API key present | opportunity ingestion, scoring, alerts | implemented but unverified |
| PayPal | client, secret, webhook ID present | order/payment routes | implemented but unverified |
| DealVault blockchain | addresses, RPC, private key, chain configuration present | DealVault contract interfaces | partial; public feature flag on, chain operations not exercised |
| Vercel Blob | read/write token present | storage capability | configured but unused in the Gate 0 journey |
| OpenAI Ads | `OPENAI_ADS_API_KEY` present | no direct code reference found | configured but unused |
| PostHog | no live analytics reported by `/api/health`; no production PostHog variable | no active requirement | missing by design / not operational |
| Twilio | no production variable in the audited set | no active requirement | missing by design / not operational |
| Postiz | no production variable in the audited set | no active requirement | missing by design / not operational |

## Production environment-variable inventory

No values are recorded here. This accounts for all 130 names returned by the Vercel production environment pull.

| Status | Variables |
| --- | --- |
| working and verified | `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`, Vercel project/system variables required by the active deployment |
| partial | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_HOST`, `POSTGRES_DATABASE`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `OPENAI_API_KEY`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `MICROSOFT_GRAPH_CLIENT_ID`, `MICROSOFT_GRAPH_CLIENT_SECRET`, `MICROSOFT_TENANT_ID`, `OUTLOOK_ACQUISITIONS_MAILBOX`, `FROM_EMAIL`, `OUTREACH_REPLY_TO_EMAIL`, `OUTREACH_MAILING_ADDRESS`, `OPERATIONS_REPORT_EMAIL`, `ADMIN_ALERT_EMAIL` |
| configured but unused | `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET`, `BUFFER_API_KEY`, `BUFFER_FACEBOOK_CHANNEL_ID`, `OPENAI_ADS_API_KEY`, `BLOB_READ_WRITE_TOKEN` |
| missing | `N8N_API_KEY` |
| intentionally disabled | `AUTO_SEND_ENABLED`, `BOSS_DAILY_LOOP_CRON_SEND`, `BOSS_DAILY_LOOP_ENABLE_SEND`, `BUYERS_PIPELINE_CRON_SEND`, `BUYER_AUTO_SEND_ENABLED`, `COMMAND_CENTER_AUTOPILOT_ENABLE_SEND`, `INVESTOR_AUTO_SEND_ENABLED`, `LENDER_AUTO_SEND_ENABLED`, `STRATEGY_ENGINE_EXECUTION_ENABLED`, `OUTREACH_REQUIRE_REPLY_CAPTURE`, `LEADS_THROUGHPUT_REFILL_ENABLED` |
| implemented but unverified | `APIFY_TOKEN`, `ATTOM_API_BASE_URL`, `ATTOM_API_KEY`, `ATTOM_DAILY_CALL_LIMIT`, `ATTOM_DISTRESS_CACHE_DAYS`, `ATTOM_ENRICHMENT_ENABLED`, `ATTOM_EQUITY_CACHE_DAYS`, `ATTOM_MAX_PROPERTIES_PER_RUN`, `ATTOM_PROFILE_CACHE_DAYS`, `ATTOM_TIMEOUT_MS`, `ATTOM_TRIAL_END_DATE`, `BOSS_DAILY_LOOP_CRON_DISPATCH`, `BOSS_SELLER_BUDGET_MS`, `BOSS_SELLER_SEND_LIMIT_PER_RUN`, `BUYERS_DAILY_APPROVAL_LIMIT`, `BUYERS_DAILY_FOLLOWUP_LIMIT`, `BUYERS_DAILY_MARKET_COUNT`, `BUYERS_DAILY_NICHE_COUNT`, `BUYERS_DAILY_OUTREACH_LIMIT`, `BUYERS_DAILY_SCORE_LIMIT`, `BUYERS_DAILY_SEND_LIMIT`, `BUYERS_SEND_LIMIT_PER_RUN`, `BUYER_AUTO_APPROVE_MIN_SCORE`, `BUYER_DISCOVERY_PREFER_FREE`, `BUYER_ENRICHMENT_PREFER_FREE`, `COMMAND_CENTER_AUTOPILOT_CRON_DISPATCH`, `DEALMACHINE_API_KEY`, `DEALMACHINE_WEBHOOK_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_PLACES_API_KEY`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN`, `GOOGLE_SEARCH_CONSOLE_SITE_URL`, `GOOGLE_WORKSPACE_SENDER`, `HUNTER_API_KEY`, `INDEXNOW_KEY`, `LEADS_ENABLE_APIFY_YELP`, `LEADS_ENABLE_APIFY_YELP_REFILL`, `LEADS_ENABLE_SAM`, `LEADS_THROUGHPUT_DRY_RUN_REFILL`, `LEADS_THROUGHPUT_REFILL_MAPS_TIMEOUT_MS`, `LEADS_THROUGHPUT_REFILL_MARKET_COUNT`, `LEADS_THROUGHPUT_REFILL_NICHE_COUNT`, `LEADS_THROUGHPUT_SEND_LIMIT_PER_RUN`, `OUTLOOK_AUTO_CLEAN_SPAM`, `OUTREACH_V2_DAILY_QUALITY_TARGET`, `OUTSCRAPER_API_KEY`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `SAM_GOV_API_KEY` |
| DealVault implemented but unverified | `DEALVAULT_ADMIN_ADDRESS`, `DEALVAULT_BLOCKCHAIN_ADMIN_PRIVATE_KEY`, `DEALVAULT_BLOCKCHAIN_RPC_URL`, `DEALVAULT_CHAIN_ID`, `NEXT_PUBLIC_BLOCKCHAIN_NETWORK`, `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_DEALVAULT_REAL_ESTATE_ADDRESS`, `NEXT_PUBLIC_MILESTONE_VAULT_ADDRESS`, `NEXT_PUBLIC_PARTNER_PAY_ADDRESS`, `NEXT_PUBLIC_PROOF_VAULT_ADDRESS`, `NEXT_PUBLIC_ENABLE_DEALVAULT` |
| Google Ads implemented but unverified | `NEXT_PUBLIC_GOOGLE_ADS_ID`, `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL` |
| Vercel-managed build/runtime | `NX_DAEMON`, `TURBO_CACHE`, `TURBO_DOWNLOAD_LOCAL_ENABLED`, `TURBO_REMOTE_ONLY`, `TURBO_RUN_SUMMARY`, `VERCEL`, `VERCEL_ENV`, `VERCEL_GIT_COMMIT_AUTHOR_LOGIN`, `VERCEL_GIT_COMMIT_AUTHOR_NAME`, `VERCEL_GIT_COMMIT_MESSAGE`, `VERCEL_GIT_COMMIT_REF`, `VERCEL_GIT_COMMIT_SHA`, `VERCEL_GIT_PREVIOUS_SHA`, `VERCEL_GIT_PROVIDER`, `VERCEL_GIT_PULL_REQUEST_ID`, `VERCEL_GIT_REPO_ID`, `VERCEL_GIT_REPO_OWNER`, `VERCEL_GIT_REPO_SLUG`, `VERCEL_OIDC_TOKEN`, `VERCEL_TARGET_ENV`, `VERCEL_URL` |

### Environment names referenced by code but absent from production

Some are optional aliases, local/test controls, or defaults; absence does not always mean a defect. They remain `missing` until each owning workflow proves otherwise:

`ACQUISITIONS_ALERT_EMAIL`, `ADMIN_EMAILS`, `ALLOW_CONTACT_ADMIN_ALERTS`, `ALLOW_LEGACY_PAYMENT_PROCESSING`, `ALLOW_MAINNET_DEPLOYMENT`, `ALLOW_PAID_SCRAPING`, `ANALYZER_URL`, `APIFY_PROXY_COUNTRY`, `APIFY_YELP_ACTOR_ID`, `BING_INDEXNOW_KEY`, `BLOCKCHAIN_ADMIN_PRIVATE_KEY`, `BLOCKCHAIN_CHAIN_ID`, `BLOCKCHAIN_RPC_URL`, `BUSINESS_MAILING_ADDRESS`, `BUYER_PACKET_AUTO_SEND_ENABLED`, `CODEX_THREAD_ID`, `COMPANY_MAILING_ADDRESS`, `DAILY_CONTENT_PUBLISH_CLUSTERS`, `DAILY_CONTENT_PUBLISH_LIMIT`, `DAILY_CONTENT_PUBLISH_PREFER_SPANISH`, `DEALMACHINE_DAILY_CREDIT_BUDGET`, `DEALMACHINE_LEAD_STATUS_ID`, `DEALMACHINE_LIST_IDS`, `DEALMACHINE_SOURCE_ENABLED`, `DEALMACHINE_TAG_IDS`, `DEALMACHINE_WEB_TOKEN`, `DEALVAULT_E2E_BASE_URL`, `DEALVAULT_E2E_EMAIL`, `DEALVAULT_E2E_PASSWORD`, `DEBUG`, `ENABLE_INTERNAL_DIAGNOSTICS`, `ENABLE_LENDER_MATCH_PERSISTENCE`, `GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL`, `GOOGLE_SEARCH_CONSOLE_CLIENT_ID`, `GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET`, `GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY`, `INDEXNOW_API_KEY`, `INDEXNOW_KEY_LOCATION`, `INNGEST_DEV`, `INNGEST_EVENT_KEY`, `INSTANTLY_API_BASE_URL`, `INSTANTLY_API_KEY`, `INVESTOR_APIFY_MAX_WAIT_MS`, `INVESTOR_APIFY_TIMEOUT_SECS`, `LEADS_ENABLE_OUTSCRAPER`, `LEADS_TARGET_EMAILS_PER_DAY`, `LEAD_OPS_ALERT_EMAIL`, `LEAD_SOURCE_SCORECARD_SELF_TEST`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_GRAPH_DELEGATED_SCOPES`, `MICROSOFT_GRAPH_REFRESH_TOKEN`, `MICROSOFT_REFRESH_TOKEN`, `NEXT_PUBLIC_ADMIN_EMAIL`, `NEXT_PUBLIC_ADMIN_EMAILS`, `NEXT_PUBLIC_DEALVAULT_MILESTONE_VAULT_ADDRESS`, `NEXT_PUBLIC_DEALVAULT_PARTNER_PAY_ADDRESS`, `NEXT_PUBLIC_DEALVAULT_PROOF_VAULT_ADDRESS`, `NEXT_PUBLIC_GOOGLE_ADS_BANK_BREEZY_CONVERSION_LABEL`, `NEXT_PUBLIC_GOOGLE_ADS_SELL_LEAD_CONVERSION_LABEL`, `NEXT_PUBLIC_GOOGLE_ADS_SPANISH_FUNDING_CONVERSION_LABEL`, `NODE_ENV`, `ON_MARKET_CREATIVE_DISTRESS_THRESHOLD`, `ON_MARKET_CREATIVE_HARVEST_LIMIT`, `ON_MARKET_CREATIVE_LIMIT`, `ON_MARKET_CREATIVE_MARKETS`, `ON_MARKET_CREATIVE_MIN_DOM`, `ON_MARKET_CREATIVE_PRICE_MAX`, `ON_MARKET_CREATIVE_PRICE_MIN`, `OPENAI_CONTENT_MODEL`, `OPENAI_RENOVATION_MODEL`, `OPENSTREETMAP_OVERPASS_URL`, `OUTREACH_ALERT_EMAIL`, `OUTREACH_DELIVERY_PROVIDER`, `OUTREACH_FROM_EMAIL`, `OUTREACH_PER_MESSAGE_ALERTS`, `OUTREACH_SENDER_NAME`, `OUTREACH_SENDER_PHONE`, `OUTREACH_V4_DAILY_TARGET`, `OUTREACH_V4_TIME_ZONE`, `OUTSCRAPER_API_BASE_URL`, `PARTNER_PIPELINE_CRON_SEND`, `PAYPAL_ENV`, `PAYPAL_MODE`, `PDFCO_API_KEY`, `PDFTOTEXT_PATH`, `PSQL_BIN`, `PUBLIC_BUSINESS_ADDRESS`, `PYTHON`, `RESEND_EMAIL`, `SEARCH_CONSOLE_SITE_URL`, `SELLER_OUTREACH_DAILY_CAP`, `SITE_URL`, `SUPABASE_POOLER_URL`, `SUPABASE_SERVICE_KEY`, `TMPDIR`, `TS_NODE_COMPILER_OPTIONS`, `VERCEL_PROJECT_PRODUCTION_URL`, `VESTBLOCK_APP_URL`, `VESTBLOCK_BASE_URL`, `VESTBLOCK_LOCAL_BASE_URL`, `VESTBLOCK_MACHINE_MODE`, `VESTBLOCK_MONTHLY_REVENUE_TARGET`, `VESTBLOCK_PRIMARY_HOSTNAME`, `VISIBILITY_AEO_PUBLISH_LIMIT`, `WEB_HOST_URL`.

## Gate 0 result

- The approved release is recoverable from both Vercel deployment `dpl_F9ga1JMyQs9yunvm5VZ4Eo4U78XN` and Git commit `9905ed9`.
- The production domain and primary public service routes are reachable.
- The system is not ready for unattended operation: n8n is not connected, several major integrations are configured but unverified, and outbound execution remains intentionally disabled.
- The next safe work is architecture and prototype work only; no homepage implementation or deployment is authorized before Gate 2 approval.
