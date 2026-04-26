export type AeoTopic = {
  slug: string;
  title: string;
  cluster:
    | 'credit-repair'
    | 'business-credit'
    | 'funding'
    | 'credit-builder'
    | 'disputes';
  intent: 'education' | 'comparison' | 'lead-capture' | 'tool-support';
  offerPath: string;
};

export const vestblockAeoTopics: AeoTopic[] = [
  { slug: 'ai-credit-repair', title: 'AI credit repair', cluster: 'credit-repair', intent: 'lead-capture', offerPath: '/credit-upload' },
  { slug: 'credit-dispute-letters', title: 'Credit dispute letters', cluster: 'disputes', intent: 'tool-support', offerPath: '/tools/my-dispute-letters' },
  { slug: '609-letters', title: '609 letters', cluster: 'disputes', intent: 'education', offerPath: '/super-dispute' },
  { slug: 'method-of-verification', title: 'Method of verification', cluster: 'disputes', intent: 'education', offerPath: '/super-dispute' },
  { slug: 'charge-off-disputes', title: 'Charge-off disputes', cluster: 'disputes', intent: 'tool-support', offerPath: '/credit-upload' },
  { slug: 'collection-disputes', title: 'Collection disputes', cluster: 'disputes', intent: 'tool-support', offerPath: '/credit-upload' },
  { slug: 'business-credit', title: 'Business credit', cluster: 'business-credit', intent: 'lead-capture', offerPath: '/tools/business-credit' },
  { slug: 'ein-business-credit', title: 'EIN business credit', cluster: 'business-credit', intent: 'education', offerPath: '/tools/business-credit' },
  { slug: 'funding-readiness', title: 'Funding readiness', cluster: 'funding', intent: 'lead-capture', offerPath: '/funding' },
  { slug: 'grants-for-small-businesses', title: 'Grants for small businesses', cluster: 'funding', intent: 'education', offerPath: '/funding' },
  { slug: 'credit-builder-tools', title: 'Credit builder tools', cluster: 'credit-builder', intent: 'comparison', offerPath: '/dashboard' },
  { slug: 'secured-credit-cards', title: 'Secured credit cards', cluster: 'credit-builder', intent: 'comparison', offerPath: '/dashboard' },
  { slug: 'rent-reporting', title: 'Rent reporting', cluster: 'credit-builder', intent: 'comparison', offerPath: '/dashboard' },
  { slug: 'tradelines-education', title: 'Tradelines education', cluster: 'credit-builder', intent: 'education', offerPath: '/dashboard' },
  { slug: 'debt-validation', title: 'Debt validation', cluster: 'disputes', intent: 'education', offerPath: '/super-dispute' },
  { slug: 'credit-utilization', title: 'Credit utilization', cluster: 'credit-repair', intent: 'education', offerPath: '/dashboard' },
];

export function getAeoTopicsByCluster(cluster: AeoTopic['cluster']) {
  return vestblockAeoTopics.filter((topic) => topic.cluster === cluster);
}
