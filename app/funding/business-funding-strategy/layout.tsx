import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { absoluteUrl } from '@/lib/seo/site';
import { vestBlockOpenGraphDefaults, vestBlockTwitterDefaults } from '@/lib/seo/socialMetadata';

export const metadata: Metadata = {
  title: 'Business Funding Prep Plan',
  description:
    'Review funding readiness with a funding-prep score, document checks, inquiry-risk consent, utilization guidance, and VestBlock follow-up.',
  alternates: {
    canonical: '/funding/business-funding-strategy',
  },
  openGraph: {
    ...vestBlockOpenGraphDefaults,
    title: 'VestBlock Business Funding Prep Plan',
    description:
      'A $300 funding prep plan for business owners considering business credit lines, with no approval or credit-limit guarantees.',
    url: absoluteUrl('/funding/business-funding-strategy'),
  },
  twitter: {
    ...vestBlockTwitterDefaults,
    title: 'VestBlock Business Funding Prep Plan',
    description:
      'A $300 funding prep plan for business owners considering business credit lines, with no approval or credit-limit guarantees.',
  },
};

export default function CreditCardStrategyLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
