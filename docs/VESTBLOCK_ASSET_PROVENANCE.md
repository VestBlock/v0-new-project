# VestBlock homepage asset provenance and copy ledger

Updated for the Signal Ledger homepage identity and social-card release.

## Asset inventory

| Asset | Use | Origin and rights | Generation details | Cost |
| --- | --- | --- | --- | --- |
| `public/vestblock-mark.svg` | Canonical square VestBlock mark | Original VestBlock-specific vector artwork created for this repository. | A built-in OpenAI image-generation concept study explored six convergence-mark directions. The shipped mark was then redrawn as deterministic SVG paths and does not embed the generated raster. The concept study is retained outside the production repository at `/Users/mrsanders/.codex/generated_images/019fed70-52c6-7480-9e61-9d70ca1c28cc/exec-da26818a-75c5-41cc-bad2-b53c5d4fe6ec.png`. Exact model parameters were not exposed by the tool. | Unavailable: the workspace image-generation tool does not expose per-generation pricing. |
| `app/icon.png`, `app/apple-icon.png`, `app/favicon.ico`, `public/brand/vestblock-icon-192.png`, `public/brand/vestblock-icon-512.png`, `public/brand/vestblock-maskable-512.png` | Browser, device, and installable-app identity | Raster derivatives of the repository-owned canonical SVG. | Rendered locally from `public/vestblock-mark.svg`; no third-party artwork. | N/A |
| `components/seo/vestblock-social-card.tsx` | Shared 1200×630 Open Graph and X/Twitter preview | Original code-rendered composition using the canonical mark, typography, and route motif. | Rendered by `next/og` through `/opengraph-image` and `/twitter-image`; no stock imagery or remote asset dependency. | N/A |
| `app/api/social-card/[pillar]/route.tsx` | 1200×1500 Capital, Deals, and Opportunity post creative | Existing code-rendered template updated to the Signal Ledger palette and convergence mark. | Rendered by `next/og`; the URL version is managed in `lib/social/visualCards.ts`. | N/A |

No stock photography, listing photography, testimonial portrait, or third-party logo is used on the homepage.

## Public copy ledger

| Surface | Release language | Claim review |
| --- | --- | --- |
| Master promise | “Find your next move.” | A navigation and preparation promise, not an outcome guarantee. |
| Platform definition | “VestBlock brings funding preparation, real-estate paths, and practical business growth into one place.” | Describes the coordinated scope without presenting VestBlock as a lender, broker, or approval authority. |
| Primary CTA | “Build my free roadmap” | Matches the `/next-move` questionnaire and its educational 7/30/60/90-day roadmap output. |
| Capital path | “Prepare for business funding” | The card states that independent providers set eligibility and terms. Property-specific financing is directed to Real Estate Deals. |
| Deals path | “Buy, sell, or fund property” | The card separates buyer, seller, property-funding, and lender starting points and retains regulated-party boundaries. |
| Opportunity path | “Build from a stronger base” | The card avoids promises about credit, leads, revenue, rankings, or profitability. |
| Example roadmap | “Educational guidance only; not an approval, offer, or guarantee.” | The artifact is labeled as an example and does not display fabricated underwriting or results. |
| Trust section | “No high-risk financial details required” | The supporting text names the specific items not requested rather than claiming no sensitive data is collected. |
| DealVault | “Keep the record that supports the work.” | Describes record continuity without claiming universal privacy or an unsupported team-access model. The example states that raw documents remain off-chain. |

## Financial-literacy guardrails

- Capital preparation means organizing the request, intended use, timing, and supporting records. It is not a commitment to lend or an approval.
- Property paths organize role, criteria, property details, and timing. Buyers, sellers, lenders, licensed providers, and closing parties retain their own decisions.
- The free roadmap is educational guidance. It is not financial, legal, tax, credit-repair, or investment advice.
- Any future interface that displays loan-to-value, loan-to-cost, debt-service coverage, return, pricing, eligibility, or a score must identify its source data, decision rule, and illustrative status.
- Testimonials, provider counts, response rates, funding totals, or performance metrics may be added only when they can be substantiated and reviewed.
