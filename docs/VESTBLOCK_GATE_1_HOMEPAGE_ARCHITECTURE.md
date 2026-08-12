# VestBlock Gate 1: Homepage Architecture and Route Map

Status: architecture proposal for the Gate 2 approval stop

## Narrative in one sentence

VestBlock helps a visitor name the move they want to make, understand what is ready and what needs work, choose a Capital, Deals, or Opportunity path, and keep active work organized through DealVault when a durable record is useful.

The homepage must not ask visitors to identify with an internal team, profession, or product before they understand what VestBlock can help them do.

## Visitor task sequence

1. Understand VestBlock in five seconds.
2. Choose Capital, Deals, or Opportunity, or ask VestBlock to recommend a path.
3. See the real offerings inside that path, including access type and limitations.
4. Open the correct destination.
5. Keep records, proof, milestones, and next actions connected through DealVault when the work calls for it.

## Proposed homepage order and copy

### 1. Hero: make the company understandable

**Eyebrow:** Capital · Deals · Opportunity

**Headline:** Find your next move.

**Explanation:** VestBlock brings capital access, deal pathways, and opportunities to build, acquire, or grow into one coordinated place. Understand your options, prepare what matters, and act with a clear next step.

**Primary action:** Build my free roadmap → planned `/next-move`

**Secondary action:** Choose a path → `#choose-your-path`

**Clickable hero doorways:**

| Doorway | Visitor meaning | Destination |
| --- | --- | --- |
| Capital | Prepare for funding and understand the paths that may fit | `#capital-path` |
| Deals | Sell, source, assess, fund, or coordinate an active opportunity | `#deals-path` |
| Opportunity | Strengthen credit, income, business readiness, or growth | `#opportunity-path` |

The primary action will remain visually strongest. The three doorways will be real links with visible hover and focus states and at least a 44×44-pixel target.

### 2. Choose what you need: reveal the actual platform

**Heading:** Start with the outcome you want.

**Body:** Choose a path below, or answer a few questions and let VestBlock organize the next steps around your goal, timeline, and current position.

The initial view shows three outcome groups, not three generic cards. Each group previews the most common goals and expands to show the full directory.

| Capital goals | Deals goals | Opportunity goals |
| --- | --- | --- |
| Check funding readiness | Sell or assess a property | Build a personalized roadmap |
| Prepare a stronger application | Share buyer or lender criteria | Review credit readiness |
| Set up a fundable business | Analyze or fund an active deal | Find practical income paths |
| Build business credit | Explore an acquisition path | Prepare or grow a business |
| Find grant opportunities | Coordinate records and milestones | Improve lead capture or visibility |

**Section action:** Not sure where to begin? Build my free roadmap → planned `/next-move`

### 3. How VestBlock works: explain the handoff between subjects

**Heading:** One goal. A clear sequence.

| Step | Visitor-facing copy | What it prevents |
| --- | --- | --- |
| 1. Tell us the goal | Start with what you want to fund, sell, acquire, build, or improve. | A role-heavy intake that sends people to the wrong product |
| 2. See what is ready | Get a plain-language analysis of the information, timing, and preparation that matter. | Premature applications, scattered tasks, and unclear expectations |
| 3. Choose the right path | Continue with a VestBlock tool, request a review, or consider an appropriate partner route. | The page appearing to jump between unrelated businesses |
| 4. Keep active work connected | Use DealVault when agreements, proof, milestones, or payout references need a durable record. | Treating DealVault as the master brand or a detached software product |

### 4. Capital: detailed path

**Heading:** Prepare for capital with a clearer file.

**Body:** Start with readiness. VestBlock can help organize business records, funding purpose, credit considerations, and deal details before a lender or funding partner makes a decision.

| Offering | What it is | Who it helps | What the visitor receives | Access | Destination | Limitation |
| --- | --- | --- | --- | --- | --- | --- |
| Business funding eligibility | A short readiness check | Business owners deciding whether to apply or prepare first | Eligibility summary and a suggested next step | Free | `/funding#free-eligibility-check` | No approval, rate, limit, or timing promise |
| Business Funding Prep Plan | A reviewed preparation plan | Owners who need stronger documents, sequencing, or application readiness | Document checklist and funding-prep recommendations | Paid; $300 plan | `/funding/business-funding-strategy` | Final underwriting and terms belong to the provider |
| Business setup | Preparation guidance for entity, banking, records, and use of funds | New or early-stage owners | A practical setup sequence | Free guidance | `/business-setup` | Not legal, tax, or accounting advice |
| Business credit roadmap | A guided vendor, monitoring, card-timing, and lender-prep tool | Owners building a business credit profile | Four-part business credit roadmap | Account required | `/tools/business-credit` | No score, tradeline, approval, or funding guarantee |
| Grant matching | A profile-led grant search and application-language tool | Owners looking for relevant programs | Potential matches and draft application language | Member tool | `/tools/grants` | Eligibility, deadlines, and award decisions must be verified with the program |
| Funding and business-credit prep reviews | Focused one-time reviews | Owners who want a human-reviewed file before applying | Selected readiness review and documented next steps | Paid; scope confirmed first | `/services/financial-growth` | Educational preparation, not an approval service |
| Real-estate funding review | Deal-specific capital intake | Investors and property owners with DSCR, rental, flip, bridge, or hard-money needs | Deal and borrower context prepared for review | Requires review; may be partner-routed | `/real-estate-funding` | Financing depends on underwriting and lender terms |

