export type VestBlockServiceIntent =
  | 'manage_deal_records'
  | 'operate_dealflow'
  | 'repair_credit'
  | 'get_business_funding'
  | 'prepare_business'
  | 'find_grants'
  | 'fund_real_estate'
  | 'sell_property'
  | 'automate_followup'
  | 'grow_visibility';

export type VestBlockServiceDirectoryItem = {
  key: string;
  intent: VestBlockServiceIntent;
  title: string;
  shortTitle: string;
  summary: string;
  bestFor: string;
  route: string;
  primaryCta: string;
  secondaryRoute?: string;
  secondaryCta?: string;
  priceNote: string;
  operatorNote: string;
  trustNote: string;
  serviceStage: 'free_check' | 'paid_plan' | 'lead_followup' | 'member_tool';
  priority: number;
};

export const vestBlockServiceDirectory: VestBlockServiceDirectoryItem[] = [
  {
    key: 'dealvault',
    intent: 'manage_deal_records',
    title: 'DealVault',
    shortTitle: 'DealVault',
    summary:
      'Premium real estate deal records, payout tracking, proof certificates, and milestone history for teams that need clearer accountability.',
    bestFor:
      'Real estate operators, private lenders, buyers, disposition teams, referral partners, and teams with partner or milestone risk.',
    route: '/dealvault/demo',
    primaryCta: 'Request DealVault Demo',
    secondaryRoute: '/dealvault',
    secondaryCta: 'View DealVault Overview',
    priceNote: 'Demo-first pricing: $97/mo solo investor, $297/mo team, $997/mo business, custom setup available',
    operatorNote:
      'Captures DealVault demo interest, routes leads into follow-up, and supports proof, payout, and milestone workflows.',
    trustNote:
      'DealVault improves records and accountability; it does not replace legal counsel, escrow, title, brokerage compliance, or custody.',
    serviceStage: 'paid_plan',
    priority: 15,
  },
  {
    key: 'dealflow_growth_system',
    intent: 'operate_dealflow',
    title: 'DealFlow Growth Support',
    shortTitle: 'DealFlow Support',
    summary:
      'High-touch real estate support that combines seller intake, buyer and lender fit review, DealVault records, AI response, and search visibility.',
    bestFor:
      'Real estate operators, wholesalers, disposition teams, private lenders, and partner networks that need a repeatable deal-flow process.',
    route: '/dealflow-growth-system',
    primaryCta: 'View DealFlow Support',
    secondaryRoute: '/get-started',
    secondaryCta: 'Request DealFlow Review',
    priceNote: '$2,500 setup + $997/mo; custom pricing for larger networks or complex rollout',
    operatorNote:
      'Routes serious operators into a premium DealFlow review and supports higher-ticket setup plus recurring service revenue.',
    trustNote:
      'Improves intake, routing, records, response, and visibility; does not guarantee deals, funding, closings, rankings, traffic, or revenue.',
    serviceStage: 'paid_plan',
    priority: 12,
  },
  {
    key: 'credit_analysis',
    intent: 'repair_credit',
    title: 'Credit Review Tools',
    shortTitle: 'Credit Tools',
    summary:
      'Optional credit-report tools for customers who need to understand credit issues before taking next steps.',
    bestFor: 'Customers who specifically need credit-report review or dispute-letter support.',
    route: '/credit-upload',
    primaryCta: 'Upload Credit Report',
    secondaryRoute: '/tools/my-dispute-letters',
    secondaryCta: 'View Dispute Letters',
    priceNote: 'Optional $75 access when credit support is the right fit',
    operatorNote: 'Creates credit-report records, status events, admin alerts, and follow-up visibility.',
    trustNote: 'No score guarantees; analysis is framed around accuracy, documentation, and user review.',
    serviceStage: 'member_tool',
    priority: 95,
  },
  {
    key: 'business_funding',
    intent: 'get_business_funding',
    title: 'Business Funding Eligibility',
    shortTitle: 'Funding Check',
    summary:
      'Check funding eligibility for free, then move qualified owners to partners or into VestBlock prep if they need help becoming eligible.',
    bestFor: 'Business owners who want to know whether they should apply now or clean up first.',
    route: '/funding#free-eligibility-check',
    primaryCta: 'Check Eligibility Free',
    secondaryRoute: '/funding/business-funding-strategy',
    secondaryCta: 'Review $300 Prep Plan',
    priceNote:
      'Free check first, then optional $300 funding prep. A success fee applies only after approved business credit funding is accepted and available.',
    operatorNote: 'Scores eligibility, captures leads, creates funding strategy requests, and queues admin review.',
    trustNote: 'No funding, limit, or approval guarantees; customers review terms before applications.',
    serviceStage: 'free_check',
    priority: 20,
  },
  {
    key: 'credit_card_stacking',
    intent: 'get_business_funding',
    title: 'Business Funding Prep Plan',
    shortTitle: 'Funding Prep Plan',
    summary:
      'Review business credit line eligibility, document requirements, inquiry risk, utilization impact, and the paid prep plan.',
    bestFor: 'Business owners considering multiple business credit cards for working capital.',
    route: '/funding/business-funding-strategy',
    primaryCta: 'Start Funding Prep Plan',
    secondaryRoute: '/funding#free-eligibility-check',
    secondaryCta: 'Check Eligibility First',
    priceNote:
      '$300 funding prep plan. A success fee applies only after approved business credit funding is accepted and available.',
    operatorNote:
      'Creates funding strategy requests, payment records, admin review tasks, and success-fee consent records.',
    trustNote:
      'No approval, limit, or interest-rate guarantees; customers review terms, hard-inquiry risk, and repayment responsibility.',
    serviceStage: 'paid_plan',
    priority: 25,
  },
  {
    key: 'business_setup',
    intent: 'prepare_business',
    title: 'Business Setup for Funding and Grants',
    shortTitle: 'Business Setup',
    summary:
      'Organize business registration, EIN, business banking, documents, business credit basics, and use-of-funds details before applications.',
    bestFor: 'Owners who need business records and grant/funding documents organized.',
    route: '/business-setup',
    primaryCta: 'Prepare My Business',
    secondaryRoute: '/tools/business-credit',
    secondaryCta: 'Build Business Credit',
    priceNote: 'Free preparation guidance with paid funding support available',
    operatorNote: 'Routes users toward business credit, grants, and funding preparation.',
    trustNote: 'Positioned as preparation and documentation, not legal, tax, or guaranteed funding advice.',
    serviceStage: 'free_check',
    priority: 30,
  },
  {
    key: 'financial_growth_services',
    intent: 'prepare_business',
    title: 'Funding & Business Credit Prep Reviews',
    shortTitle: 'Prep Reviews',
    summary:
      'Focused paid reviews for funding readiness, business credit setup, grant prep, debt utilization, cash-flow documents, and real estate deal review.',
    bestFor: 'Business owners who need a clear review before they apply, submit documents, or talk to lenders.',
    route: '/services/financial-growth',
    primaryCta: 'Request Prep Review',
    secondaryRoute: '/services/financial-growth#request-service',
    secondaryCta: 'Compare Prep Reviews',
    priceNote: 'One-time reviews from $149 to $499; no payment collected until scope is confirmed',
    operatorNote: 'Creates service-intent leads with selected package, price, goal, and follow-up metadata.',
    trustNote: 'Educational and preparation support only; no legal, tax, investment, grant, funding, or approval guarantees.',
    serviceStage: 'paid_plan',
    priority: 35,
  },
  {
    key: 'grants',
    intent: 'find_grants',
    title: 'Small Business Grants',
    shortTitle: 'Grants',
    summary:
      'Match a business profile to grant opportunities and draft a stronger application letter for review.',
    bestFor: 'Business owners looking for grant fits, deadlines, and cleaner application language.',
    route: '/tools/grants',
    primaryCta: 'Find Grant Matches',
    secondaryRoute: '/business-setup',
    secondaryCta: 'Check Grant Readiness',
    priceNote: 'Included in member tools where access applies',
    operatorNote: 'Uses grant matching, letter generation, saved outputs, and admin-visible content opportunities.',
    trustNote: 'No grant award promises; users must verify eligibility, deadlines, and program rules.',
    serviceStage: 'member_tool',
    priority: 40,
  },
  {
    key: 'spanish_funding',
    intent: 'get_business_funding',
    title: 'Spanish Business Funding',
    shortTitle: 'Spanish Funding',
    summary:
      'A Spanish-language page for business owners to prepare for funding and review the Bank Breezy Spanish partner option.',
    bestFor: 'Spanish-speaking owners who need a clearer funding preparation process.',
    route: '/es/vestblock',
    primaryCta: 'Ver Opciones En Espanol',
    secondaryRoute: 'https://Bankbreezy.com/es/Vestblock',
    secondaryCta: 'Open Bank Breezy',
    priceNote: 'Partner option plus VestBlock preparation support where appropriate',
    operatorNote: 'Keeps Spanish leads and partner routing distinct for future reporting.',
    trustNote: 'Spanish copy should stay natural and avoid guaranteed approval language.',
    serviceStage: 'lead_followup',
    priority: 50,
  },
  {
    key: 'real_estate_funding',
    intent: 'fund_real_estate',
    title: 'Real Estate Funding and Buyer/Lender Routing',
    shortTitle: 'Buyer/Lender Routing',
    summary:
      'Capture DSCR, rental, fix-and-flip, hard-money, buyer criteria, or lender-fit details so the team can review the opportunity.',
    bestFor: 'Investors, buyers, private lenders, and property owners with a specific real estate deal or funding need.',
    route: '/real-estate-funding',
    primaryCta: 'Submit Funding Deal',
    priceNote: 'Lead review and partner or lender follow-up',
    operatorNote: 'Creates real estate lead records, admin alerts, and follow-up tasks.',
    trustNote: 'No financing promise before deal review, underwriting, and lender terms.',
    serviceStage: 'lead_followup',
    priority: 10,
  },
  {
    key: 'sell_property',
    intent: 'sell_property',
    title: 'Seller Property Review',
    shortTitle: 'Seller Review',
    summary:
      'Collect property details from sellers who want fast cash, creative structure, novation, or partner-fit sale review.',
    bestFor: 'Owners who want to sell a house, rental, land, or investment property and need the best path reviewed before follow-up.',
    route: '/sell',
    primaryCta: 'Request Property Review',
    priceNote: 'No upfront fee collected in the form',
    operatorNote: 'Creates seller leads, stores property context, and queues follow-up.',
    trustNote: 'No cash offer, creative terms, novation path, or closing timeline is promised before review.',
    serviceStage: 'lead_followup',
    priority: 5,
  },
  {
    key: 'ai_assistant',
    intent: 'automate_followup',
    title: 'AI Receptionist, Booking, and Website Systems',
    shortTitle: 'AI Receptionist',
    summary:
      'Set up AI receptionist, booking, and website improvements so real estate and service teams answer faster and capture more serious inquiries.',
    bestFor:
      'Real estate operators, lenders, investor teams, and service businesses that need better lead capture, booking flow, or a cleaner website before they spend more on traffic.',
    route: '/ai-assistant',
    primaryCta: 'Request AI Setup',
    priceNote: '$495 setup + $149/mo for AI receptionist, $895 setup + $249/mo with booking, website sprints from $2,500',
    operatorNote:
      'Creates lead records for AI receptionist, booking, and website-upgrade requests with follow-up and offer visibility.',
    trustNote:
      'Positioned around lead capture, booking support, and conversion improvement without guaranteeing revenue or appointment volume.',
    serviceStage: 'paid_plan',
    priority: 80,
  },
  {
    key: 'visibility_expansion',
    intent: 'grow_visibility',
    title: 'Search Visibility and AI Search Growth',
    shortTitle: 'Search Visibility',
    summary:
      'Improve how buyers, sellers, lenders, and partners find, understand, and trust a business across Google, AI search, local pages, and authority content.',
    bestFor:
      'Real estate operators and local businesses that want more discoverability, stronger AI-answer visibility, and better authority without a vague marketing retainer.',
    route: '/visibility-expansion',
    primaryCta: 'Request Visibility Review',
    secondaryRoute: '/pricing#visibility-expansion',
    secondaryCta: 'Compare Visibility Pricing',
    priceNote: '$299/mo starter, city-page plan from $750 setup + $349/mo, authority PR from $995/mo',
    operatorNote:
      'Creates lead records for search, AI-answer visibility, city pages, and PR requests with deliverables, follow-up, and package tracking.',
    trustNote:
      'Positioned around visibility, content, and authority building without guaranteeing rankings, traffic, media coverage, or revenue.',
    serviceStage: 'paid_plan',
    priority: 85,
  },
];

export const serviceIntentLabels: Record<VestBlockServiceIntent, string> = {
  manage_deal_records: 'Manage records, payouts, or milestones',
  operate_dealflow: 'Operate seller, buyer, lender, and proof workflows',
  repair_credit: 'Repair or understand credit',
  get_business_funding: 'Get business funding',
  prepare_business: 'Prepare for funding or grants',
  find_grants: 'Find grant opportunities',
  fund_real_estate: 'Fund a real estate deal',
  sell_property: 'Sell a property',
  automate_followup: 'Automate lead capture',
  grow_visibility: 'Grow search visibility',
};

export function getServiceDirectoryByIntent(intent: VestBlockServiceIntent) {
  return vestBlockServiceDirectory.filter((service) => service.intent === intent);
}

export function getFeaturedServiceDirectoryItems(limit = 6) {
  return [...vestBlockServiceDirectory]
    .sort((a, b) => a.priority - b.priority)
    .slice(0, limit);
}
