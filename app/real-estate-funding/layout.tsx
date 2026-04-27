import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { absoluteUrl } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'Real Estate Funding For DSCR, Rental, Flip, And Deal Review',
  description:
    'Submit DSCR, rental, fix-and-flip, hard-money, or deal funding details so VestBlock can review the opportunity and route lender or partner follow-up.',
  alternates: {
    canonical: '/real-estate-funding',
  },
  openGraph: {
    title: 'VestBlock Real Estate Funding',
    description:
      'Real estate funding lead intake for investors and property owners who need DSCR, rental, flip, hard-money, or deal review follow-up.',
    url: absoluteUrl('/real-estate-funding'),
  },
};

export default function RealEstateFundingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}

