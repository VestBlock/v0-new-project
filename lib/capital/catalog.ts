import type { CapitalCaseType } from '@/lib/capital/types'

export type CapitalPathDefinition = {
  id: CapitalCaseType
  slug: string
  title: string
  shortTitle: string
  who: string
  information: string
  vestblock: string
  provider: string
  readiness: string
  after: string
  boundary: string
  nextStepHref: string
  nextStepLabel: string
  requiredDocuments: string[]
  providerCriteria: string[]
  questions: Array<{
    key: string
    label: string
    type?: 'text' | 'number' | 'textarea' | 'select'
    required?: boolean
    placeholder?: string
    options?: Array<{ value: string; label: string }>
  }>
}

const creditRanges = [
  { value: 'unknown', label: 'Unknown / not reviewed' },
  { value: 'below_580', label: 'Below 580' },
  { value: '580_669', label: '580–669' },
  { value: '670_739', label: '670–739' },
  { value: '740_plus', label: '740+' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

export const capitalPathCatalog: Record<CapitalCaseType, CapitalPathDefinition> = {
  business_funding: {
    id: 'business_funding', slug: 'business-funding', title: 'Business funding', shortTitle: 'Fund a business',
    who: 'Business owners preparing for working capital, equipment, inventory, expansion, or another documentable use of funds.',
    information: 'Business stage, time in operation, revenue, amount, use of funds, timing, credit range, entity and banking readiness.',
    vestblock: 'Organizes the request, identifies preparation gaps, creates a document checklist, and determines whether the file is ready for controlled provider review.',
    provider: 'Each lender or capital provider independently decides eligibility, underwriting, pricing, limits, collateral, documentation, and final terms.',
    readiness: 'Readiness means the stated purpose, business facts, credit context, and records are complete enough for responsible review. It is not approval.',
    after: 'VestBlock saves the case, returns a readiness summary, and places submitted files in an operator review queue before any provider handoff.',
    boundary: 'VestBlock does not promise approval, rates, limits, timing, or funding availability and does not auto-submit applications.',
    nextStepHref: '/dashboard/funding', nextStepLabel: 'Open funding workspace',
    requiredDocuments: ['Government-issued identification', 'Entity formation record and EIN confirmation', 'Recent business bank statements', 'Current profit-and-loss statement', 'Business tax returns when applicable', 'Debt schedule and use-of-funds detail'],
    providerCriteria: ['Business age and industry', 'Monthly or annual revenue', 'Owner credit and recent inquiries', 'Cash flow and existing obligations', 'Requested amount and use of funds', 'Entity, banking, and document consistency'],
    questions: [
      { key: 'businessStage', label: 'Business stage', type: 'select', required: true, options: [{value:'idea',label:'Pre-revenue / planning'},{value:'early',label:'Operating under 12 months'},{value:'established',label:'Operating 12+ months'}] },
      { key: 'timeInBusinessMonths', label: 'Months in business', type: 'number', required: true },
      { key: 'annualRevenue', label: 'Annual business revenue', type: 'number', required: true },
      { key: 'creditRange', label: 'Estimated personal credit range', type: 'select', required: true, options: creditRanges },
      { key: 'entityStatus', label: 'Entity and EIN status', type: 'select', required: true, options: [{value:'complete',label:'Entity and EIN active'},{value:'partial',label:'One is still pending'},{value:'none',label:'Not formed yet'}] },
      { key: 'businessBanking', label: 'Business banking', type: 'select', required: true, options: [{value:'active',label:'Active business account'},{value:'new',label:'Recently opened'},{value:'none',label:'No business account'}] },
    ],
  },
  real_estate_funding: {
    id: 'real_estate_funding', slug: 'real-estate-funding', title: 'Real-estate funding', shortTitle: 'Finance a property',
    who: 'Investors, buyers, owners, builders, and operators with a specific rental, bridge, flip, refinance, or construction scenario.',
    information: 'Property, transaction, purchase and value assumptions, requested funds, liquidity, experience, exit, timing, and borrower context.',
    vestblock: 'Structures the deal facts, flags missing economics or documents, and prepares a consistent file for VestBlock and potential lender review.',
    provider: 'The lender controls program fit, appraisal and title requirements, leverage, reserves, borrower review, pricing, conditions, and closing.',
    readiness: 'A review-ready deal has a defined property and strategy, supportable economics, a credible capital plan, and the core records a lender will request.',
    after: 'The case enters operator review. VestBlock may request missing information or identify an appropriate lender lane; no deal is sent automatically.',
    boundary: 'This is not a commitment to lend, appraisal, approval, rate lock, term sheet, or closing guarantee.',
    nextStepHref: '/real-estate-funding', nextStepLabel: 'Open detailed deal review',
    requiredDocuments: ['Purchase contract or deal summary when available', 'Property photos or scope', 'Current rent roll or lease information when applicable', 'Rehab or construction budget', 'Proof of liquidity or reserves', 'Entity and borrower experience summary'],
    providerCriteria: ['Property and transaction type', 'Loan-to-cost and loan-to-value', 'DSCR or projected cash flow', 'Borrower experience and credit', 'Liquidity and required reserves', 'Market, title, appraisal, and exit strength'],
    questions: [
      { key: 'propertyAddress', label: 'Property address or target market', required: true },
      { key: 'transactionType', label: 'Transaction type', type: 'select', required: true, options: [{value:'dscr',label:'DSCR / rental'},{value:'flip',label:'Fix and flip'},{value:'bridge',label:'Bridge'},{value:'construction',label:'Construction'},{value:'refinance',label:'Refinance'},{value:'other',label:'Other'}] },
      { key: 'purchasePrice', label: 'Purchase price or current basis', type: 'number', required: true },
      { key: 'estimatedValue', label: 'Current or completed value', type: 'number', required: true },
      { key: 'availableLiquidity', label: 'Available liquidity or reserves', type: 'number', required: true },
      { key: 'experienceDeals', label: 'Comparable projects completed', type: 'number', required: true },
      { key: 'exitStrategy', label: 'Repayment or exit strategy', type: 'textarea', required: true },
    ],
  },
  business_acquisition: {
    id: 'business_acquisition', slug: 'business-acquisition', title: 'Business-acquisition capital', shortTitle: 'Acquire a business',
    who: 'Prospective buyers evaluating an identified business or preparing an acquisition search and capital stack.',
    information: 'Target profile, purchase price, buyer cash, operating experience, available financials, seller participation, timeline, and diligence status.',
    vestblock: 'Turns the acquisition thesis and known financial facts into a preparation brief, diligence checklist, and capital-readiness decision.',
    provider: 'SBA lenders, banks, sellers, equity partners, and other providers independently decide valuation acceptance, structure, guarantees, terms, and approval.',
    readiness: 'Readiness means a credible target, supportable cash flow, buyer contribution, relevant experience, and enough source records to begin diligence.',
    after: 'VestBlock saves the case, identifies missing diligence, and routes the next action to roadmap or operator review.',
    boundary: 'VestBlock does not provide a valuation, legal or tax advice, or guarantee financing, acquisition terms, seller acceptance, or closing.',
    nextStepHref: '/next-move?focus=business-acquisition', nextStepLabel: 'Build acquisition roadmap',
    requiredDocuments: ['Target business overview or listing', 'Three years of business financial statements when available', 'Business tax returns when available', 'Buyer resume and ownership profile', 'Personal financial statement or liquidity summary', 'LOI or purchase agreement when available'],
    providerCriteria: ['Historical cash flow and debt-service coverage', 'Purchase price and valuation support', 'Buyer equity contribution', 'Management and industry experience', 'Seller financing or transition support', 'Collateral, guarantees, and diligence quality'],
    questions: [
      { key: 'targetBusiness', label: 'Target business or acquisition criteria', required: true },
      { key: 'purchasePrice', label: 'Expected purchase price', type: 'number', required: true },
      { key: 'buyerContribution', label: 'Cash available for the acquisition', type: 'number', required: true },
      { key: 'targetCashFlow', label: 'Target annual cash flow / EBITDA', type: 'number', required: true },
      { key: 'sellerFinancing', label: 'Seller financing discussed?', type: 'select', required: true, options: [{value:'yes',label:'Yes'},{value:'possible',label:'Possibly'},{value:'no',label:'No / unknown'}] },
      { key: 'operatingExperience', label: 'Relevant operating experience', type: 'textarea', required: true },
    ],
  },
  business_credit: {
    id: 'business_credit', slug: 'business-credit', title: 'Business credit and readiness', shortTitle: 'Build business readiness',
    who: 'Owners who need to strengthen entity, banking, records, personal-credit context, or application sequencing before seeking capital.',
    information: 'Entity and EIN status, business banking, revenue, time in operation, credit range, utilization, current accounts, and near-term objective.',
    vestblock: 'Scores foundational readiness, identifies the next preparation actions, and connects the saved case to the existing business-credit tool.',
    provider: 'Credit bureaus, issuers, banks, vendors, and lenders control reporting, eligibility, approvals, terms, limits, and account availability.',
    readiness: 'Readiness reflects consistency and documentability across entity, banking, revenue, credit, and records—not a tradeline or approval promise.',
    after: 'The case remains in the customer workspace and can continue into the business-credit roadmap or operator review when help is requested.',
    boundary: 'VestBlock does not guarantee score changes, reporting, tradelines, approvals, limits, or funding and does not advise misrepresentation.',
    nextStepHref: '/tools/business-credit', nextStepLabel: 'Open business-credit roadmap',
    requiredDocuments: ['Entity formation record', 'EIN confirmation', 'Business bank account records', 'Business address and contact consistency', 'Recent business financial records', 'Current credit/account inventory'],
    providerCriteria: ['Entity and identity consistency', 'Business age and revenue', 'Banking activity', 'Personal and business credit profile', 'Utilization and recent inquiries', 'Account velocity and truthful applications'],
    questions: [
      { key: 'entityStatus', label: 'Entity and EIN status', type: 'select', required: true, options: [{value:'complete',label:'Complete and active'},{value:'partial',label:'Partially complete'},{value:'none',label:'Not started'}] },
      { key: 'businessBanking', label: 'Business banking status', type: 'select', required: true, options: [{value:'active',label:'Active account'},{value:'new',label:'New account'},{value:'none',label:'No account'}] },
      { key: 'timeInBusinessMonths', label: 'Months in business', type: 'number', required: true },
      { key: 'annualRevenue', label: 'Annual business revenue', type: 'number', required: true },
      { key: 'creditRange', label: 'Estimated personal credit range', type: 'select', required: true, options: creditRanges },
      { key: 'utilization', label: 'Estimated revolving utilization %', type: 'number', required: true },
    ],
  },
  grants_programs: {
    id: 'grants_programs', slug: 'grants-programs', title: 'Verified grants and programs', shortTitle: 'Find programs',
    who: 'Businesses and founders researching public, nonprofit, lender, or economic-development programs that may fit a defined project.',
    information: 'Business status, location, industry, revenue, ownership attributes, project, budget, use of funds, and relevant deadline.',
    vestblock: 'Organizes fit criteria and a verification checklist, then connects the saved profile to VestBlock’s grant-research tool.',
    provider: 'The issuing agency or program controls current availability, eligibility, deadlines, documentation, scoring, selection, and awards.',
    readiness: 'Readiness means the business can document eligibility and complete the requested narrative, budget, registrations, and records before the deadline.',
    after: 'VestBlock returns preparation gaps and sends the user to the existing program finder; every opportunity must still be verified at the source.',
    boundary: 'Listings may change. VestBlock does not guarantee eligibility, completeness, award, deadline, availability, or funding.',
    nextStepHref: '/tools/grants', nextStepLabel: 'Open program finder',
    requiredDocuments: ['Entity and EIN records', 'Business registration and good-standing evidence', 'Project narrative and measurable use of funds', 'Project budget', 'Recent financial statements or tax records', 'Program-specific certifications and registrations'],
    providerCriteria: ['Location and eligible service area', 'Business and industry eligibility', 'Revenue or employee thresholds', 'Founder or community criteria when lawful', 'Allowable use of funds', 'Deadline, registrations, and documentation'],
    questions: [
      { key: 'businessStatus', label: 'Business status', type: 'select', required: true, options: [{value:'planning',label:'Planning / pre-launch'},{value:'operating',label:'Operating'},{value:'nonprofit',label:'Nonprofit'},{value:'other',label:'Other'}] },
      { key: 'state', label: 'State or service area', required: true },
      { key: 'industry', label: 'Industry', required: true },
      { key: 'annualRevenue', label: 'Annual revenue', type: 'number', required: true },
      { key: 'projectBudget', label: 'Project budget', type: 'number', required: true },
      { key: 'programGoal', label: 'Project and intended community or business outcome', type: 'textarea', required: true },
    ],
  },
  capital_provider: {
    id: 'capital_provider', slug: 'capital-provider', title: 'Lender and capital-provider participation', shortTitle: 'Provide capital',
    who: 'Direct lenders, private lenders, banks, CDFIs, brokers, funds, and specialty providers that want controlled, criteria-based opportunity review.',
    information: 'Provider type, geography, borrower and property appetite, loan range, exclusions, documentation, turnaround, relationship model, and verification date.',
    vestblock: 'Creates an owned provider case, writes the verified criteria into the existing lender network, and places the profile in operator review before routing opportunities.',
    provider: 'The provider remains responsible for licensing, compliance, program availability, underwriting, disclosures, pricing, acceptance, and delivery.',
    readiness: 'A provider profile is review-ready when a responsible contact, current program box, exclusions, required documents, coverage, and review process are clear.',
    after: 'VestBlock creates or updates the lender-network profile and an operator task. Criteria remain private and no opportunity volume is promised.',
    boundary: 'VestBlock does not guarantee referrals, deal volume, borrower quality, acceptance, compensation, exclusivity, or closed transactions.',
    nextStepHref: '/lenders', nextStepLabel: 'Review provider network details',
    requiredDocuments: ['Current program or lending matrix', 'Responsible contact and review process', 'Coverage and licensing disclosures as applicable', 'Required borrower/deal document list', 'Indicative terms with verification date', 'Referral or broker requirements when applicable'],
    providerCriteria: ['Capital type and direct/broker/referral role', 'Geographic coverage', 'Borrower, business, and asset appetite', 'Minimum and maximum amount', 'Credit, revenue, leverage, and experience thresholds', 'Required documents, turnaround, terms, and exclusions'],
    questions: [
      { key: 'providerType', label: 'Provider type', type: 'select', required: true, options: [{value:'private_lender',label:'Private lender'},{value:'hard_money',label:'Hard money lender'},{value:'dscr',label:'DSCR lender'},{value:'commercial',label:'Commercial lender'},{value:'business',label:'Business-capital provider'},{value:'cdfi',label:'CDFI / community program'},{value:'broker',label:'Broker / referral source'}] },
      { key: 'statesServed', label: 'States or markets served', required: true },
      { key: 'minimumAmount', label: 'Minimum funding amount', type: 'number', required: true },
      { key: 'maximumAmount', label: 'Maximum funding amount', type: 'number', required: true },
      { key: 'preferredProfiles', label: 'Preferred borrowers, businesses, properties, or transactions', type: 'textarea', required: true },
      { key: 'noGoItems', label: 'Exclusions and no-go criteria', type: 'textarea', required: true },
      { key: 'requiredDocs', label: 'Documents required for initial review', type: 'textarea', required: true },
      { key: 'turnaround', label: 'Typical initial-review turnaround', required: true },
      { key: 'relationshipModel', label: 'Relationship model', type: 'select', required: true, options: [{value:'direct',label:'Direct lender / fund'},{value:'broker',label:'Broker'},{value:'referral',label:'Referral partner'}] },
      { key: 'criteriaVerifiedAt', label: 'Criteria last verified', type: 'text', required: true, placeholder: 'YYYY-MM-DD' },
    ],
  },
}

export const capitalPaths = Object.values(capitalPathCatalog)

export function capitalPathFromSlug(value?: string | null) {
  return capitalPaths.find((path) => path.slug === value) || capitalPathCatalog.business_funding
}
