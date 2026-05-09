import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { absoluteUrl } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'Business Funding Strategy Prep',
  description:
    'Prepare for a business funding strategy with a funding-prep score, document review, inquiry-risk consent, utilization guidance, and VestBlock follow-up.',
  alternates: {
    canonical: '/funding/business-funding-strategy',
  },
  openGraph: {
    title: 'VestBlock Business Funding Strategy',
    description:
      'A $300 funding prep plan for business owners considering business credit lines, with no approval or credit-limit guarantees.',
    url: absoluteUrl('/funding/business-funding-strategy'),
  },
};

export default function CreditCardStrategyLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
