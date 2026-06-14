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
    description: 'Operator cockpit: agents, priorities, market heat, and the live system feed.',
    href: '/admin/command-center',
    group: 'command',
  },
  {
    title: 'Lead Management',
    description: 'Lead intake, scoring, enrichment, and follow-up.',
    href: '/admin/leads',
    group: 'pipeline',
  },
  {
    title: 'Lead Sources',
    description: 'DealMachine, partner discovery, and source readiness.',
    href: '/admin/lead-sources',
    group: 'pipeline',
  },
  {
    title: 'Market Expansion',
    description: 'Priority metros for seller inventory and partner coverage.',
    href: '/admin/market-expansion',
    group: 'pipeline',
  },
  {
    title: 'Scrape Runs',
    description: 'Current partner discovery runs plus archived legacy scrape history.',
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
    title: 'Investor Partnerships',
    description: 'Investor discovery, scoring, outreach, and DealVault routing.',
    href: '/admin/investor-partnerships',
    group: 'partners',
  },
  {
    title: 'Buyer Outreach',
    description: 'Approved buyer messages and send queue.',
    href: '/admin/buyer-outreach',
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
    title: 'Research',
    description: 'Research queue, diligence, and market notes.',
    href: '/admin/research',
    group: 'intel',
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
    description: 'Primary operator cockpit.',
  },
  {
    id: 'pipeline',
    title: 'Pipeline',
    description: 'Lead flow, sourcing, and markets.',
  },
  {
    id: 'partners',
    title: 'Partners',
    description: 'Buyer, lender, and builder network operations.',
  },
  {
    id: 'intel',
    title: 'Intelligence',
    description: 'Research and diligence.',
  },
  {
    id: 'ops',
    title: 'Ops',
    description: 'Hidden unless needed.',
  },
]
