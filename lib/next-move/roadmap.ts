import type {
  NextMoveAnswers,
  NextMoveFocus,
  NextMovePath,
  NextMoveResource,
  NextMoveRoadmap,
  NextMoveRoadmapStep,
} from '@/lib/next-move/types'

type FocusPlan = {
  label: string
  primaryPath: NextMovePath
  secondaryPaths: NextMovePath[]
  firstAction: string
  preparation: string
  review: string
  decision: string
  resources: NextMoveResource[]
  cautions: string[]
  manualReview?: boolean
}

const sharedCreditCautions = [
  'Credit guidance is educational. No deletion, score increase, approval, limit, rate, or timing is guaranteed.',
  'Card issuers and lenders control approval and terms. Avoid unnecessary applications because a new application may create a hard inquiry.',
]

const focusPlans: Record<NextMoveFocus, FocusPlan> = {
  'business-funding': {
    label: 'business funding preparation', primaryPath: 'Capital', secondaryPaths: ['Opportunity'],
    firstAction: 'Define the amount, purpose, timing, and use of proceeds before comparing providers.',
    preparation: 'Organize entity records, banking history, revenue evidence, ownership details, and a current debt schedule.',
    review: 'Use the free funding-readiness check to identify missing documentation and application-timing risks.',
    decision: 'Compare only the paths that fit the completed file, then request review before applying.',
    resources: [
      { title: 'Business funding readiness', description: 'Organize the request and receive a preparation summary.', href: '/funding#free-eligibility-check', access: 'Free', limitation: 'No approval, rate, limit, or funding timeline is promised.' },
      { title: 'Business Funding Prep Plan', description: 'A higher-touch reviewed preparation plan.', href: '/funding/business-funding-strategy', access: 'Paid', limitation: 'Final underwriting and terms belong to the provider.' },
    ], cautions: sharedCreditCautions,
  },
  'real-estate-funding': {
    label: 'real-estate funding review', primaryPath: 'Capital', secondaryPaths: ['Real Estate'],
    firstAction: 'Define the property, requested capital, intended strategy, timing, and exit assumptions.',
    preparation: 'Gather property facts, purchase or payoff context, renovation scope, income assumptions, and borrower information.',
    review: 'Run the property through a screening analysis and flag any unsupported value or income assumption.',
    decision: 'Submit a complete file for lender or partner review only after the economics and documents align.',
    resources: [
      { title: 'Real-estate funding intake', description: 'Prepare an active property scenario for review.', href: '/real-estate-funding', access: 'Review required', limitation: 'Financing depends on underwriting, collateral, and third-party terms.' },
      { title: 'Property analysis', description: 'Structure the property facts and screening assumptions.', href: '/property-analyzer', access: 'Free', limitation: 'Screening is not an appraisal, title opinion, or investment recommendation.' },
    ], cautions: ['Property values, rents, repair costs, title, and financing terms must be independently verified.'],
  },
  grants: {
    label: 'grant preparation', primaryPath: 'Capital', secondaryPaths: ['Opportunity'],
    firstAction: 'Define the project, eligible applicant, location, measurable use of funds, and deadline window.',
    preparation: 'Prepare entity records, budget, project narrative, impact evidence, and required registrations.',
    review: 'Check each program at its official source before investing time in an application.',
    decision: 'Apply only where eligibility is documented and the application can be supported with evidence.',
    resources: [
      { title: 'Grant matching workspace', description: 'Search potential programs and organize application language.', href: '/tools/grants', access: 'Member tool', limitation: 'Eligibility, deadlines, and award decisions must be verified with the program.' },
      { title: 'Business setup guidance', description: 'Organize entity and operational foundations.', href: '/business-setup', access: 'Free', limitation: 'Not legal, tax, or accounting advice.' },
    ], cautions: ['No grant award is guaranteed. Verify every deadline and requirement with the issuing program.'],
  },
  'business-credit': {
    label: 'business-credit readiness', primaryPath: 'Capital', secondaryPaths: ['Opportunity'],
    firstAction: 'Confirm entity, EIN, business banking, address, contact, and reporting consistency before adding accounts.',
    preparation: 'Review existing business credit, utilization, payment systems, cash flow, and the purpose of any new account.',
    review: 'Build a sequenced roadmap that favors on-time payments and useful accounts over unnecessary applications.',
    decision: 'Apply selectively only when the account fits the business need, fees, and repayment capacity.',
    resources: [
      { title: 'Business credit roadmap', description: 'Build a vendor, monitoring, utilization, and application-timing plan.', href: '/tools/business-credit', access: 'Free account', limitation: 'No tradeline, score, approval, or funding result is guaranteed.' },
      { title: 'Free credit review and roadmap', description: 'Upload a report, receive analysis status, and build foundational next steps.', href: '/credit-upload', access: 'Free account', limitation: 'Optional advanced dispute tools may require paid access; results are not guaranteed.', nextStep: 'Create or sign in to a free account, then upload a current report. This is not a credit application and does not create a hard inquiry.' },
    ], cautions: sharedCreditCautions,
  },
  'sell-property': {
    label: 'property sale review', primaryPath: 'Real Estate', secondaryPaths: ['Capital'],
    firstAction: 'Clarify the property, condition, timing, payoff context, occupancy, and preferred outcome.',
    preparation: 'Gather photos, access details, title or lien context, repairs, and any existing listing or representation information.',
    review: 'Compare cash, creative, novation, listing, or partner paths only after the facts are reviewed.',
    decision: 'Choose the route that fits the seller’s real constraints; document the next step before moving forward.',
    resources: [{ title: 'Seller Property Review', description: 'Submit property and seller context for a structured review.', href: '/sell', access: 'Free', limitation: 'No offer, structure, or closing timeline is promised before review.' }], cautions: ['Any offer or transaction structure remains subject to property, title, representation, and participant review.'],
  },
  'buy-property': {
    label: 'property acquisition preparation', primaryPath: 'Real Estate', secondaryPaths: ['Capital'],
    firstAction: 'Define a buy box with market, asset type, budget, condition, return requirements, and exclusions.',
    preparation: 'Document proof-of-funds or financing readiness and the decision rules used to screen opportunities.',
    review: 'Use consistent property analysis before requesting introductions or making offers.',
    decision: 'Advance only opportunities that fit both the buy box and verified underwriting assumptions.',
    resources: [
      { title: 'Buyer criteria', description: 'Store a reusable acquisition profile for better-fit review.', href: '/buyers', access: 'Partner-routed', limitation: 'No deal volume, exclusivity, or match is promised.' },
      { title: 'Property analysis', description: 'Screen property facts and economics consistently.', href: '/property-analyzer', access: 'Free', limitation: 'Not an appraisal or investment recommendation.' },
    ], cautions: ['Verify title, condition, values, rents, financing, and exit assumptions independently.'],
  },
  'fund-deal': {
    label: 'active deal funding', primaryPath: 'Real Estate', secondaryPaths: ['Capital'],
    firstAction: 'State the asset, economics, capital request, use of funds, term, collateral, and exit clearly.',
    preparation: 'Gather the deal package, borrower or sponsor background, title context, estimates, and evidence behind projections.',
    review: 'Separate verified facts from estimates and unresolved questions before sharing the file.',
    decision: 'Route the complete opportunity to an appropriate lender or partner for independent review.',
    resources: [
      { title: 'Real-estate funding intake', description: 'Prepare a deal-specific file for review.', href: '/real-estate-funding', access: 'Review required', limitation: 'Subject to underwriting and third-party terms.' },
      { title: 'Lender criteria', description: 'Share a reusable lending profile.', href: '/lenders', access: 'Partner-routed', limitation: 'No borrower, volume, or closing is promised.' },
    ], cautions: ['VestBlock organizes and routes context; it does not make a lending or investment decision.'],
  },
  'business-acquisition': {
    label: 'business acquisition preparation', primaryPath: 'Real Estate', secondaryPaths: ['Capital', 'Opportunity'],
    firstAction: 'Define acquisition criteria: industry, location, purchase range, owner involvement, cash flow, and deal-breakers.',
    preparation: 'Build a personal financial statement, capital plan, operator thesis, diligence checklist, and transition assumptions.',
    review: 'Separate seller claims from documents that can be verified during diligence.',
    decision: 'Request a VestBlock review to organize the acquisition path and appropriate capital preparation.',
    resources: [
      { title: 'Acquisition-path review', description: 'Your questionnaire creates a review-ready CRM brief for VestBlock follow-up.', href: '/next-move', access: 'Review required', limitation: 'No business, valuation, financing, or closing outcome is promised.' },
      { title: 'Business setup guidance', description: 'Prepare the operational foundation for ownership.', href: '/business-setup', access: 'Free', limitation: 'Not legal, tax, accounting, or diligence advice.' },
    ], cautions: ['Use qualified legal, tax, accounting, and diligence professionals before acquiring a business.'], manualReview: true,
  },
  'builder-developer': {
    label: 'builder and developer routing', primaryPath: 'Real Estate', secondaryPaths: ['Capital'],
    firstAction: 'Define project type, geography, site status, scope, capacity, timeline, and the relationship you need.',
    preparation: 'Gather entity, licensing, insurance, portfolio, project economics, team capacity, and funding context.',
    review: 'Clarify whether the next need is a project, capital, contractor relationship, buyer, site, or operator introduction.',
    decision: 'Route the completed brief for a project-fit review and documented follow-up.',
    resources: [
      { title: 'Builder/developer project-fit review', description: 'Your questionnaire creates a structured project brief and operator task.', href: '/next-move', access: 'Review required', limitation: 'No project, contract, capital, or introduction is guaranteed.' },
      { title: 'Real-estate funding intake', description: 'Prepare an active project capital scenario.', href: '/real-estate-funding', access: 'Review required', limitation: 'Subject to underwriting and third-party terms.' },
    ], cautions: ['Licensing, insurance, contracts, site control, budgets, and funding must be independently verified.'], manualReview: true,
  },
  'improve-credit': {
    label: 'credit improvement preparation', primaryPath: 'Opportunity', secondaryPaths: ['Capital'],
    firstAction: 'Create a free account and upload a current credit report so the roadmap can start from reported information.',
    preparation: 'Review balances, utilization, payment status, inquiries, collections, and any information you believe is inaccurate.',
    review: 'Prioritize factual corrections, on-time payment systems, utilization, and affordable debt steps before new applications.',
    decision: 'Use the free foundational roadmap, then choose optional advanced support only if its scope and price are clear.',
    resources: [
      { title: 'Free credit review and roadmap', description: 'Upload a report, receive analysis status, and build foundational steps.', href: '/credit-upload', access: 'Free account', limitation: 'Optional advanced dispute tools may require paid access; no deletion or score gain is guaranteed.', nextStep: 'Create or sign in to a free account, then upload a current report. This is not a credit application and does not create a hard inquiry.' },
      { title: 'Financial roadmap', description: 'Use your goal and credit context to organize a personal roadmap.', href: '/roadmap', access: 'Free account', limitation: 'Educational guidance; verify all account and product terms.' },
    ], cautions: sharedCreditCautions,
  },
  'increase-income': {
    label: 'income-path preparation', primaryPath: 'Opportunity', secondaryPaths: ['Capital'],
    firstAction: 'Choose one income path that fits your skills, available time, starting budget, and local demand.',
    preparation: 'Define a small test offer, target customer, price, delivery method, and weekly outreach capacity.',
    review: 'Validate demand with direct conversations or a low-cost pilot before buying tools or inventory.',
    decision: 'Keep the path that produces verified demand; stop or revise the path that does not.',
    resources: [
      { title: 'Free personal roadmap', description: 'Organize income, business, and readiness steps around your current position.', href: '/roadmap', access: 'Free account', limitation: 'No income, demand, or profitability is guaranteed.' },
      { title: 'Business setup guidance', description: 'Turn a validated offer into an organized business foundation.', href: '/business-setup', access: 'Free', limitation: 'Not legal, tax, or accounting advice.' },
    ], cautions: ['Test demand before taking on debt, recurring software, large inventory, or advertising spend.'],
  },
  'start-business': {
    label: 'business formation and readiness', primaryPath: 'Opportunity', secondaryPaths: ['Capital'],
    firstAction: 'Define the customer, problem, offer, delivery method, and first proof of demand.',
    preparation: 'Choose an appropriate structure, establish records and banking, and document startup costs and responsibilities.',
    review: 'Validate the offer before adding fixed costs or seeking capital.',
    decision: 'Build the smallest operating version, measure demand, and improve from real customer evidence.',
    resources: [
      { title: 'Business setup guidance', description: 'Organize entity, banking, records, and operational basics.', href: '/business-setup', access: 'Free', limitation: 'Not legal, tax, or accounting advice.' },
      { title: 'Business credit roadmap', description: 'Sequence business-credit foundations after the business is organized.', href: '/tools/business-credit', access: 'Free account', limitation: 'No score, tradeline, approval, or funding guarantee.' },
    ], cautions: ['Validate demand and obtain professional advice where legal, tax, licensing, or accounting decisions apply.'],
  },
  'grow-business': {
    label: 'business growth preparation', primaryPath: 'Opportunity', secondaryPaths: ['Capital', 'Real Estate'],
    firstAction: 'Identify the single constraint limiting growth: demand, conversion, delivery, cash flow, capacity, or retention.',
    preparation: 'Baseline lead volume, conversion, gross margin, fulfillment capacity, and cash needs.',
    review: 'Choose one measurable growth experiment with a clear owner, cost ceiling, and stop condition.',
    decision: 'Scale only what produces repeatable evidence without breaking delivery or cash flow.',
    resources: [
      { title: 'Financial growth services', description: 'Request a scoped review of business readiness or growth needs.', href: '/services/financial-growth', access: 'Paid', limitation: 'No funding, revenue, or growth result is guaranteed.' },
      { title: 'Visibility expansion', description: 'Review search, local, answer-engine, and trust opportunities.', href: '/visibility-expansion', access: 'Paid', limitation: 'No ranking, traffic, citation, or revenue result is guaranteed.' },
    ], cautions: ['Set a cost ceiling and measurement window before paying for acquisition or automation.'],
  },
  visibility: {
    label: 'visibility and lead-capture improvement', primaryPath: 'Opportunity', secondaryPaths: ['Real Estate'],
    firstAction: 'Clarify the audience, service, geography, proof, and conversion action your public presence must support.',
    preparation: 'Audit website clarity, local profiles, response speed, booking, search coverage, and trust evidence.',
    review: 'Prioritize fixes closest to a measurable customer action before expanding content volume.',
    decision: 'Run a scoped visibility or lead-capture sprint and compare qualified actions, not vanity metrics.',
    resources: [
      { title: 'Visibility expansion', description: 'Request a scoped search, local, answer-engine, and trust review.', href: '/visibility-expansion', access: 'Paid', limitation: 'No ranking, traffic, mention, or revenue result is guaranteed.' },
      { title: 'AI receptionist', description: 'Review lead capture, response, and booking support.', href: '/ai-assistant', access: 'Paid', limitation: 'No appointment or revenue result is guaranteed.' },
    ], cautions: ['Measure qualified inquiries and completed actions; rankings and impressions alone do not establish business impact.'],
  },
}

