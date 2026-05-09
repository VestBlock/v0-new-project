import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { requirePaidToolAccess } from '@/lib/auth/access-server';
import { absoluteUrl } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'Business Credit Builder Roadmap Tool',
  description:
    'Build a business credit roadmap for vendor accounts, monitoring, starter-card timing, funding milestones, and lender preparation.',
  alternates: {
    canonical: '/tools/business-credit',
  },
  openGraph: {
    title: 'VestBlock Business Credit Builder',
    description:
      'Business credit planning for owners preparing vendor accounts, monitoring, documents, and funding preparation.',
    url: absoluteUrl('/tools/business-credit'),
  },
};

export default async function BusinessCreditLayout({ children }: { children: ReactNode }) {
  await requirePaidToolAccess('/tools/business-credit');
  return children;
}
