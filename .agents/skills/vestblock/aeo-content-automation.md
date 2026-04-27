# AEO Content Automation

Use this skill when planning or adding VestBlock AEO/SEO content for credit repair, dispute letters, business credit, funding, grants, or financial opportunity topics.

## Starter Source

Use `lib/aeo/topics.ts` as the topic registry.
Use `lib/content/marketingServices.ts` as the service catalog for dashboard-generated SEO, social, and campaign content.
Use `content_assets` for generated drafts, manual publishing status, and public SEO pages.

## Topic Clusters

- AI credit repair
- Credit dispute letters
- 609 letters
- Method of verification
- Charge-off disputes
- Collection disputes
- Business credit
- EIN business credit
- Funding readiness
- Grants for small businesses
- Business setup for funding
- Financiamiento para negocios en espanol
- Credit builder tools
- Secured credit cards
- Rent reporting
- Tradelines education
- Debt validation
- Credit utilization

## Content Rules

- Do not generate hundreds of pages without a real template and QA process.
- Do not create thin pages that only swap keywords.
- Avoid illegal guarantees or fake credit repair promises.
- Each page should answer a concrete question and point to a real VestBlock workflow.
- Use `/admin-panel` -> Content for operator-generated drafts.
- Public generated SEO pages live at `/resources/[slug]` after an admin marks an SEO asset `published`.
- Social posts and campaigns are manual-post assets until a social platform integration is added.

## Internal Linking

- Credit repair pages link to `/credit-upload`, `/super-dispute`, and `/dashboard`.
- Business credit pages link to `/tools/business-credit`.
- Funding pages link to `/funding`, `/business-setup`, and lead flows.
- Grant pages link to grant/funding offers and education.
- Spanish business funding content links to `/es/vestblock` and the approved Bank Breezy Spanish URL: `https://Bankbreezy.com/es/Vestblock`.

## Spanish SEO Rules

- Keep Spanish pages human, practical, and specific to business owners.
- Do not promise funding, grants, credit lines, or approvals.
- Explain preparation steps: EIN, banking, documents, revenue, business credit, and use of funds.
- Add Spanish routes to `app/sitemap.ts` and allow the route family in `app/robots.ts`.
- Do not generate many translated pages until language QA and partner tracking are in place.

## Dashboard Generation

When expanding the generator:

- Keep prompts tied to `vestblockMarketingServices`.
- Store output in `content_assets`; do not hardcode generated posts in route files.
- Preserve status controls: `draft`, `ready`, `published`, `archived`.
- Log `content_generated` and `content_published` to `admin_activity`.
- Require `OPENAI_API_KEY`; use `OPENAI_CONTENT_MODEL` only as an optional override.