function readinessFor(answers: NextMoveAnswers) {
  if (answers.position === 'active' && (answers.timeline === 'now' || answers.timeline === '30-days')) return 'Ready for review' as const
  if (answers.position === 'starting' || answers.position === 'stalled') return 'Preparation needed' as const
  return 'Start here' as const
}

function capacityNote(answers: NextMoveAnswers) {
  if (answers.weeklyTime === 'under-3') return 'Keep the plan to one primary action each week and avoid parallel applications or launches.'
  if (answers.weeklyTime === '3-7') return 'Reserve one focused work block for preparation and one for review or outreach each week.'
  return 'Use the extra capacity to improve evidence and follow-through, not to multiply unfinished initiatives.'
}

export function shouldCreateNextMoveFollowUp(answers: NextMoveAnswers) {
  const plan = focusPlans[answers.focus]
  return answers.requestFollowUp || Boolean(plan.manualReview) || (answers.position === 'active' && answers.timeline === 'now')
}

export function buildNextMoveRoadmap(answers: NextMoveAnswers): NextMoveRoadmap {
  const plan = focusPlans[answers.focus]
  const steps: NextMoveRoadmapStep[] = [
    { window: 'First 7 days', title: 'Define the decision', actions: [plan.firstAction, `Write down the main obstacle: ${answers.mainObstacle.trim()}.`] },
    { window: 'By day 30', title: 'Prepare the working file', actions: [plan.preparation, capacityNote(answers)] },
    { window: 'By day 60', title: 'Review the evidence', actions: [plan.review, 'Record what is verified, what is estimated, and what still requires a third-party decision.'] },
    { window: 'By day 90', title: 'Choose and document the next move', actions: [plan.decision, 'Keep the selected action, supporting materials, owner, and follow-up date connected.'] },
  ]

  const creditCaution = answers.creditRange !== 'prefer-not-to-say' && answers.creditRange !== 'unknown'
    ? ['Your self-reported credit range is context, not a lending decision or verified credit score.']
    : []

  return {
    title: `Your ${plan.label} starting roadmap`,
    summary: `Your primary path is ${plan.primaryPath}. Start by organizing the decision and the evidence it needs, then use the appropriate VestBlock resource or review path without treating an educational recommendation as an approval or guaranteed outcome.`,
    primaryPath: plan.primaryPath,
    secondaryPaths: plan.secondaryPaths,
    readiness: readinessFor(answers),
    steps,
    resources: plan.resources,
    cautions: [...plan.cautions, ...creditCaution],
    model: 'deterministic',
    generatedAt: new Date().toISOString(),
  }
}

export function mergeAiRefinement(roadmap: NextMoveRoadmap, refinement: { summary: string; priorityNotes: string[]; cautions: string[] }): NextMoveRoadmap {
  const steps = roadmap.steps.map((step, index) => index < refinement.priorityNotes.length
    ? { ...step, actions: [step.actions[0], refinement.priorityNotes[index], ...step.actions.slice(1)] }
    : step)
  return {
    ...roadmap,
    summary: refinement.summary,
    steps,
    cautions: Array.from(new Set([...roadmap.cautions, ...refinement.cautions])).slice(0, 6),
    model: 'ai-refined',
  }
}
