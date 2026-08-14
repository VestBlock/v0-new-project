export const PARTICIPANT_ROLES = [
  'buyer',
  'investor',
  'lender',
  'builder',
  'developer',
  'real_estate_agent',
  'wholesaler',
  'business_buyer',
  'business_seller',
  'service_provider',
] as const

export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number]

export const PARTICIPANT_STATUSES = [
  'draft',
  'pending_review',
  'active',
  'paused',
  'needs_information',
  'declined',
  'withdrawn',
  'archived',
] as const

export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number]

export type ParticipantField = {
  key: string
  label: string
  help: string
  type: 'text' | 'textarea' | 'number' | 'list' | 'select' | 'date'
  options?: string[]
  required?: boolean
  publicEligible?: boolean
}

export type ParticipantRoleDefinition = {
  label: string
  shortLabel: string
  description: string
  use: string
  boundary: string
  fields: ParticipantField[]
}

const commonMarketFields: ParticipantField[] = [
  { key: 'markets', label: 'Markets', help: 'Cities, counties, metros, or states.', type: 'list', required: true, publicEligible: true },
  { key: 'geographicRadius', label: 'Geographic radius', help: 'How far beyond the listed markets you can operate.', type: 'text', publicEligible: true },
]

const buyerFields: ParticipantField[] = [
  ...commonMarketFields,
  { key: 'assetTypes', label: 'Property and asset types', help: 'Examples: single-family, multifamily, land, mixed-use, commercial.', type: 'list', required: true, publicEligible: true },
  { key: 'priceMin', label: 'Minimum purchase price', help: 'Your lower purchase range, when applicable.', type: 'number', publicEligible: true },
  { key: 'priceMax', label: 'Maximum purchase price', help: 'Your upper purchase range, when applicable.', type: 'number', required: true, publicEligible: true },
  { key: 'propertyCondition', label: 'Property condition', help: 'Turnkey, light value-add, substantial renovation, land, or other.', type: 'list', publicEligible: true },
  { key: 'occupancyPreferences', label: 'Occupancy preferences', help: 'Vacant, owner-occupied, tenant-occupied, or flexible.', type: 'list', publicEligible: true },
  { key: 'investmentStrategy', label: 'Investment strategy', help: 'Hold, renovate and sell, development, wholesale, owner-user, or other.', type: 'list', required: true, publicEligible: true },
  { key: 'returnThreshold', label: 'Minimum return or margin threshold', help: 'State your own yield, margin, cap-rate, or return threshold and how you calculate it.', type: 'text' },
  { key: 'purchaseCapacity', label: 'Purchasing capacity', help: 'Cash, financing, or a mix. This is self-reported until reviewed.', type: 'select', options: ['Cash', 'Financing', 'Mixed', 'Still arranging capital'], publicEligible: true },
  { key: 'proofOfFundsStatus', label: 'Proof-of-funds status', help: 'Self-reported status. VestBlock verification appears only after a separate evidence review.', type: 'select', options: ['Not provided', 'Available on request', 'Submitted for review'], publicEligible: true },
  { key: 'closingTiming', label: 'Preferred closing timing', help: 'Your usual timing after an accepted agreement and completed diligence.', type: 'text', publicEligible: true },
  { key: 'dealSizeCapacity', label: 'Deal-size capacity', help: 'Typical amount of capital or total acquisition size per transaction.', type: 'text', publicEligible: true },
  { key: 'volumeCapacity', label: 'Volume capacity', help: 'Approximate number of transactions you can responsibly review or close.', type: 'text', publicEligible: true },
  { key: 'exclusions', label: 'Exclusions and no-go criteria', help: 'Conditions, locations, structures, or circumstances you will not consider.', type: 'textarea', required: true },
  { key: 'notes', label: 'Additional context', help: 'Optional information that helps an operator understand the criteria.', type: 'textarea' },
]

