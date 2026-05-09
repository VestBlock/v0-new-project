import { automationPackages } from '@/lib/services/automationPackages';
import { visibilityExpansionPackages } from '@/lib/services/visibilityExpansionPackages';

export type PricedOfferCategory =
  | 'core_product'
  | 'funding_assistant'
  | 'financial_growth'
  | 'growth_automation'
  | 'visibility_expansion';

export type PricedOffer = {
  key: string;
  category: PricedOfferCategory;
  serviceKey: string;
  slug: string;
  title: string;
  priceLabel: string;
  amount?: number | null;
  summary: string;
  bestFor: string;
  deliverables: string[];
  complianceNote: string;
  primaryRoute: string;
  primaryCta: string;
  secondaryRoute?: string;
  secondaryCta?: string;
  parentServiceRoute: string;
  parentServiceLabel: string;
};

export const pricedVestBlockOffers: PricedOffer[] = [
  {
    key: 'vestblock_pro_access',
    category: 'core_product',
    serviceKey: 'credit_analysis',
    slug: 'vestblock-pro-credit-tools',
    title: 'VestBlock Pro Credit Tools Access',
    priceLabel: '$75',
    amount: 75,
    summary:
      'Get paid access to credit-report analysis, organized findings, and dispute-letter tools inside VestBlock.',
    bestFor:
      'Users who are ready to upload a report and want guided credit-analysis tools unlocked.',
    deliverables: [
      'Credit report upload access',
      'AI credit-analysis tools',
      'Dispute-letter generation tools',
      'Dashboard tracking for report progress',
    ],
    complianceNote:
      'This is access to tools and review support, not a guarantee of score increases or deletions.',
    primaryRoute: '/credit-upload',
    primaryCta: 'Open Credit Tools',
    secondaryRoute: '/services/ai-credit-analysis',
    secondaryCta: 'Read The Credit Analysis Guide',
    parentServiceRoute: '/services/ai-credit-analysis',
    parentServiceLabel: 'AI Credit Analysis',
  },
  {
    key: 'funding_strategy_review',
    category: 'core_product',
    serviceKey: 'credit_card_stacking',
    slug: 'business-funding-readiness-plan',
    title: 'Business Funding Prep Plan',
    priceLabel: '$300',
    amount: 300,
    summary:
      'A guided funding review for document cleanup, application timing, risk, and next-step preparation.',
    bestFor:
      'Business owners who need more than a free check before they pursue business funding.',
    deliverables: [
      'Funding preparation review and risk notes',
      'Document and profile cleanup guidance',
      'Funding sequence planning support',
      'Follow-up plan for approved next steps',
    ],
    complianceNote:
      'VestBlock helps organize preparation and strategy. Approval decisions and terms still come from issuers or lenders.',
    primaryRoute: '/funding/business-funding-strategy',
    primaryCta: 'Start The Funding Prep Plan',
    secondaryRoute: '/services/business-funding-strategy',
    secondaryCta: 'Read The Funding Strategy Guide',
    parentServiceRoute: '/services/business-funding-strategy',
    parentServiceLabel: 'Business Funding Strategy',
  },
  {
    key: 'software_access',
    category: 'funding_assistant',
    serviceKey: 'business_funding',
    slug: 'funding-assistant-software-access',
    title: 'Funding Assistant Software Access',
    priceLabel: '$39',
    amount: 39,
    summary:
      'Use the Funding Assistant dashboard for progress tracking, reminders, and application organization without guided review.',
    bestFor:
      'Users who want lighter funding tools they can manage themselves.',
    deliverables: [
      'Funding dashboard access',
      'Progress tracking and reminders',
      'Saved funding profile',
      'Estimated sequence organization',
    ],
    complianceNote:
      'This offer organizes the process. It does not submit applications or promise approvals, limits, APRs, or funding results.',
    primaryRoute: '/funding#free-eligibility-check',
    primaryCta: 'Start With Free Funding Check',
    secondaryRoute: '/services/business-funding-eligibility',
    secondaryCta: 'Review Funding Prep',
    parentServiceRoute: '/services/business-funding-eligibility',
    parentServiceLabel: 'Business Funding Eligibility',
  },
  {
    key: 'strategy_report',
    category: 'funding_assistant',
    serviceKey: 'business_funding',
    slug: 'funding-strategy-report',
    title: 'Funding Strategy Report',
    priceLabel: '$99',
    amount: 99,
    summary:
      'A one-time funding plan with scoring, recommended next steps, timing notes, and a follow-up checklist.',
    bestFor:
      'Users who want a clearer action plan before choosing higher-touch support.',
    deliverables: [
      'Detailed funding summary',
      'Recommended application steps',
      'Warnings and timing notes',
      'Follow-up checklist',
    ],
    complianceNote:
      'This report gives strategy guidance only. It does not guarantee approvals, credit limits, issuer terms, or funding availability.',
    primaryRoute: '/funding#free-eligibility-check',
    primaryCta: 'Start With Free Funding Check',
    secondaryRoute: '/pricing',
    secondaryCta: 'Compare Pricing',
    parentServiceRoute: '/services/business-funding-eligibility',
    parentServiceLabel: 'Business Funding Eligibility',
  },
  {
    key: 'assisted_funding_package',
    category: 'funding_assistant',
    serviceKey: 'credit_card_stacking',
    slug: 'assisted-funding-package',
    title: 'Assisted Funding Package',
    priceLabel: '$300',
    amount: 300,
    summary:
      'Guided support for cleanup, application timing, and a more hands-on funding preparation process.',
    bestFor:
      'Users whose file needs more review before they move into applications.',
    deliverables: [
      'Guided review included',
      'Preparation cleanup guidance',
      'Sequence support',
      'Follow-up task handling',
    ],
    complianceNote:
      'This is a preparation and support package. Issuers and lenders still decide approvals, terms, and final funding outcomes.',
    primaryRoute: '/funding/business-funding-strategy',
    primaryCta: 'Request Assisted Review',
    secondaryRoute: '/dashboard/funding',
    secondaryCta: 'Open Funding Assistant',
    parentServiceRoute: '/services/business-funding-strategy',
    parentServiceLabel: 'Business Funding Strategy',
  },
  {
    key: 'custom_plan',
    category: 'funding_assistant',
    serviceKey: 'real_estate_funding',
    slug: 'custom-funding-plan',
    title: 'Custom Funding Plan',
    priceLabel: 'Custom',
    amount: null,
    summary:
      'A custom review for hybrid funding cases, unusual credit constraints, or real-estate-heavy capital planning.',
    bestFor:
      'Users who need a more tailored funding plan than a standard dashboard can offer.',
    deliverables: [
      'Personal review included',
      'Custom sequencing review',
      'Edge-case business structure support',
    ],
    complianceNote:
      'Custom plans are reviewed case by case and do not imply approval, funding amount, or lender acceptance.',
    primaryRoute: '/funding/business-funding-strategy',
    primaryCta: 'Request A Custom Review',
    secondaryRoute: '/real-estate-funding',
    secondaryCta: 'Submit A Real Estate Deal',
    parentServiceRoute: '/services/real-estate-funding',
    parentServiceLabel: 'Real Estate Funding',
  },
  {
    key: 'funding_readiness_snapshot',
    category: 'financial_growth',
    serviceKey: 'financial_growth_services',
    slug: 'funding-readiness-snapshot',
    title: 'Funding Prep Snapshot',
    priceLabel: '$149',
    amount: 149,
    summary:
      'A focused review of the owner profile, business setup, credit factors, and documents before applying for funding.',
    bestFor:
      'Owners who want to know what to fix before they submit funding applications.',
    deliverables: [
      'Funding score and risk notes',
      'Document checklist',
      'Next best funding option recommendation',
      'VestBlock review follow-up',
    ],
    complianceNote:
      'Does not guarantee approval, terms, limits, or funding availability.',
    primaryRoute: '/services/financial-growth?package=funding_readiness_snapshot#request-service',
    primaryCta: 'Request This Service',
    secondaryRoute: '/services/financial-growth',
    secondaryCta: 'Compare Financial Packages',
    parentServiceRoute: '/services/financial-growth',
    parentServiceLabel: 'Financial Growth Services',
  },
  {
    key: 'business_credit_builder_sprint',
    category: 'financial_growth',
    serviceKey: 'financial_growth_services',
    slug: 'business-credit-builder-sprint',
    title: 'Business Credit Builder Sprint',
    priceLabel: '$499',
    amount: 499,
    summary:
      'A setup sprint for business credit foundations, starter vendor strategy, monitoring, and lender-facing organization.',
    bestFor:
      'Businesses with an EIN and bank account that want a cleaner business credit plan.',
    deliverables: [
      'Business profile checklist',
      'Starter vendor and account roadmap',
      'Business credit monitoring setup guidance',
      'Funding preparation milestones',
    ],
    complianceNote:
      'Does not promise approvals, tradeline reporting, specific scores, or EIN-only funding.',
    primaryRoute: '/services/financial-growth?package=business_credit_builder_sprint#request-service',
    primaryCta: 'Request This Service',
    secondaryRoute: '/services/financial-growth',
    secondaryCta: 'Compare Financial Packages',
    parentServiceRoute: '/services/financial-growth',
    parentServiceLabel: 'Financial Growth Services',
  },
  {
    key: 'grant_application_prep',
    category: 'financial_growth',
    serviceKey: 'financial_growth_services',
    slug: 'grant-application-prep-review',
    title: 'Grant Application Prep Review',
    priceLabel: '$249',
    amount: 249,
    summary:
      'A practical review of grant eligibility, required documents, use-of-funds story, and application narrative before submission.',
    bestFor:
      'Owners who found a grant but need help organizing the application package.',
    deliverables: [
      'Grant preparation checklist',
      'Use-of-funds and impact outline',
      'Application narrative improvement notes',
      'Deadline and document tracker',
    ],
    complianceNote:
      'Does not guarantee grant eligibility, award selection, deadlines, or funding.',
    primaryRoute: '/services/financial-growth?package=grant_application_prep#request-service',
    primaryCta: 'Request This Service',
    secondaryRoute: '/services/financial-growth',
    secondaryCta: 'Compare Financial Packages',
    parentServiceRoute: '/services/financial-growth',
    parentServiceLabel: 'Financial Growth Services',
  },
  {
    key: 'debt_utilization_plan',
    category: 'financial_growth',
    serviceKey: 'financial_growth_services',
    slug: 'debt-utilization-paydown-plan',
    title: 'Debt And Utilization Paydown Plan',
    priceLabel: '$199',
    amount: 199,
    summary:
      'A credit-utilization and payoff plan built around funding goals, cash flow, and dispute timing.',
    bestFor:
      'Clients whose card balances or debt load may be hurting funding or credit outcomes.',
    deliverables: [
      'Utilization target plan',
      'Paydown sequence options',
      'Funding application timing notes',
      'Credit repair timing notes',
    ],
    complianceNote:
      'Educational planning only. This is not debt settlement, legal, tax, or investment advice.',
    primaryRoute: '/services/financial-growth?package=debt_utilization_plan#request-service',
    primaryCta: 'Request This Service',
    secondaryRoute: '/services/financial-growth',
    secondaryCta: 'Compare Financial Packages',
    parentServiceRoute: '/services/financial-growth',
    parentServiceLabel: 'Financial Growth Services',
  },
  {
    key: 'cash_flow_document_review',
    category: 'financial_growth',
    serviceKey: 'financial_growth_services',
    slug: 'cash-flow-bank-statement-review',
    title: 'Cash Flow And Bank Statement Review',
    priceLabel: '$199',
    amount: 199,
    summary:
      'A preparation review of deposits, revenue story, bank statements, and documents before business funding conversations.',
    bestFor:
      'Owners who need to organize revenue proof and lender-facing documents.',
    deliverables: [
      'Revenue story summary',
      'Deposit and document checklist',
      'Lender question prep',
      'Missing-records action list',
    ],
    complianceNote:
      'Preparation support only. This is not accounting, tax advice, underwriting, or lender approval.',
    primaryRoute: '/services/financial-growth?package=cash_flow_document_review#request-service',
    primaryCta: 'Request This Service',
    secondaryRoute: '/services/financial-growth',
    secondaryCta: 'Compare Financial Packages',
    parentServiceRoute: '/services/financial-growth',
    parentServiceLabel: 'Financial Growth Services',
  },
  {
    key: 'real_estate_deal_review',
    category: 'financial_growth',
    serviceKey: 'real_estate_funding',
    slug: 'real-estate-deal-funding-review',
    title: 'Real Estate Deal Funding Review',
    priceLabel: '$300',
    amount: 300,
    summary:
      'A deal-prep review for DSCR, hard-money, fix-and-flip, or rental funding conversations.',
    bestFor:
      'Investors with a specific deal who need to prepare lender-facing details.',
    deliverables: [
      'Deal summary review',
      'Funding product notes',
      'Document and timeline checklist',
      'Partner or lender follow-up routing',
    ],
    complianceNote:
      'Does not promise financing, appraised value, terms, closing, or lender approval.',
    primaryRoute: '/services/financial-growth?package=real_estate_deal_review#request-service',
    primaryCta: 'Request This Service',
    secondaryRoute: '/real-estate-funding',
    secondaryCta: 'Submit A Real Estate Deal',
    parentServiceRoute: '/services/financial-growth',
    parentServiceLabel: 'Financial Growth Services',
  },
  ...automationPackages.map((pkg) => ({
    key: pkg.key,
    category: 'growth_automation' as const,
    serviceKey: 'ai_assistant',
    slug: pkg.slug,
    title: pkg.title,
    priceLabel: pkg.priceLabel,
    amount: pkg.amount,
    summary: pkg.summary,
    bestFor: pkg.bestFor,
    deliverables: pkg.deliverables,
    complianceNote: pkg.complianceNote,
    primaryRoute: `/ai-assistant?package=${pkg.key}#request-setup`,
    primaryCta: 'Request This Service',
    secondaryRoute: '/ai-assistant',
    secondaryCta: 'Compare Automation Packages',
    parentServiceRoute: '/ai-assistant',
    parentServiceLabel: 'AI Receptionist And Website Systems',
  })),
  ...visibilityExpansionPackages.map((pkg) => ({
    key: pkg.key,
    category: 'visibility_expansion' as const,
    serviceKey: 'visibility_expansion',
    slug: pkg.slug,
    title: pkg.title,
    priceLabel: pkg.priceLabel,
    amount: pkg.amount,
    summary: pkg.summary,
    bestFor: pkg.bestFor,
    deliverables: pkg.deliverables,
    complianceNote: pkg.complianceNote,
    primaryRoute: `/visibility-expansion?package=${pkg.key}#request-visibility-review`,
    primaryCta: 'Request This Service',
    secondaryRoute: '/visibility-expansion',
    secondaryCta: 'Compare Visibility Packages',
    parentServiceRoute: '/visibility-expansion',
    parentServiceLabel: 'Visibility Expansion',
  })),
];

export function getPricedOffer(key: string) {
  return pricedVestBlockOffers.find((offer) => offer.key === key);
}

export function getPricedOfferBySlug(slug: string) {
  return pricedVestBlockOffers.find((offer) => offer.slug === slug);
}