**Primary action:** Check funding readiness → `/funding#free-eligibility-check`

### 5. Deals: detailed path

**Heading:** Move an opportunity from interest to informed review.

**Body:** Real estate appears here as a major VestBlock deal path. Sellers, buyers, lenders, builders, and operators can bring the facts into view before an introduction, funding review, or recorded next step.

| Offering | What it is | Who it helps | What the visitor receives | Access | Destination | Limitation |
| --- | --- | --- | --- | --- | --- | --- |
| Seller Property Review | A structured property and seller-context intake | Owners considering cash, creative, novation, or partner sale paths | A review-ready property submission | Free submission; requires review | `/sell` | No offer, structure, or closing timeline is promised before review |
| Buyer criteria | A reusable acquisition profile | Cash buyers, landlords, flippers, and institutional buyers | A stored buy box for better-fit introductions | Free submission; partner route | `/buyers` | No deal volume or match is promised |
| Lender criteria | A reusable lending profile | Private and business-purpose lenders | A stored lending box for review-ready opportunities | Free submission; partner route | `/lenders` | No borrower, volume, or closing is promised |
| Property analysis | A screening tool for deal context | Sellers, investors, and operators assessing a property | A structured property analysis | Public tool | `/property-analyzer` | Screening is not an appraisal, title opinion, or investment recommendation |
| Real-estate funding | A deal-specific funding intake | Investors and owners with an active property scenario | A file prepared for lender or partner review | Requires review; may be partner-routed | `/real-estate-funding` | Subject to underwriting and third-party terms |
| Builder, developer, and project routing | Goal and capacity intake for project-fit review | Builders, developers, contractors, and capital partners | A route to the appropriate project conversation | Current route is generic; planned questionnaire | Planned `/next-move`; current fallback `/get-started` | Dedicated public intake is partial and must not be overstated |
| Business acquisition path | Guided routing for a visitor who wants to acquire a business | Prospective business buyers | A recommended preparation or review path | Planned free questionnaire | Planned `/next-move` | No supported public acquisition workflow exists yet; do not present this as live fulfillment |
| DealVault | Deal records, proof, milestones, agreement references, and payout references | Teams with active partner or milestone risk | A durable shared record and demo path | Paid plans; demo first | `/dealvault/demo` | Does not replace legal counsel, escrow, title, custody, or compliance obligations |

**Primary action:** Explore deal paths → `/sell`, with visible adjacent buyer, lender, analyzer, and funding choices rather than a single catch-all CTA.

### 6. Opportunity: detailed path

**Heading:** Strengthen the position behind your next move.

**Body:** Opportunity covers personal readiness, income, business formation, and growth support. It gives visitors a place to improve the conditions around a future capital or deal decision without pretending every visitor should apply or invest now.

| Offering | What it is | Who it helps | What the visitor receives | Access | Destination | Limitation |
| --- | --- | --- | --- | --- | --- | --- |
| Free Next-Move Roadmap | A five-minute goal and readiness questionnaire | Visitors who need help choosing among personal, business, real-estate, or mixed goals | Immediate summary, primary path, two secondary paths, next actions, and a 30/60/90-day roadmap | Planned free public value before login | Planned `/next-move` | Route is not built; public result must use safe deterministic fallbacks when AI is unavailable |
| Credit review | Credit-report analysis and improvement guidance | People who choose to review credit before a capital move | Findings and a credit-readiness roadmap | Account required; optional paid access where applicable | `/credit-upload` | No deletion, score increase, or result is guaranteed |
| Dispute support | User-reviewed dispute-letter tools | People addressing information they believe is inaccurate | Draft letters and status tools | Account required | `/tools/dispute-letters` | The user must verify facts; no bureau outcome is guaranteed |
| Card and credit-builder readiness | Education about timing, fit, fees, utilization, and application restraint | People whose roadmap indicates credit-building may be appropriate | Readiness guidance and, where appropriate, product comparisons | Planned inside `/next-move`; existing account components | Planned `/next-move` | Issuers control approval and terms; unnecessary applications may create hard inquiries; affiliates must be disclosed beside recommendations |
| Credit Boost Pack | A sequenced set of credit-building actions and supporting resources | Visitors who need foundational steps before new applications | A clear action sequence | Planned free roadmap resource; existing capability is fragmented | Planned `/next-move` | No specific score gain or timeline is promised |
| Side-hustle and income paths | Recommendations matched to skills, time, and starting budget | Visitors who want practical ways to improve cash flow | A short list of reasoned options and first steps | Planned inside `/next-move`; existing member components | Planned `/next-move` | No income, demand, or profitability guarantee |
| Business creation and preparation | Entity, banking, document, and business-credit basics | New and early-stage owners | A preparation sequence | Free guidance | `/business-setup` | Not legal or tax advice |
| AI receptionist and website systems | Lead capture, booking, and website support | Real-estate and service businesses with response or conversion gaps | Scoped setup options and a review request | Paid service | `/ai-assistant` | No appointment or revenue guarantee |
| Visibility expansion | Search, answer-engine, local-page, content, and authority support | Businesses that need clearer discovery and trust | A visibility review and scoped service options | Paid service | `/visibility-expansion` | No ranking, traffic, mention, media, or revenue guarantee |

