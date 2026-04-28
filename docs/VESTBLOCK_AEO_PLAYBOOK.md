# VestBlock AEO Playbook

## Strategy

VestBlock should publish practical answer-focused content that helps users understand credit repair, dispute rights, business credit, and funding readiness, then routes them into a real product action.

Use `lib/aeo/topics.ts` as the starter topic registry. The first public
implementation now lives at `/learn` and `/learn/[slug]`.

Use `/admin-panel` -> AEO / LLM for coverage monitoring and `/admin-panel` ->
Content for operational content creation. Generated drafts are stored in
`content_assets`; published SEO pages become public at `/resources/[slug]`.

Search discovery is handled through `app/sitemap.ts`, `app/robots.ts`, and
`app/llms.txt/route.ts`. Keep those files curated: include public learning,
offer, and tool pages; exclude admin, API, account, diagnostic, setup, test,
and user-specific report routes.

Every major service now has a static starter guide in `/services/[slug]` from
`lib/seo/serviceSeoPages.ts`. Treat those as the first indexable foundation.
Services should still get supporting social posts, comparison pages, FAQs, and
case-specific resources over time, but avoid publishing thin variants before
the core guide is useful.

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
- Credit builder tools
- Secured credit cards
- Rent reporting
- Tradelines education
- Debt validation
- Credit utilization

## Internal Linking Structure

- Credit repair pages should link to `/credit-upload`, `/super-dispute`, and `/dashboard`.
- Business credit pages should link to `/tools/business-credit` and `/funding`.
- Grant and funding pages should link to `/funding`, `/business-setup`, and relevant lead forms.
- Spanish business funding pages should link to `/es/vestblock`, `/business-setup`, and the approved Bank Breezy Spanish URL.
- Business funding strategy pages should link to `/funding/business-funding-strategy`,
  `/funding#free-eligibility-check`, and `/services/financial-growth`.
- Financial growth service pages should link to `/services/financial-growth`,
  `/funding`, `/business-setup`, `/tools/business-credit`, `/tools/grants`,
  and `/real-estate-funding` where relevant.
- Comparison pages should link to Pro features only when the offer is relevant.

## Suggested Landing Pages

- `/learn/ai-credit-repair`
- `/learn/credit-dispute-letters`
- `/learn/609-letters`
- `/learn/method-of-verification`
- `/learn/business-credit`
- `/learn/funding-readiness`
- `/learn/grants-for-small-businesses`
- `/business-setup`
- `/es/vestblock`
- `/services/ai-credit-analysis`
- `/services/business-funding-eligibility`
- `/services/business-funding-strategy`
- `/services/business-setup-funding-grants`
- `/services/financial-growth-services`
- `/services/small-business-grants`
- `/services/spanish-business-funding`
- `/services/real-estate-funding`
- `/services/sell-property`
- `/services/vestblock-ai-assistant`
- `/llms.txt`
- `/resources/[generated-slug]` for admin-approved generated SEO pages

## Manual Publishing Workflow

1. Open `/admin-panel` and select the AEO / LLM tab.
2. Review service coverage, topic clusters, LLM discovery surfaces, Spanish
   content count, and content gaps.
3. Click Draft SEO Page for a service that needs coverage.
4. Review the prefilled service, audience, language, and prompt in the Content
   tab.
5. Generate the draft, review the language, and edit manually if needed.
6. Mark content as `ready` when reviewed.
7. Mark SEO pages as `published` only when the page should be publicly visible.
8. Copy social posts from the dashboard and post manually until platform API
   posting is intentionally added.

## Direct Content Generator Workflow

1. Open `/admin-panel` and select the Content tab.
2. Choose content type: SEO page, social post, or campaign.
3. Choose the VestBlock service, language, platform, post style, audience, and
   prompt.
4. Generate the draft, review the language, and edit manually if needed.
5. Mark content as `ready` when reviewed.
6. Mark SEO pages as `published` only when the page should be publicly visible.
7. Copy social posts from the dashboard and post manually until platform API
   posting is intentionally added.

Generated pages should not be published just because they exist. Review for
accuracy, compliance, repetition, and offer fit.

## Spanish Business Funding SEO

The Spanish business funding entry point is `/es/vestblock`. It should serve
Spanish-speaking business owners who need a clear path before they apply for
funding: business identity, EIN, banking, documents, credit readiness, revenue
records, and use of funds.

Use the Bank Breezy Spanish partner link only where it is relevant:
`https://Bankbreezy.com/es/Vestblock`.

Spanish SEO rules:

- Keep the language natural and owner-focused, not machine translated.
- Avoid guarantees around funding, grants, approvals, terms, or timelines.
- Explain what to prepare before applying.
- Link back to VestBlock tools for business credit and grants when helpful.
- Keep `/es/vestblock` in the sitemap and allow `/es` in robots.
- Do not mass-generate Spanish city or industry pages until there is a QA
  process for duplicated language, compliance, and partner tracking.

Future deeper landing pages can still use category paths such as
`/credit-repair/ai-credit-analysis`, but the `/learn` family should stay the
first safe content layer until search data shows which topics deserve deeper
pages.

## FAQ Schema Ideas

- What can AI do with my credit report?
- What should a dispute letter include?
- What is a 609 letter?
- What is debt validation?
- How does credit utilization affect approval odds?
- What do lenders look for before funding?

Each `/learn/[slug]` page includes FAQPage JSON-LD generated from
`lib/aeo/topics.ts`. Keep answers short, plain, and compliant.

## Comparison Pages

- AI credit analysis vs manual credit review
- 609 letter vs debt validation letter
- Business credit card vs business line of credit
- Secured card vs credit builder loan

## Lead Magnets

- Credit report upload checklist
- Dispute documentation checklist
- Funding readiness checklist
- Business credit setup checklist
- Spanish business funding readiness checklist

## Quality Rules

- Do not promise deletions, approvals, score jumps, or guaranteed funding.
- Do not generate thin pages that only swap keywords.
- Use examples, checklists, definitions, next steps, and internal links.
- Every page should answer a real question and connect to a VestBlock workflow.
- Each topic needs a distinct audience, overview, takeaways, action steps, and
  FAQs before it goes public.
- Avoid internal wording like "workflow surface", "entity", "signal", or
  "programmatic content buildout" on customer-facing pages.

## Offer Connection

Each page should end with a relevant action:

- Upload a report for AI analysis.
- Generate dispute letters.
- Upgrade to Pro for recommendations.
- Submit a funding lead.
- Review business credit tools.
- Review Spanish funding options through the approved partner path.
