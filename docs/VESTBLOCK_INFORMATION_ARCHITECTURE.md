# VestBlock Information Architecture

## Brand model

**VestBlock helps people find capital, deals, and opportunities.**

Brand line: **Find your next move.**

Supporting line: **Capital, deals, and opportunities brought together in one network.**

The platform asks where a visitor is trying to go, then routes them into existing VestBlock systems. Real estate remains a major pillar; funding returns as a peer pillar; useful business-building systems remain available without dominating the homepage.

## Primary public navigation

| Label | Canonical doorway | Primary job | Existing systems reached |
| --- | --- | --- | --- |
| Capital | `/capital` | Start the appropriate capital journey | `/funding`, `/real-estate-funding`, lender matching, funding readiness, business credit |
| Deals | `/deals` | Enter a property or deal workflow | `/deal-hunter`, `/property-analyzer`, `/sell`, `/buyers`, DealVault |
| Opportunities | `/opportunities` | Discover a relevant curated resource | grants, business credit, resources, learning, selected services |
| DealVault | `/dealvault` | Understand or advance trusted deal records | demo and authenticated DealVault workspace |

Account actions remain visually separate: **Log in** and one **Start** action. Pricing, affiliates, seller/buyer/lender role links, calculators, and tools move to the correct doorway, footer, or authenticated workspace.

## Homepage structure

1. **Hero:** “Find your next move.” One opportunity-network scene connects Capital, Deals, and Opportunity. Primary CTA: **Explore VestBlock** to the three doors. Secondary: **Find capital**. Text link: **Find deals**.
2. **Three doors:** unequal, authored path panels with one concrete action each. No catalog wall.
3. **How the network works:** tell VestBlock what you need → use existing qualification/analysis → move to a clear next step.
4. **Product proof:** show real workflows and verifiable capabilities, not fabricated counts.
5. **DealVault:** proof, milestones, and partner records as a trust layer, not a crypto spectacle.
6. **Curated opportunity layer:** grants, business credit, and useful resources, visibly secondary.
7. **Final routing CTA:** ask the visitor to choose the next move.

The homepage routes; it does not explain every feature.

## Doorway architecture

### Capital (`/capital`)

Primary job: start the right capital journey.

- **Business funding:** eligibility and strategy via `/funding`.
- **Investment property funding:** DSCR and real-estate financing via `/real-estate-funding`.
- **Funding readiness:** business credit and credit-related support only when relevant.
- **Capital partners:** lender-network participation via `/lenders`, framed for the partner persona.

Primary CTA: **Check funding paths**. One secondary comparison lets a visitor choose business versus investment-property capital.

### Deals (`/deals`)

Primary job: enter the correct property/deal workflow.

- **Find an opportunity:** `/deal-hunter`.
- **Analyze a property:** `/property-analyzer`.
- **Sell a property:** `/sell`.
- **Share a buy box:** `/buyers`.
- **Record an active deal:** `/dealvault` or authenticated workspace.

Primary CTA: **Explore deals**. Seller and buyer actions are supporting role paths, not five equal hero buttons.

### Opportunities (`/opportunities`)

Primary job: find a useful existing resource without creating a junk drawer.

- **Grants:** `/tools/grants`.
- **Business credit:** `/tools/business-credit`.
- **Learn:** `/learn` and `/resources`.
- **Business-growth services:** only selected, relevant entries from `/services` and visibility expansion.

Primary CTA: **Explore opportunities**. Items must be curated, concrete, and labeled by outcome.

## Role and intent routing

Progressively learn two things, then route:

1. Who are you? Investor/buyer, business owner/borrower, seller, lender/capital partner, developer/operator.
2. What do you need now? Find capital, find deals, sell property, analyze property, or grow the business.

Do not require a long profile before showing value. Existing `/get-started` and `/user-hub` behavior should be merged into this model incrementally, not replaced wholesale.

## Authenticated information architecture

The dashboard’s primary question is: **What needs attention next?**

- Active next steps and recent activity
- Capital applications and readiness
- Active deals and DealVault milestones
- Documents and reports
- Relevant opportunities
- Profile/settings

Specialty tools remain accessible from the workspace but do not become peer navigation items.

## URL and SEO policy

- Keep existing capital, seller, buyer, lender, analyzer, DealVault, market, learning, service, and campaign URLs.
- New `/capital`, `/deals`, and `/opportunities` routes are additive doorway pages, not replacements or redirect targets for established pages.
- Preserve current canonicals, metadata, structured data, robots, sitemap generation, Open Graph, and language routes.
- If a legacy route is later removed, require analytics/backlink review, dependency search, and a permanent redirect.
- Use natural topic clusters: business funding, real-estate investing, DSCR, property analysis, deal sourcing, lender matching, and investment-property funding.

## Conversion jobs by primary page

| Page | One primary job | Primary action |
| --- | --- | --- |
| Homepage | Route the visitor | Explore VestBlock |
| Capital | Start the right capital journey | Check funding paths |
| Deals | Enter a deal workflow | Explore deals |
| Opportunities | Discover a relevant resource | Explore opportunities |
| DealVault | Advance or understand an active opportunity | Open DealVault / see demo |
| Dashboard | Show the next required action | Continue next step |
| Login/register | Complete secure account access | Sign in / create account |

## Analytics contract

Preserve PostHog and Google Ads. Add or standardize:

- `homepage_cta_clicked`
- `capital_flow_started`
- `deal_flow_started`
- `opportunity_flow_started`
- existing sign-up, funding-lead, seller-lead, payment, partner, and workspace events

Events must carry only necessary non-sensitive context such as placement and destination. Do not send financial details, documents, or secrets as analytics properties.

## Mobile navigation

- 44 px minimum targets.
- Capital, Deals, Opportunities, and DealVault appear first.
- Account actions are separated.
- Menu closes on navigation, traps focus while open, supports Escape, and prevents background interaction.
- No motion or canvas is required to understand or use a route.

## Out of primary navigation

Admin, diagnostics, database setup, AI chat, dispute letters, credit upload, affiliate registration, pricing, visibility services, PR, SAM, outreach, content automation, and provider operations remain available in contextual locations or direct routes. Their absence from the header is not deprecation.
