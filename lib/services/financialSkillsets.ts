export const financialSkillsetPackageKeys = [
  'funding_readiness_snapshot',
  'business_credit_builder_sprint',
  'grant_application_prep',
  'debt_utilization_plan',
  'cash_flow_document_review',
  'real_estate_deal_review',
] as const;

export type FinancialSkillsetPackageKey =
  (typeof financialSkillsetPackageKeys)[number];

export type FinancialSkillsetPackage = {
  key: FinancialSkillsetPackageKey;
  title: string;
  price: string;
  summary: string;
  bestFor: string;
  deliverables: string[];
  upsellPath: string;
  complianceNote: string;
};

export const financialSkillsetPackages: FinancialSkillsetPackage[] = [
  {
    key: 'funding_readiness_snapshot',
    title: 'Funding Readiness Snapshot',
    price: '$149',
    summary:
      'A focused review of the owner profile, business setup, credit readiness, and documents before applying for funding.',
    bestFor: 'Owners who want to know what to fix before they submit funding applications.',
    deliverables: [
      'Readiness score and risk notes',
      'Document checklist',
      'Next best funding path recommendation',
      'Admin follow-up task for VestBlock review',
    ],
    upsellPath: '$300 Business Funding Readiness Plan when hands-on prep is needed',
    complianceNote:
      'Does not guarantee approval, terms, limits, or funding availability.',
  },
  {
    key: 'business_credit_builder_sprint',
    title: 'Business Credit Builder Sprint',
    price: '$499',
    summary:
      'A setup sprint for business credit foundations, starter vendor strategy, monitoring, and lender-readiness organization.',
    bestFor: 'Businesses with an EIN and bank account that want a cleaner business credit path.',
    deliverables: [
      'Business profile checklist',
      'Starter vendor and account roadmap',
      'Business credit monitoring setup guidance',
      'Funding-readiness milestones',
    ],
    upsellPath: 'Funding readiness or business credit line support after foundations are stronger',
    complianceNote:
      'Does not promise approvals, tradeline reporting, specific scores, or EIN-only funding.',
  },
  {
    key: 'grant_application_prep',
    title: 'Grant Application Prep Review',
    price: '$249',
    summary:
      'A practical review of grant fit, required documents, use-of-funds story, and application narrative before submission.',
    bestFor: 'Owners who found a grant but need help organizing the application package.',
    deliverables: [
      'Grant-readiness checklist',
      'Use-of-funds and impact outline',
      'Application narrative improvement notes',
      'Deadline and document tracker',
    ],
    upsellPath: 'Business setup support when missing documents or records are blocking eligibility',
    complianceNote:
      'Does not guarantee grant eligibility, award selection, deadlines, or funding.',
  },
  {
    key: 'debt_utilization_plan',
    title: 'Debt And Utilization Paydown Plan',
    price: '$199',
    summary:
      'A credit-utilization and payoff sequence plan built around funding readiness, cash flow, and dispute workflow timing.',
    bestFor: 'Clients whose card balances or debt load may be hurting funding or credit outcomes.',
    deliverables: [
      'Utilization target plan',
      'Paydown sequence options',
      'Funding application timing notes',
      'Credit repair workflow alignment',
    ],
    upsellPath: 'AI credit analysis and dispute-letter support when report issues are also present',
    complianceNote:
      'Educational planning only; not debt settlement, legal, tax, or investment advice.',
  },
  {
    key: 'cash_flow_document_review',
    title: 'Cash Flow And Bank Statement Review',
    price: '$199',
    summary:
      'A preparation review of deposits, revenue story, bank statements, and documents before business funding conversations.',
    bestFor: 'Owners who need to organize revenue proof and lender-facing documents.',
    deliverables: [
      'Revenue story summary',
      'Deposit and document checklist',
      'Lender question prep',
      'Missing-records action list',
    ],
    upsellPath: 'Funding readiness plan when the file needs deeper cleanup before applications',
    complianceNote:
      'Preparation support only; not accounting, tax advice, underwriting, or lender approval.',
  },
  {
    key: 'real_estate_deal_review',
    title: 'Real Estate Deal Funding Review',
    price: '$300',
    summary:
      'A deal-prep review for DSCR, hard-money, fix-and-flip, or rental funding conversations.',
    bestFor: 'Investors with a specific deal who need to prepare lender-facing details.',
    deliverables: [
      'Deal summary review',
      'Funding product fit notes',
      'Document and timeline checklist',
      'Partner/lender follow-up routing',
    ],
    upsellPath: 'Real estate funding lead workflow for lender or partner review',
    complianceNote:
      'Does not promise financing, appraised value, terms, closing, or lender approval.',
  },
];

export function getFinancialSkillsetPackage(key: string) {
  return financialSkillsetPackages.find((item) => item.key === key);
}
