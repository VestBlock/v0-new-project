export type PlatformLaneId = 'capital' | 'real-estate' | 'opportunity' | 'dealvault'

export type PlatformRoute = {
  title: string
  body: string
  href: string
  access: string
  boundary: string
}

export type PlatformLane = {
  id: PlatformLaneId
  label: string
  eyebrow: string
  headline: string
  introduction: string
  href: string
  primaryAction: string
  primaryHref: string
  routes: PlatformRoute[]
  sequence: Array<{ title: string; body: string }>
}

export const platformLanes: Record<PlatformLaneId, PlatformLane> = {
  capital: {
    id: 'capital',
    label: 'Capital',
    eyebrow: 'Prepare before a provider decides',
    headline: 'Build a clearer path to the capital your next move requires.',
    introduction:
      'VestBlock helps you organize the objective, readiness factors, supporting information, and appropriate funding path before a lender or capital partner makes an independent decision.',
    href: '/capital',
    primaryAction: 'Review my capital path',
    primaryHref: '/capital?path=business-funding#capital-intake',
    routes: [
      { title: 'Business funding', body: 'Define the use of funds, business position, timing, and preparation gaps.', href: '/capital?path=business-funding#capital-intake', access: 'Free eligibility review', boundary: 'Providers control underwriting, limits, pricing, and terms.' },
      { title: 'Real estate funding', body: 'Prepare a property-specific request for DSCR, bridge, rental, flip, or other deal review.', href: '/capital?path=real-estate-funding#capital-intake', access: 'Free intake · review required', boundary: 'Funding remains subject to lender criteria and deal review.' },
      { title: 'Business acquisition capital', body: 'Organize acquisition criteria, diligence questions, capital needs, and readiness.', href: '/capital?path=business-acquisition#capital-intake', access: 'Free roadmap', boundary: 'No valuation, financing, or closing outcome is promised.' },
      { title: 'Business credit and readiness', body: 'Sequence entity, banking, records, credit, and selective application preparation.', href: '/capital?path=business-credit#capital-intake', access: 'Free account tool', boundary: 'No score, tradeline, approval, or funding guarantee.' },
      { title: 'Verified grants and programs', body: 'Explore potential programs and organize the information needed to verify fit.', href: '/capital?path=grants-programs#capital-intake', access: 'Account tool', boundary: 'Eligibility, deadlines, and awards must be verified with each program.' },
      { title: 'Capital provider participation', body: 'Share lending coverage and criteria so appropriate requests can be reviewed.', href: '/capital?path=capital-provider#capital-intake', access: 'Free provider profile', boundary: 'Each provider controls availability, compliance, pricing, and acceptance.' },
    ],
    sequence: [
      { title: 'Define the objective', body: 'Clarify the amount, purpose, timing, and business or deal context.' },
      { title: 'Review readiness', body: 'Identify the records, credit factors, economics, and open questions that matter.' },
      { title: 'Continue responsibly', body: 'Use the right VestBlock workflow or prepare for an independent provider review.' },
    ],
  },
  'real-estate': {
    id: 'real-estate',
    label: 'Real Estate',
    eyebrow: 'One hub for every side of the opportunity',
    headline: 'Bring buyers, sellers, capital, properties, and operators into the right path.',
    introduction:
      'Real Estate begins with your role and objective—not a seller form. Explore freely, then create an account when you are ready to save criteria, submit information, or continue a personalized path.',
    href: '/real-estate',
    primaryAction: 'Choose my real estate path',
    primaryHref: '/real-estate#real-estate-paths',
    routes: [
      { title: 'Buy or invest', body: 'Save markets, asset types, price range, strategy, close speed, and no-go criteria.', href: '/buyers', access: 'Free buyer profile', boundary: 'No inventory, match, exclusivity, or closing is guaranteed.' },
      { title: 'Sell or submit a property', body: 'Organize property condition, timing, price context, occupancy, and seller priorities.', href: '/sell', access: 'Free property submission', boundary: 'No offer, structure, price, or closing timeline is promised.' },
      { title: 'Finance an active deal', body: 'Prepare property economics, capital needs, experience, and supporting context.', href: '/real-estate-funding', access: 'Free intake · review required', boundary: 'Lenders control underwriting, pricing, conditions, and final terms.' },
      { title: 'Provide capital', body: 'Share states, loan range, asset appetite, borrower fit, speed, and required documentation.', href: '/lenders', access: 'Free lender profile', boundary: 'VestBlock routes for review; providers control every lending decision.' },
      { title: 'Develop, build, or operate', body: 'Create a project-fit brief for development, construction, improvement, or operating support.', href: '/next-move?focus=builder-developer', access: 'Free roadmap · review required', boundary: 'No project, contract, capital, or introduction is guaranteed.' },
      { title: 'Analyze a property', body: 'Screen known facts and economics using one consistent decision structure.', href: '/property-analyzer', access: 'Free analysis tool', boundary: 'Not an appraisal, title opinion, inspection, or investment recommendation.' },
    ],
    sequence: [
      { title: 'Choose your role', body: 'Buyer, seller, lender, operator, or active-deal participant.' },
      { title: 'Organize the criteria', body: 'Capture only the facts needed to understand fit and the appropriate next workflow.' },
      { title: 'Keep active work connected', body: 'When a path becomes real work, use DealVault for records, milestones, and payout references.' },
    ],
  },
  opportunity: {
    id: 'opportunity',
    label: 'Opportunity',
    eyebrow: 'Strengthen the position behind the next move',
    headline: 'Turn a goal into an ordered, practical starting roadmap.',
    introduction:
      'VestBlock helps people and businesses understand what to improve, prepare, or test next across credit, income, business formation, acquisition readiness, visibility, and growth.',
    href: '/opportunity',
    primaryAction: 'Build my free roadmap',
    primaryHref: '/next-move',
    routes: [
      { title: 'Free Next-Move Roadmap', body: 'Answer focused questions and receive an ordered 7, 30, 60, and 90-day starting plan.', href: '/next-move', access: 'Free · no account required', boundary: 'Educational analysis, not a promise of a financial result.' },
      { title: 'Credit review and roadmap', body: 'Upload a report securely, receive analysis status, and work through foundational steps.', href: '/credit-upload', access: 'Free account tool', boundary: 'No deletion, score increase, approval, or timing is guaranteed.' },
      { title: 'Income path', body: 'Choose and test practical income ideas around current time, skills, and starting capacity.', href: '/next-move?focus=increase-income', access: 'Free roadmap', boundary: 'No income, demand, employment, or profitability guarantee.' },
      { title: 'Start or structure a business', body: 'Organize the offer, entity, banking, records, and operating foundations.', href: '/business-setup', access: 'Free guidance', boundary: 'Not legal, tax, accounting, or regulatory advice.' },
      { title: 'Grow an existing business', body: 'Identify the current constraint and choose a measurable next action.', href: '/next-move?focus=grow-business', access: 'Free roadmap', boundary: 'Execution and market conditions determine outcomes.' },
      { title: 'Visibility and lead response', body: 'Review discovery, trust, response, and conversion opportunities.', href: '/visibility-expansion', access: 'Paid support available', boundary: 'No ranking, traffic, citation, lead, or revenue result is guaranteed.' },
    ],
    sequence: [
      { title: 'Name the outcome', body: 'Begin with the decision or result you are working toward.' },
      { title: 'See the current position', body: 'Make constraints, available time, and missing preparation understandable.' },
      { title: 'Work the next actions', body: 'Follow an ordered plan and retain progress in your customer workspace.' },
    ],
  },
  dealvault: {
    id: 'dealvault',
    label: 'DealVault',
    eyebrow: 'Continuity for active work',
    headline: 'Keep agreements, evidence, milestones, and payout references connected.',
    introduction:
      'DealVault is VestBlock’s record layer for opportunities that have become active work. It supports continuity and accountability without placing private documents or sensitive deal details on a public chain.',
    href: '/dealvault',
    primaryAction: 'See the DealVault demo',
    primaryHref: '/dealvault/demo',
    routes: [],
    sequence: [
      { title: 'Create the record', body: 'Connect the agreement and its supporting proof to one durable reference.' },
      { title: 'Track the work', body: 'Keep milestones, submissions, decisions, and permissions in sequence.' },
      { title: 'Preserve accountability', body: 'Retain the supporting history for partner and payout questions.' },
    ],
  },
}