const lenderFields: ParticipantField[] = [
  { key: 'providerName', label: 'Provider name', help: 'The legal or operating name used for this profile.', type: 'text', required: true, publicEligible: true },
  { key: 'providerType', label: 'Provider type', help: 'How the organization participates in a financing request.', type: 'select', options: ['Direct lender', 'Broker', 'Correspondent', 'Referral source', 'Private capital provider', 'Other'], required: true, publicEligible: true },
  { key: 'lendingProducts', label: 'Lending products', help: 'Construction, bridge, DSCR, rental, commercial, business, acquisition, or other products.', type: 'list', required: true, publicEligible: true },
  { key: 'states', label: 'States and geographic coverage', help: 'States, metros, or other coverage limits.', type: 'list', required: true, publicEligible: true },
  { key: 'propertyTypes', label: 'Property types', help: 'Property or collateral types considered.', type: 'list', publicEligible: true },
  { key: 'borrowerTypes', label: 'Borrower types', help: 'Investor, owner-user, small business, sponsor, first-time investor, or other.', type: 'list', publicEligible: true },
  { key: 'loanAmountMin', label: 'Minimum loan amount', help: 'Provider-supplied and subject to underwriting and verification.', type: 'number', publicEligible: true },
  { key: 'loanAmountMax', label: 'Maximum loan amount', help: 'Provider-supplied and subject to underwriting and verification.', type: 'number', required: true, publicEligible: true },
  { key: 'leverageLimits', label: 'Leverage limits', help: 'Provider-supplied LTV, LTC, or other leverage context.', type: 'text', publicEligible: true },
  { key: 'indicativeRates', label: 'Indicative rates or ranges', help: 'Optional provider-supplied context; never an offer, quote, or commitment.', type: 'text', publicEligible: true },
  { key: 'termsAndFees', label: 'Terms and fees', help: 'Provider-supplied context subject to underwriting, verification, and change.', type: 'textarea' },
  { key: 'minimumCredit', label: 'Minimum credit requirements', help: 'State the provider-supplied standard and any important exceptions.', type: 'text' },
  { key: 'experienceRequirements', label: 'Experience requirements', help: 'Minimum borrower or sponsor experience, if any.', type: 'textarea' },
  { key: 'documentationRequirements', label: 'Documentation requirements', help: 'Typical records needed for an initial review.', type: 'textarea', required: true },
  { key: 'turnaroundExpectations', label: 'Turnaround expectations', help: 'Indicative only and subject to a complete file, underwriting, and provider capacity.', type: 'text', publicEligible: true },
  { key: 'recourse', label: 'Recourse context', help: 'Recourse, nonrecourse, or product-dependent.', type: 'select', options: ['Recourse', 'Nonrecourse', 'Product-dependent', 'Not specified'], publicEligible: true },
  { key: 'exclusions', label: 'Exclusions', help: 'Borrower, property, use-of-funds, geography, or structure exclusions.', type: 'textarea', required: true },
]

