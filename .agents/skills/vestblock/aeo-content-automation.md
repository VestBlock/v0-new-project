# AEO Content Automation

Use this skill when planning or adding VestBlock AEO/SEO content for credit repair, dispute letters, business credit, funding, grants, or financial opportunity topics.

## Starter Source

Use `lib/aeo/topics.ts` as the topic registry.

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
