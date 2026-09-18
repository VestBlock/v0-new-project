import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { absoluteUrl } from '@/lib/seo/site';
import {
  vestBlockOpenGraphDefaults,
  vestBlockTwitterDefaults,
} from '@/lib/seo/socialMetadata';

export const metadata: Metadata = {
  title: 'Business Funding Eligibility Checker And Prep Plan',
  description:
    'Check business funding eligibility for free, review preparation factors, and move into VestBlock funding prep or business funding strategy when more support is needed.',
  alternates: {
    canonical: '/funding',
  },
  openGraph: {
    ...vestBlockOpenGraphDefaults,
    title: 'VestBlock Business Funding Eligibility',
    description:
      'Free business funding eligibility check with paid prep support when a business needs document, credit, or application preparation.',
    url: absoluteUrl('/funding'),
    images: [
      {
        url: absoluteUrl('/opengraph-image?v=3'),
        width: 1200,
        height: 630,
        alt: 'VestBlock business funding preview',
      },
    ],
  },
  twitter: {
    ...vestBlockTwitterDefaults,
    title: 'VestBlock Business Funding Eligibility',
    description:
      'Free business funding eligibility check with paid prep support when a business needs document, credit, or application preparation.',
  },
};

export default function FundingLayout({ children }: { children: ReactNode }) {
  return children;
}