export type ScenarioId = 'business' | 'property' | 'sell' | 'readiness' | 'participate'

export const platformScenarios: Array<{
  id: ScenarioId
  short: string
  title: string
  lane: PlatformLaneId
  href: string
  action: string
  access: string
  vestblock: string
  decision: string
  needed: string
}> = [
  { id: 'business', short: 'Business', title: 'Fund or grow a business', lane: 'capital', href: '/capital', action: 'Review my capital path', access: 'Free to explore · Account required to save', vestblock: 'Organizes the objective, readiness factors, records, and suitable preparation path.', decision: 'Lenders and capital partners independently set eligibility, pricing, limits, and terms.', needed: 'Business stage, use of funds, timing, current revenue, and available records.' },
  { id: 'property', short: 'Acquire', title: 'Find, buy, or finance a property', lane: 'real-estate', href: '/real-estate', action: 'Set my property criteria', access: 'Free to explore · Review required for matching', vestblock: 'Turns market, property, budget, strategy, and funding criteria into a structured request.', decision: 'Sellers, lenders, and providers control availability, acceptance, underwriting, and closing.', needed: 'Target markets, asset type, price range, timeline, strategy, and funding position.' },
  { id: 'sell', short: 'Sell', title: 'Sell or submit a property', lane: 'real-estate', href: '/sell', action: 'Review my sale path', access: 'Free submission · Human review follows', vestblock: 'Organizes the property, condition, timing, and priorities for an appropriate sale-path review.', decision: 'Buyers and providers decide whether to make an offer, propose terms, or continue.', needed: 'Property location, condition, timeline, occupancy, price context, and contact preference.' },
  { id: 'readiness', short: 'Readiness', title: 'Improve credit, income, or readiness', lane: 'opportunity', href: '/opportunity', action: 'Build my free roadmap', access: 'Free analysis · Account required to save progress', vestblock: 'Creates an ordered starting roadmap from the goal, position, constraints, and available time.', decision: 'Creditors, issuers, programs, employers, and partners control their own decisions.', needed: 'Goal, timeline, current position, main obstacle, and optional context. No SSN is requested.' },
  { id: 'participate', short: 'Participate', title: 'Offer capital, inventory, or services', lane: 'real-estate', href: '/join?next=%2Fworkspace&intent=participate', action: 'Create a participant profile', access: 'Free profile · Criteria reviewed before routing', vestblock: 'Captures what you provide, where you operate, who fits, and how opportunities should reach you.', decision: 'Each participant controls availability, compliance, pricing, acceptance, and delivery.', needed: 'Role, coverage, criteria, capacity, contact owner, and required credentials or disclosures.' },
]
