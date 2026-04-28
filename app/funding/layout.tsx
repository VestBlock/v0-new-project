import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { absoluteUrl } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'Business Funding Eligibility Checker And Readiness Plan',
  description:
    'Check business funding eligibility for free, review readiness factors, and move into VestBlock funding prep or business funding strategy when more support is needed.',
  alternates: {
    canonical: '/funding',
  },
  openGraph: {
    title: 'VestBlock Business Funding Eligibility',
    description:
      'Free business funding eligibility check with paid readiness support when a business needs document, credit, or application preparation.',
    url: absoluteUrl('/funding'),
  },
};

export default function FundingLayout({ children }: { children: ReactNode }) {
  return children;
}
