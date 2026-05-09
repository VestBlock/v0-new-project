export type AdminNavItem = {
  title: string
  description: string
  href: string
  group:
    | 'command'
    | 'pipeline'
    | 'partners'
    | 'growth'
    | 'intel'
    | 'ops'
}

export const adminNavItems: AdminNavItem[] = [
  {
    title: 'Command Center',
    description: 'Main overview, tasks, quotas, diagnostics, and activity.',
    href: '/admin-panel',
    group: 'command',
  },
  {
    title: 'Funding Pipeline',
    description: 'Funding requests, paid strategy reviews, and approvals.',
    href: '/admin/funding',
    group: 'pipeline',
  },
  {
    title: 'Lead Management',
    description: 'Lead intake, scoring, enrichment, and follow-up.',
    href: '/admin/leads',
    group: 'pipeline',
  },
  {
    title: 'Lead Sources',
    description: 'Maps, public data, and source readiness.',
    href: '/admin/lead-sources',
    group: 'pipeline',
  },
  {
    title: 'Market Expansion',
    description: 'Target markets and daily scrape focus.',
    href: '/admin/market-expansion',
    group: 'pipeline',
  },
  {
    title: 'Scrape Runs',
    description: 'Recent ingestion jobs and source results.',
    href: '/admin/scrape-runs',
    group: 'pipeline',
  },
  {
    title: 'Buyer Network',
    description: 'Buyers, outreach, and property matches.',
    href: '/admin/buyers',
    group: 'partners',
  },
  {
    title: 'Buyer Outreach',
    description: 'Approved buyer messages and send queue.',
    href: '/admin/buyer-outreach',
    group: 'partners',
  },
  {
    title: 'Buyer Matches',
    description: 'Property-to-buyer fit and routing.',
    href: '/admin/buyer-matches',
    group: 'partners',
  },
  {
    title: 'Lender Network',
    description: 'Lenders, partner fit, and relationship status.',
    href: '/admin/lenders',
    group: 'partners',
  },
  {
    title: 'Lender Outreach',
    description: 'Approved lender messages and send queue.',
    href: '/admin/lender-outreach',
    group: 'partners',
  },
  {
    title: 'Lender Matches',
    description: 'Borrower-to-lender fit and routing.',
    href: '/admin/lender-matches',
    group: 'partners',
  },
  {
    title: 'Lender Programs',
    description: 'Program inventory and fit boxes.',
    href: '/admin/lender-programs',
    group: 'partners',
  },
  ...(process.env.NEXT_PUBLIC_ENABLE_DEALVAULT === 'true'
    ? [
        {
          title: 'DealVault',
          description: 'Real estate agreements, payout ledgers, and proof tracking.',
          href: '/admin/dealvault',
          group: 'partners' as const,
        },
        {
          title: 'Blockchain Audit',
          description: 'DealVault chain readiness and contract diagnostics.',
          href: '/admin/blockchain',
          group: 'ops' as const,
        },
      ]
    : []),
  {
    title: 'SEO Opportunities',
    description: 'Entity SEO, service gaps, and publishing opportunities.',
    href: '/admin/seo-opportunities',
    group: 'growth',
  },
  {
    title: 'Improvement',
    description: 'Optimization backlog and process upgrades.',
    href: '/admin/improvement',
    group: 'growth',
  },
  {
    title: 'PR Engine',
    description: 'Targets, pitch drafts, submissions, and follow-up queue.',
    href: '/admin/pr-engine',
    group: 'growth',
  },
  {
    title: 'Research',
    description: 'Research queue, angles, and market notes.',
    href: '/admin/research',
    group: 'intel',
  },
  {
    title: 'Experiments',
    description: 'Tests, experiments, and operator notes.',
    href: '/admin/experiments',
    group: 'intel',
  },
  {
    title: 'Daily Reports',
    description: 'Daily operational and performance reports.',
    href: '/admin/reports/daily',
    group: 'ops',
  },
  {
    title: 'Admin Test',
    description: 'Protected internal test route.',
    href: '/admin/test',
    group: 'ops',
  },
]

export const adminNavGroups: Array<{
  id: AdminNavItem['group']
  title: string
  description: string
}> = [
  {
    id: 'command',
    title: 'Command',
    description: 'Top-level operator control and dashboards.',
  },
  {
    id: 'pipeline',
    title: 'Pipeline',
    description: 'Lead flow, sources, and funding intake.',
  },
  {
    id: 'partners',
    title: 'Partners',
    description: 'Buyer and lender network operations.',
  },
  {
    id: 'growth',
    title: 'Growth',
    description: 'Content, SEO, and process improvement.',
  },
  {
    id: 'intel',
    title: 'Intelligence',
    description: 'Research and experiments.',
  },
  {
    id: 'ops',
    title: 'Ops',
    description: 'Reporting and internal QA tools.',
  },
]

export const adminPanelTabs = [
  'tasks',
  'payments',
  'funding-strategy',
  'content',
  'automation',
  'government',
  'reports',
  'users',
  'alerts',
  'activity',
  'diagnostics',
  'aeo',
  'improvement',
] as const

export type AdminPanelTab = (typeof adminPanelTabs)[number]

export const adminPanelTabGroups: Array<{
  title: string
  tabs: Array<{ value: AdminPanelTab; label: string }>
}> = [
  {
    title: 'Command',
    tabs: [
      { value: 'tasks', label: 'Tasks' },
      { value: 'payments', label: 'Payments' },
      { value: 'funding-strategy', label: 'Funding Strategy' },
      { value: 'automation', label: 'Automation' },
    ],
  },
  {
    title: 'Growth',
    tabs: [
      { value: 'content', label: 'Content' },
      { value: 'aeo', label: 'AEO / LLM' },
      { value: 'government', label: 'Government' },
      { value: 'improvement', label: 'Improvement' },
    ],
  },
  {
    title: 'Support',
    tabs: [
      { value: 'reports', label: 'Credit Reports' },
      { value: 'users', label: 'Users' },
      { value: 'alerts', label: 'Alerts' },
      { value: 'activity', label: 'Activity' },
      { value: 'diagnostics', label: 'Diagnostics' },
    ],
  },
]