export const PARTICIPANT_ROLE_DEFINITIONS: Record<ParticipantRole, ParticipantRoleDefinition> = {
  buyer: {
    label: 'Real estate buyer',
    shortLabel: 'Buyer',
    description: 'Define the markets, assets, economics, capacity, and exclusions behind your acquisition criteria.',
    use: 'VestBlock stores this profile so you can manage your criteria and submit them for human review.',
    boundary: 'Creating this profile does not start property sourcing, matching, owner outreach, inventory access, exclusivity, or closing.',
    fields: buyerFields,
  },
  investor: {
    label: 'Real estate investor',
    shortLabel: 'Investor',
    description: 'Organize an acquisition or portfolio thesis with the financial thresholds that matter to you.',
    use: 'VestBlock uses the approved structure to help operators understand your investment criteria.',
    boundary: 'No property, return, introduction, allocation, or transaction is guaranteed.',
    fields: buyerFields,
  },
  lender: {
    label: 'Lender or capital provider',
    shortLabel: 'Capital provider',
    description: 'Record provider-supplied coverage, products, underwriting context, capacity, and exclusions.',
    use: 'VestBlock stores this information for controlled team review and future preparation.',
    boundary: 'Rates, leverage, timing, fees, products, and terms are provider-supplied, subject to verification and underwriting, and are not an approval or commitment.',
    fields: lenderFields,
  },
  builder: {
    label: 'Builder',
    shortLabel: 'Builder',
    description: 'Describe where and what you build, current capacity, project stage, and the support you need.',
    use: 'VestBlock uses the profile to organize operating context for team review.',
    boundary: 'Licenses, insurance, capacity, and credentials remain unverified unless an operator records evidence. No project, contract, referral, or revenue is guaranteed.',
    fields: [
      ...commonMarketFields,
      { key: 'constructionTypes', label: 'Construction types', help: 'Ground-up, renovation, tenant improvement, civil, modular, or other.', type: 'list', required: true, publicEligible: true },
      { key: 'projectTypes', label: 'Project types', help: 'Residential, commercial, mixed-use, industrial, land development, or other.', type: 'list', required: true, publicEligible: true },
      { key: 'typicalSize', label: 'Typical project size', help: 'Units, square footage, or budget range.', type: 'text', publicEligible: true },
      { key: 'currentCapacity', label: 'Current capacity', help: 'Active workload and responsible near-term capacity.', type: 'textarea', required: true, publicEligible: true },
      { key: 'projectStage', label: 'Project stage', help: 'Planning, estimating, permitting, active construction, or closeout.', type: 'list', publicEligible: true },
      { key: 'needs', label: 'Current needs', help: 'Site, capital, buyer, subcontractor, supplier, or operating-partner needs.', type: 'list' },
      { key: 'licenseDetails', label: 'License details', help: 'Voluntary license state, type, and number. Operator verification is separate.', type: 'textarea' },
      { key: 'insuranceStatus', label: 'Insurance status', help: 'Self-reported insurance context. Do not include policy documents here.', type: 'text' },
    ],
  },
  developer: {
    label: 'Developer',
    shortLabel: 'Developer',
    description: 'Organize market, asset, site, stage, deal size, capital, and operating criteria.',
    use: 'VestBlock uses this profile to prepare a consistent team review.',
    boundary: 'No site, entitlement, approval, capital, partner, buyer, contractor, or development outcome is guaranteed.',
    fields: [
      ...commonMarketFields,
      { key: 'assetClasses', label: 'Asset classes', help: 'Residential, multifamily, retail, industrial, hospitality, mixed-use, land, or other.', type: 'list', required: true, publicEligible: true },
      { key: 'siteCriteria', label: 'Site criteria', help: 'Location, acreage, zoning, utilities, access, density, or other requirements.', type: 'textarea', required: true, publicEligible: true },
      { key: 'projectStage', label: 'Project stage', help: 'Thesis, site search, contract, entitlement, capitalization, construction, or stabilization.', type: 'select', options: ['Thesis', 'Site search', 'Under contract', 'Entitlement', 'Capitalization', 'Construction', 'Stabilization'], publicEligible: true },
      { key: 'dealSizeRange', label: 'Deal-size range', help: 'Typical total project or acquisition range.', type: 'text', publicEligible: true },
      { key: 'capitalNeeds', label: 'Capital needs', help: 'Equity, debt, predevelopment, construction, bridge, or other capital context.', type: 'textarea' },
      { key: 'operatingNeeds', label: 'Operating needs', help: 'Entitlement, design, construction, leasing, management, or other needs.', type: 'textarea' },
      { key: 'partnerPreferences', label: 'Partner preferences', help: 'Buyer, lender, builder, contractor, consultant, or operating-partner criteria.', type: 'textarea' },
    ],
  },
  real_estate_agent: {
    label: 'Real estate agent',
    shortLabel: 'Agent',
    description: 'Describe market coverage, client focus, transaction coverage, and referral preferences.',
    use: 'VestBlock stores voluntary professional criteria for team review.',
    boundary: 'License status is unverified unless an operator records evidence. No client, listing, referral, fee, or transaction is guaranteed.',
    fields: [
      ...commonMarketFields,
      { key: 'clientFocus', label: 'Client focus', help: 'Residential, commercial, investor, land, luxury, first-time buyer, or other.', type: 'list', required: true, publicEligible: true },
      { key: 'coverage', label: 'Transaction coverage', help: 'Buyer, seller, investor, listing, leasing, or referral coverage.', type: 'list', required: true, publicEligible: true },
      { key: 'referralPreferences', label: 'Referral preferences', help: 'Preferred property, client, geography, and handoff context.', type: 'textarea' },
      { key: 'licenseState', label: 'License state', help: 'State or jurisdiction where you voluntarily report an active license.', type: 'list', publicEligible: true },
      { key: 'licenseDetails', label: 'Voluntary license details', help: 'License number and public verification context. Operator verification is separate.', type: 'textarea' },
    ],
  },
  wholesaler: {
    label: 'Real estate wholesaler',
    shortLabel: 'Wholesaler',
    description: 'Define acquisition and disposition coverage, transaction preferences, capacity, and exclusions.',
    use: 'VestBlock uses this profile for team review and account organization.',
    boundary: 'No property, buyer, assignment, fee, disposition, or closing is guaranteed.',
    fields: [
      { key: 'acquisitionMarkets', label: 'Acquisition markets', help: 'Where you source or contract opportunities.', type: 'list', required: true, publicEligible: true },
      { key: 'dispositionMarkets', label: 'Disposition markets', help: 'Where you maintain responsible buyer coverage.', type: 'list', required: true, publicEligible: true },
      { key: 'propertyTypes', label: 'Property types', help: 'Residential, land, multifamily, commercial, or other.', type: 'list', required: true, publicEligible: true },
      { key: 'priceRange', label: 'Price range', help: 'Typical contract or transaction range.', type: 'text', publicEligible: true },
      { key: 'transactionPreferences', label: 'Transaction preferences', help: 'Assignment, double close, novation, referral, or other structures, subject to applicable law.', type: 'list' },
      { key: 'buyerCoverage', label: 'Buyer coverage', help: 'Describe verified internal coverage without exposing private buyer contacts.', type: 'textarea' },
      { key: 'capacity', label: 'Current capacity', help: 'Responsible monthly review and transaction capacity.', type: 'text', publicEligible: true },
      { key: 'exclusions', label: 'Exclusions', help: 'Markets, property conditions, structures, or circumstances you will not consider.', type: 'textarea', required: true },
    ],
  },
  business_buyer: {
    label: 'Business buyer',
    shortLabel: 'Business buyer',
    description: 'Define industry, geography, size, economics, structure, experience, timeline, and exclusions.',
    use: 'VestBlock stores voluntary acquisition criteria for controlled team review.',
    boundary: 'No business, valuation, financing, seller, introduction, or closing is guaranteed.',
    fields: [
      { key: 'industries', label: 'Industries', help: 'Target industries and any adjacent categories.', type: 'list', required: true, publicEligible: true },
      { key: 'geography', label: 'Geography', help: 'Target states, regions, remote operations, or relocation limits.', type: 'list', required: true, publicEligible: true },
      { key: 'businessSize', label: 'Business size', help: 'Employees, locations, customers, or other operating scale.', type: 'text', publicEligible: true },
      { key: 'financialRange', label: 'Revenue, SDE, EBITDA, or deal-size range', help: 'Voluntary financial range; state which measure you use.', type: 'textarea' },
      { key: 'objective', label: 'Acquisition objective', help: 'Platform, add-on, owner-operator, strategic, passive, or other objective.', type: 'textarea', required: true, publicEligible: true },
      { key: 'preferredStructure', label: 'Preferred structure', help: 'Asset purchase, equity purchase, seller financing, earnout, or other preferences.', type: 'textarea' },
      { key: 'experience', label: 'Relevant experience', help: 'Operating, industry, acquisition, or integration experience.', type: 'textarea' },
      { key: 'timeline', label: 'Timeline', help: 'When you are prepared to begin diligence or transact.', type: 'text', publicEligible: true },
      { key: 'confidentiality', label: 'Confidentiality preference', help: 'State what may be shared and at what review stage.', type: 'textarea' },
      { key: 'exclusions', label: 'Exclusions', help: 'Industries, geographies, economics, structures, or risks you will not consider.', type: 'textarea', required: true },
    ],
  },
  business_seller: {
    label: 'Business seller',
    shortLabel: 'Business seller',
    description: 'Privately organize the business, economics, sale objective, structure, timing, and confidentiality requirements.',
    use: 'VestBlock stores this private profile for controlled team review.',
    boundary: 'Financial figures are owner-supplied and unverified unless stated. No valuation, buyer, offer, financing, confidentiality outcome, or closing is guaranteed.',
    fields: [
      { key: 'industries', label: 'Industry', help: 'Primary industry and operating category.', type: 'list', required: true, publicEligible: true },
      { key: 'geography', label: 'Geography', help: 'Operating locations and transferable service area.', type: 'list', required: true, publicEligible: true },
      { key: 'businessSize', label: 'Business size', help: 'Employees, locations, customers, or other operating scale.', type: 'text' },
      { key: 'financialRange', label: 'Revenue, SDE, EBITDA, or deal-size range', help: 'Voluntary owner-supplied range; state the measure and period.', type: 'textarea' },
      { key: 'objective', label: 'Sale objective', help: 'Full sale, partial sale, recapitalization, succession, partner buyout, or other objective.', type: 'textarea', required: true },
      { key: 'preferredStructure', label: 'Preferred structure', help: 'Asset sale, equity sale, seller financing, transition support, or other preferences.', type: 'textarea' },
      { key: 'experience', label: 'Owner and management context', help: 'Relevant tenure, management depth, and transition availability.', type: 'textarea' },
      { key: 'timeline', label: 'Timeline', help: 'Desired preparation, market, diligence, and closing window.', type: 'text' },
      { key: 'confidentiality', label: 'Confidentiality preference', help: 'What may be shared before an approved confidential review.', type: 'textarea', required: true },
      { key: 'exclusions', label: 'Exclusions', help: 'Buyer, structure, timing, or disclosure conditions you will not accept.', type: 'textarea' },
    ],
  },
  service_provider: {
    label: 'Service provider',
    shortLabel: 'Service provider',
    description: 'Describe services, markets, responsible capacity, availability, credentials, and partner preferences.',
    use: 'VestBlock stores the profile for team review and future account organization.',
    boundary: 'Credentials, insurance, licenses, pricing, and availability remain provider-supplied until verified. No customer, contract, referral, project, or revenue is guaranteed.',
    fields: [
      { key: 'serviceCategories', label: 'Service categories', help: 'Services you currently provide.', type: 'list', required: true, publicEligible: true },
      ...commonMarketFields,
      { key: 'capacity', label: 'Capacity', help: 'Responsible project, client, or monthly capacity.', type: 'textarea', required: true, publicEligible: true },
      { key: 'availability', label: 'Availability', help: 'Current start window and scheduling constraints.', type: 'text', publicEligible: true },
      { key: 'credentials', label: 'Credentials', help: 'Voluntary certifications, experience, and public verification context.', type: 'textarea' },
      { key: 'insuranceOrLicense', label: 'Insurance or license status', help: 'Self-reported until an operator records verification evidence.', type: 'textarea' },
      { key: 'pricingContext', label: 'Pricing context', help: 'Optional provider-supplied context, not a quote or commitment.', type: 'textarea' },
      { key: 'partnerPreferences', label: 'Partner preferences', help: 'Project, customer, collaboration, and handoff preferences.', type: 'textarea' },
    ],
  },
}

export const PARTICIPANT_STATUS_LABELS: Record<ParticipantStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending review',
  active: 'Active',
  paused: 'Paused',
  needs_information: 'Needs information',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
  archived: 'Archived',
}

export function rolePublicKeys(role: ParticipantRole) {
  return PARTICIPANT_ROLE_DEFINITIONS[role].fields
    .filter((field) => field.publicEligible)
    .map((field) => field.key)
}

export function roleFieldKeys(role: ParticipantRole) {
  return PARTICIPANT_ROLE_DEFINITIONS[role].fields.map((field) => field.key)
}

export function roleRequiredKeys(role: ParticipantRole) {
  return PARTICIPANT_ROLE_DEFINITIONS[role].fields.filter((field) => field.required).map((field) => field.key)
}
