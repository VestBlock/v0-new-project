export type VestBlockServiceKey =
  | 'dealvault'
  | 'ai_credit_analysis'
  | 'credit_dispute_letters'
  | 'business_setup'
  | 'business_credit'
  | 'business_funding'
  | 'credit_card_stacking'
  | 'financial_growth_services'
  | 'grants'
  | 'spanish_business_funding'
  | 'real_estate_funding'
  | 'sell_property'
  | 'ai_assistant'
  | 'visibility_expansion';

export type VestBlockMarketingService = {
  key: VestBlockServiceKey;
  label: string;
  offerPath: string;
  audience: string;
  valuePromise: string;
  proofPoints: string[];
  complianceNotes: string[];
};

export const vestblockMarketingServices: VestBlockMarketingService[] = [
  {
    key: 'dealvault',
    label: 'DealVault',
    offerPath: '/dealvault',
    audience: 'small real estate businesses, investor teams, partner groups, and contractor-led projects that need cleaner records and accountability',
    valuePromise:
      'Track agreements, payout terms, proof records, and project milestones with a premium record product and a live audit trail behind it.',
    proofPoints: [
      'Live on-chain proof and payout records',
      'Proof certificate generation',
      'Deal, payout, and milestone tracking',
      'Private demo request path',
    ],
    complianceNotes: [
      'Do not overpromise legal enforceability.',
      'Make clear that sensitive documents stay off-chain.',
      'Position the product as proof records, payout tracking, and transparent event trails.',
    ],
  },
  {
    key: 'ai_credit_analysis',
    label: 'Credit Review Tools',
    offerPath: '/credit-upload',
    audience: 'people who want to understand what is hurting their credit report',
    valuePromise:
      'Upload a credit report and get an organized analysis of possible issues, next steps, and dispute-letter support.',
    proofPoints: [
      'Report upload and analysis flow',
      'Credit repair progress statuses',
      'Status alerts for uploaded, completed, and failed analyses',
    ],
    complianceNotes: [
      'Do not promise score increases.',
      'Do not promise deletion of accurate information.',
      'Frame disputes around accuracy, documentation, and user review.',
    ],
  },
  {
    key: 'credit_dispute_letters',
    label: 'Credit Dispute Letters',
    offerPath: '/tools/my-dispute-letters',
    audience: 'consumers preparing focused credit bureau or furnisher disputes',
    valuePromise:
      'Turn credit report findings into clear draft dispute letters that users can review before sending.',
    proofPoints: [
      'Dispute letter generation',
      'PDF downloads',
      'Credit report issue organization',
    ],
    complianceNotes: [
      'Letters are drafts for review.',
      'Avoid legal advice positioning.',
      'Use factual, specific language.',
    ],
  },
  {
    key: 'business_setup',
    label: 'Business Setup For Funding',
    offerPath: '/business-setup',
    audience: 'business owners preparing their company before applying for funding or grants',
    valuePromise:
      'Organize business records, EIN, banking, documents, credit profile details, and use-of-funds notes before applying.',
    proofPoints: [
      'Funding preparation checklist',
      'Business setup checklist',
      'Links into business credit and grants tools',
    ],
    complianceNotes: [
      'Do not guarantee funding.',
      'Do not describe grants as easy free money.',
      'Focus on preparation and documentation.',
    ],
  },
  {
    key: 'business_credit',
    label: 'Business Credit Builder',
    offerPath: '/tools/business-credit',
    audience: 'small business owners building a lender-ready business profile',
    valuePromise:
      'Create a roadmap for vendors, monitoring, starter cards, and funding resources based on the business profile.',
    proofPoints: [
      'Business credit roadmap',
      'Saved profile answers',
      'PDF roadmap output',
    ],
    complianceNotes: [
      'Do not promise approvals.',
      'Be careful with EIN-only claims.',
      'Mention personal credit may still matter.',
    ],
  },
  {
    key: 'business_funding',
    label: 'Business Funding',
    offerPath: '/funding',
    audience: 'business owners comparing realistic funding paths',
    valuePromise:
      'Review funding options based on credit, revenue, business stage, documents, and use of funds.',
    proofPoints: [
      'Funding page',
      'Lead intake and follow-up notes',
      'Payment and lead tracking view',
    ],
    complianceNotes: [
      'Do not guarantee approvals or terms.',
      'Keep partner and lead-source language clear.',
      'Encourage reviewing repayment ability.',
    ],
  },
  {
    key: 'credit_card_stacking',
    label: 'Business Funding Strategy',
    offerPath: '/funding/business-funding-strategy',
    audience: 'business owners considering multiple business credit cards for working capital',
    valuePromise:
      'Review documents, utilization, inquiry risk, consent, and repayment considerations before a business credit line funding strategy.',
    proofPoints: [
      '$300 funding preparation plan',
      'Funding strategy request path',
      'Success-fee consent tracking',
      'Review dashboard',
    ],
    complianceNotes: [
      'Do not guarantee card approvals or limits.',
      'Explain hard-inquiry, utilization, and repayment risks.',
      'Keep the 10% success fee tied to accepted and available business credit funding.',
    ],
  },
  {
    key: 'financial_growth_services',
    label: 'Funding & Business Credit Prep Reviews',
    offerPath: '/services/financial-growth',
    audience: 'clients who need paid preparation before applying for funding, grants, credit, or real estate financing',
    valuePromise:
      'Offer focused prep reviews for funding readiness, business credit setup, grants, debt utilization, cash-flow documents, and real estate deal funding review.',
    proofPoints: [
      'Prep review request form',
      'Business funding intake support',
      'Package status visibility',
      'Service package catalog',
    ],
    complianceNotes: [
      'Do not promise approvals, funding, grant awards, or credit score outcomes.',
      'Keep services positioned as preparation, education, and document organization.',
      'Avoid tax, legal, or investment advice positioning.',
    ],
  },
  {
    key: 'grants',
    label: 'Small Business Grants',
    offerPath: '/tools/grants',
    audience: 'business owners searching for grant opportunities that fit their profile',
    valuePromise:
      'Match business details to grant opportunities and draft a stronger application letter.',
    proofPoints: [
      'Grant matching tool',
      'Application letter draft',
      'Grant preparation checklist',
    ],
    complianceNotes: [
      'Do not promise awards.',
      'Explain eligibility and deadlines.',
      'Avoid “free money for everyone” framing.',
    ],
  },
  {
    key: 'spanish_business_funding',
    label: 'Spanish Business Funding',
    offerPath: '/es/vestblock',
    audience: 'Spanish-speaking business owners preparing for funding',
    valuePromise:
      'Help Spanish-speaking owners prepare documents, banking, credit profile details, and next steps before reviewing Bank Breezy options.',
    proofPoints: [
      'Spanish funding landing page',
      'Bank Breezy Spanish partner link',
      'Business setup preparation steps',
    ],
    complianceNotes: [
      'Do not guarantee funding in Spanish or English.',
      'Use natural Spanish and avoid machine-translated filler.',
      'Frame Bank Breezy as a place to review options.',
    ],
  },
  {
    key: 'real_estate_funding',
    label: 'Real Estate Funding',
    offerPath: '/real-estate-funding',
    audience: 'investors and property owners looking for real estate funding conversations',
    valuePromise:
      'Capture deal details and route high-intent real estate funding leads for follow-up.',
    proofPoints: ['Real estate lead form', 'Lead review view', 'Follow-up task tracking'],
    complianceNotes: [
      'Do not promise financing.',
      'Make lead source and follow-up expectations clear.',
      'Avoid implying underwriting has happened before review.',
    ],
  },
  {
    key: 'sell_property',
    label: 'Seller Property Review',
    offerPath: '/sell',
    audience: 'property owners who want fast cash, creative structure, novation, or partner-fit sale review',
    valuePromise:
      'Collect property details, payoff context, preferred sale path, and contact information so the team can review the right route.',
    proofPoints: ['Sell property form', 'Preferred sale path capture', 'Lead tracking', 'Follow-up path'],
    complianceNotes: [
      'Do not promise a specific offer.',
      'Do not imply instant approval.',
      'Keep next steps simple and transparent.',
    ],
  },
  {
    key: 'ai_assistant',
    label: 'AI Receptionist & Booking',
    offerPath: '/ai-assistant',
    audience: 'service businesses that need stronger lead capture, booking support, or a better converting website',
    valuePromise:
      'Install AI receptionist, appointment-booking, and conversion-focused website support that helps visitors turn into leads and appointments.',
    proofPoints: [
      'AI receptionist intake route',
      'Appointment booking offer path',
      'Website upgrade sprint packaging',
      'Lead capture and follow-up support',
    ],
    complianceNotes: [
      'Do not guarantee booked revenue or sales results.',
      'Keep pricing clear between setup fees, monthly support, and larger website scopes.',
      'Frame the service around lead capture, conversion support, and business responsiveness.',
    ],
  },
  {
    key: 'visibility_expansion',
    label: 'AEO/SEO Booster',
    offerPath: '/visibility-expansion',
    audience: 'service businesses that want more search visibility, answer-engine coverage, and authority without a vague marketing retainer',
    valuePromise:
      'Package AEO, SEO, city pages, and PR authority work into recurring growth plans that are easier to understand and easier to keep moving.',
    proofPoints: [
      'Search visibility package page',
      'City and authority package offer paths',
      'AI-assisted first-pass visibility review',
      'Lead capture and follow-up support',
    ],
    complianceNotes: [
      'Do not guarantee rankings, traffic, citations, media pickups, or revenue.',
      'Frame the work around better search coverage, publishing discipline, and authority growth.',
      'Keep the customer promise tied to execution quality and recurring monthly support.',
    ],
  },
];

export function getVestBlockMarketingService(key: string) {
  return (
    vestblockMarketingServices.find((service) => service.key === key) ??
    vestblockMarketingServices[0]
  );
}
