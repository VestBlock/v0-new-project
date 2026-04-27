# VestBlock AEO Playbook

## Strategy

VestBlock should publish practical answer-focused content that helps users understand credit repair, dispute rights, business credit, and funding readiness, then routes them into a real product action.

Use `lib/aeo/topics.ts` as the starter topic registry. The first public
implementation now lives at `/learn` and `/learn/[slug]`.

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
- Grant and funding pages should link to `/funding` and relevant lead forms.
- Comparison pages should link to Pro features only when the offer is relevant.

## Suggested Landing Pages

- `/learn/ai-credit-repair`
- `/learn/credit-dispute-letters`
- `/learn/609-letters`
- `/learn/method-of-verification`
- `/learn/business-credit`
- `/learn/funding-readiness`
- `/learn/grants-for-small-businesses`

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
