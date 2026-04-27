export type VestBlockServiceKey =
  | 'ai_credit_analysis'
  | 'credit_dispute_letters'
  | 'business_setup'
  | 'business_credit'
  | 'business_funding'
  | 'grants'
  | 'spanish_business_funding'
  | 'real_estate_funding'
  | 'sell_property'
  | 'ai_assistant';

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
    key: 'ai_credit_analysis',
    label: 'AI Credit Analysis',
    offerPath: '/credit-upload',
    audience: 'people who want to understand what is hurting their credit report',
    valuePromise:
      'Upload a credit report and get an organized analysis of possible issues, next steps, and dispute-letter support.',
    proofPoints: [
      'Report upload and analysis flow',
      'Credit repair workflow statuses',
      'Admin alerts for uploaded, completed, and failed analyses',
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
      'Organize entity records, EIN, banking, documents, credit readiness, and use-of-funds details before applying.',
    proofPoints: [
      'Funding readiness pillars',
      'Business setup checklist',
      'Links into business credit and grants tools',
    ],
    complianceNotes: [
      'Do not guarantee funding.',
      'Do not describe grants as easy free money.',
      'Focus on readiness and documentation.',
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
      'Lead intake and admin follow-up',
      'Payment and lead automation dashboard',
    ],
    complianceNotes: [
      'Do not guarantee approvals or terms.',
      'Keep partner and lead-source language clear.',
      'Encourage reviewing repayment ability.',
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
      'Grant readiness checklist',
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
      'Help Spanish-speaking owners prepare documents, banking, credit readiness, and next steps before reviewing Bank Breezy options.',
    proofPoints: [
      'Spanish funding landing page',
      'Bank Breezy Spanish partner link',
      'Business setup readiness pillars',
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
    proofPoints: ['Real estate lead form', 'Admin lead manager', 'Lead follow-up tasks'],
    complianceNotes: [
      'Do not promise financing.',
      'Make lead source and follow-up expectations clear.',
      'Avoid implying underwriting has happened before review.',
    ],
  },
  {
    key: 'sell_property',
    label: 'Sell Property Lead Flow',
    offerPath: '/sell',
    audience: 'property owners who want a cash-offer or investor conversation',
    valuePromise:
      'Collect property details and contact information so the team can review and follow up.',
    proofPoints: ['Sell property form', 'Lead tracking', 'Admin follow-up workflow'],
    complianceNotes: [
      'Do not promise a specific offer.',
      'Do not imply instant approval.',
      'Keep next steps simple and transparent.',
    ],
  },
  {
    key: 'ai_assistant',
    label: 'VestBlock AI Assistant',
    offerPath: '/ai-assistant',
    audience: 'users who need guided answers about credit, funding, and next steps',
    valuePromise:
      'Guide users toward the right VestBlock workflow for credit repair, business funding, grants, and support.',
    proofPoints: ['AI assistant route', 'Lead-support context', 'Internal tool routing'],
    complianceNotes: [
      'Do not provide legal, tax, or guaranteed approval advice.',
      'Route users to documented workflows.',
      'Keep sensitive information out of public posts.',
    ],
  },
];

export function getVestBlockMarketingService(key: string) {
  return (
    vestblockMarketingServices.find((service) => service.key === key) ??
    vestblockMarketingServices[0]
  );
}
