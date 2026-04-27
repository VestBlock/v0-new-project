import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { absoluteUrl } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'Credit Card Stacking Strategy Readiness',
  description:
    'Prepare for a business credit card funding strategy with readiness scoring, document review, inquiry-risk consent, utilization guidance, and VestBlock admin follow-up.',
  alternates: {
    canonical: '/funding/credit-card-strategy',
  },
  openGraph: {
    title: 'VestBlock Credit Card Stacking Strategy',
    description:
      'A $300 funding readiness plan for business owners considering business credit card stacking, with no approval or credit-limit guarantees.',
    url: absoluteUrl('/funding/credit-card-strategy'),
  },
};

export default function CreditCardStrategyLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}

