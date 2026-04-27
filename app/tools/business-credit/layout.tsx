import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { absoluteUrl } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'Business Credit Builder Roadmap Tool',
  description:
    'Build a business credit roadmap for vendor accounts, monitoring, starter card readiness, funding milestones, and lender preparation.',
  alternates: {
    canonical: '/tools/business-credit',
  },
  openGraph: {
    title: 'VestBlock Business Credit Builder',
    description:
      'Business credit planning for owners preparing vendor accounts, monitoring, documents, and funding readiness.',
    url: absoluteUrl('/tools/business-credit'),
  },
};

export default function BusinessCreditLayout({ children }: { children: ReactNode }) {
  return children;
}