**Primary action:** Build my free roadmap → planned `/next-move`

### 7. DealVault: the record beneath active work

**Heading:** Keep the record that supports the work.

**Body:** DealVault keeps agreement references, approvals, proof, milestones, and payout references together when a capital, deal, or opportunity path becomes active. It supports the work without replacing contracts, escrow, title, legal advice, or professional compliance.

**Actions:** See a DealVault record → `/dealvault/demo`; review DealVault → `/dealvault`

### 8. Trust, privacy, and proof

**Heading:** Know what VestBlock does before you share information.

The section will expose four compact statements with links to full documents:

- VestBlock helps visitors prepare, compare, organize, and request review. Third parties control approvals, terms, awards, matches, rankings, and closings.
- The free questionnaire will not request Social Security numbers, full account numbers, passwords, or a complete credit report.
- Saving or emailing a roadmap and receiving marketing require separate consent. Marketing consent will never be prechecked.
- Affiliate relationships and product verification dates will appear beside any product-specific recommendation.

**Proof:** Use real interface evidence and documented service outputs. Do not use invented metrics, anonymous testimonials, or unverified performance claims.

### 9. Free questionnaire close

**Heading:** Start with your goal.

**Body:** Answer a few questions about your goal, timeline, current position, and main obstacle. VestBlock will return a practical starting roadmap before asking you to create an account.

**Primary action:** Build my free roadmap → planned `/next-move`

**Secondary action:** Browse all services → `/services`

## Progressive-disclosure behavior

- The hero shows the three paths and one recommendation CTA.
- The directory initially shows the five most common goals per path.
- “See every Capital option,” “See every Deals option,” and “See every Opportunity option” expand inline without changing the meaning of the path.
- Each expanded item exposes exactly six facts: what it is, who it helps, what the visitor receives, access type, primary destination, and limitation.
- The detailed path sections repeat the same names and destinations; they add context rather than inventing new categories.
- On mobile, paths appear as an accessible accordion after the three hero links. The selected anchor opens its matching path.

## Route verification decision log

| Decision | Result |
| --- | --- |
| Preserve approved master positioning | Yes: Capital, Deals, and Opportunity remain primary; real estate is introduced inside Deals |
| Replace profession-first network section | Yes: goals lead; professions appear only where they clarify who an offering helps |
| Use `/get-started` as the free roadmap | No: the current route is role-heavy and does not provide the promised public analysis |
| Claim a public business-acquisition service | No: source references describe real-estate acquisition teams, not a supported business-acquisition customer workflow |
| Claim builder/developer intake is complete | No: the current fallback is generic, so the homepage will label this route as review-based until `/next-move` exists |
| Claim credit, grants, or dispute tools are public | No: live requests redirect to login; access labels must say account required |
| Present card products without context | No: product-specific claims require APR, fees, last-verified date, issuer-control language, hard-inquiry caution, and affiliate disclosure |
| Present DealVault as the company | No: it appears after the three primary paths as the record and coordination layer |

## Five-second comprehension acceptance test

An unfamiliar visitor must be able to answer:

1. VestBlock helps me understand and act on a capital, deal, or growth-related next move.
2. I can choose Capital, Deals, or Opportunity, or ask for a free roadmap.
3. Real estate is a Deals path, not the definition of VestBlock.
4. DealVault keeps records connected once work becomes active.
5. Results that depend on issuers, lenders, grant programs, partners, or markets are not guaranteed.

## Gate 1 result

The proposed architecture connects the current platform without changing the approved brand direction. It also identifies two gaps that must remain explicit until later gates: `/next-move` does not exist, and business-acquisition plus builder/developer routing do not yet have dedicated public workflows.
