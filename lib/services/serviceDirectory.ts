export type VestBlockServiceIntent =
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
    key: 'credit_analysis',
    intent: 'repair_credit',
    title: 'AI Credit Analysis',
    shortTitle: 'Credit Analysis',
    summary:
      'Upload a credit report, organize the negative items, and generate practical next steps before dispute letters are created.',
    bestFor: 'Consumers who need to understand what is hurting their credit file.',
    route: '/credit-upload',
    primaryCta: 'Upload Credit Report',
    secondaryRoute: '/tools/my-dispute-letters',
    secondaryCta: 'View Dispute Letters',
    priceNote: '$75 VestBlock Pro access when required',
    operatorNote: 'Creates credit-report records, status events, admin alerts, and follow-up visibility.',
    trustNote: 'No score guarantees; analysis is framed around accuracy, documentation, and user review.',
    serviceStage: 'member_tool',
    priority: 10,
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
    secondaryCta: 'Start $300 Funding Plan',
    priceNote: 'Free check, then $300 funding plan plus 10% after accepted business credit funding is available',
    operatorNote: 'Scores eligibility, captures leads, creates funding strategy requests, and queues admin review.',
    trustNote: 'No funding, limit, or approval guarantees; customers review terms before applications.',
    serviceStage: 'free_check',
    priority: 20,
  },
  {
    key: 'credit_card_stacking',
    intent: 'get_business_funding',
    title: 'Business Funding Strategy',
    shortTitle: 'Funding Strategy',
    summary:
      'Review business credit line eligibility, document requirements, inquiry risk, utilization impact, and the paid strategy plan.',
    bestFor: 'Business owners considering multiple business credit cards for working capital.',
    route: '/funding/business-funding-strategy',
    primaryCta: 'Start Funding Strategy',
    secondaryRoute: '/funding#free-eligibility-check',
    secondaryCta: 'Check Eligibility First',
    priceNote: '$300 funding prep plan plus 10% after accepted business credit funding is available',
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
    title: 'Business Setup For Funding And Grants',
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
    title: 'Financial Growth Services',
    shortTitle: 'Financial Services',
    summary:
      'Paid prep packages for funding, business credit, grant applications, debt utilization, cash-flow documents, and real estate deal review.',
    bestFor: 'Clients who need more than a free checker and want a paid review or preparation package.',
    route: '/services/financial-growth',
    primaryCta: 'View Financial Packages',
    secondaryRoute: '/services/financial-growth#request-service',
    secondaryCta: 'Request A Service',
    priceNote: 'One-time packages from $149 to $499, plus funding success-fee paths where applicable',
    operatorNote: 'Creates service-intent leads with selected package, price, goal, and admin follow-up metadata.',
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
    title: 'Real Estate Funding',
    shortTitle: 'Real Estate Funding',
    summary:
      'Capture DSCR, rental, fix-and-flip, hard-money, or deal funding details so the team can review the opportunity.',
    bestFor: 'Investors and property owners with a specific real estate deal or lending need.',
    route: '/real-estate-funding',
    primaryCta: 'Submit Funding Deal',
    priceNote: 'Lead review and partner or lender follow-up',
    operatorNote: 'Creates real estate lead records, admin alerts, and follow-up tasks.',
    trustNote: 'No financing promise before deal review, underwriting, and lender terms.',
    serviceStage: 'lead_followup',
    priority: 60,
  },
  {
    key: 'sell_property',
    intent: 'sell_property',
    title: 'Sell Property',
    shortTitle: 'Sell Property',
    summary:
      'Collect property details from sellers who want an investor conversation, cash-offer review, or faster sale conversation.',
    bestFor: 'Owners who want to sell a house or investment property and need follow-up.',
    route: '/sell',
    primaryCta: 'Request Property Review',
    priceNote: 'No upfront fee collected in the form',
    operatorNote: 'Creates seller leads, stores property context, and queues admin follow-up.',
    trustNote: 'No specific offer is promised until the property is reviewed.',
    serviceStage: 'lead_followup',
    priority: 70,
  },
  {
    key: 'ai_assistant',
    intent: 'automate_followup',
    title: 'AI Receptionist And Website Services',
    shortTitle: 'AI Receptionist',
    summary:
      'Install AI receptionist, appointment-booking, and website-upgrade services that help service businesses capture more leads and convert more traffic.',
    bestFor:
      'Service businesses that need better lead capture, booking flow, or a cleaner website before they spend more on traffic.',
    route: '/ai-assistant',
    primaryCta: 'View AI Receptionist Offers',
    priceNote: '$495 setup + $149/mo for AI receptionist, $895 setup + $249/mo with booking, website sprints from $2,500',
    operatorNote:
      'Creates lead records for AI receptionist, booking, and website-upgrade requests with admin follow-up and offer visibility.',
    trustNote:
      'Positioned around lead capture, booking support, and conversion improvement without guaranteeing revenue or appointment volume.',
    serviceStage: 'paid_plan',
    priority: 80,
  },
  {
    key: 'visibility_expansion',
    intent: 'grow_visibility',
    title: 'Search Visibility Service',
    shortTitle: 'Search Visibility',
    summary:
      'Package search, AI-answer visibility, city pages, and PR authority work into a clearer monthly service for growing businesses.',
    bestFor:
      'Businesses that want more discoverability, stronger AI-answer visibility, and better authority without a vague marketing retainer.',
    route: '/visibility-expansion',
    primaryCta: 'View Search Visibility',
    secondaryRoute: '/pricing#visibility-expansion',
    secondaryCta: 'Compare Visibility Pricing',
    priceNote: '$299/mo starter, city-page plan from $750 setup + $349/mo, authority PR from $995/mo',
    operatorNote:
      'Creates lead records for search, AI-answer visibility, city pages, and PR requests with deliverables, admin follow-up, and package tracking.',
    trustNote:
      'Positioned around visibility, content, and authority building without guaranteeing rankings, traffic, media coverage, or revenue.',
    serviceStage: 'paid_plan',
    priority: 85,
  },
];

export const serviceIntentLabels: Record<VestBlockServiceIntent, string> = {
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
