export const visibilityExpansionPackageKeys = [
  'visibility_starter',
  'city_expansion_engine',
  'authority_pr_engine',
] as const;

export type VisibilityExpansionPackageKey =
  (typeof visibilityExpansionPackageKeys)[number];

export type VisibilityExpansionPackage = {
  key: VisibilityExpansionPackageKey;
  title: string;
  priceLabel: string;
  amount: number;
  billingModel: 'monthly' | 'setup_and_monthly';
  summary: string;
  bestFor: string;
  deliverables: string[];
  turnaround: string;
  complianceNote: string;
  slug: string;
};

export const visibilityExpansionPackages: VisibilityExpansionPackage[] = [
  {
    key: 'visibility_starter',
    title: 'Visibility Starter',
    priceLabel: '$299/mo',
    amount: 299,
    billingModel: 'monthly',
    summary:
      'Turn a service website into something search engines can understand more clearly and show more confidently.',
    bestFor:
      'Single-location service businesses that need a cleaner local search and content foundation before they try to scale.',
    deliverables: [
      'Search visibility and website review',
      'Customer question and topic map',
      'Monthly content and update plan',
      'Visibility scorecard with priority next steps',
    ],
    turnaround: 'Typical setup begins within 5-7 business days after signup and website review.',
    complianceNote:
      'VestBlock provides visibility planning and publishing direction. Rankings, traffic, citations, and revenue still depend on competition, execution, crawl timing, and the business offer.',
    slug: 'visibility-starter',
  },
  {
    key: 'city_expansion_engine',
    title: 'City Expansion Engine',
    priceLabel: '$750 setup + $349/mo',
    amount: 750,
    billingModel: 'setup_and_monthly',
    summary:
      'Launch repeatable city and service pages with clear priorities and reporting that builds over time.',
    bestFor:
      'Businesses growing into multiple cities or service areas that need clearer local search coverage.',
    deliverables: [
      'City and service page plan',
      'Priority visibility opportunities by market',
      'Location-page and resource brief list',
      'Monthly indexing and market review',
    ],
    turnaround: 'Typical setup begins within 7-10 business days after signup and website review.',
    complianceNote:
      'VestBlock provides strategy, publishing direction, and operational support. Market traction still depends on local competition, site quality, offer clarity, and follow-through.',
    slug: 'city-expansion-engine',
  },
  {
    key: 'authority_pr_engine',
    title: 'Authority PR Engine',
    priceLabel: '$995/mo',
    amount: 995,
    billingModel: 'monthly',
    summary:
      'Add PR, authority-building, and citations so the brand earns stronger trust beyond on-site content alone.',
    bestFor:
      'Businesses with a serviceable website that want backlinks, mentions, expert positioning, and stronger trust.',
    deliverables: [
      'PR angle and authority plan',
      'Target list for podcasts, newsletters, and local media',
      'Recurring pitch and follow-up batch planning',
      'Monthly authority and citation progress review',
    ],
    turnaround: 'Typical first authority sprint begins within 7 business days after signup and website review.',
    complianceNote:
      'VestBlock can improve outreach and messaging, but media pickups, backlinks, and brand mentions are not guaranteed.',
    slug: 'authority-pr-engine',
  },
];

export function getVisibilityExpansionPackage(key: string) {
  return visibilityExpansionPackages.find((item) => item.key === key);
}
