import type { Metadata } from 'next';

import { GetStartedPage } from '@/components/get-started-page';
import { absoluteUrl } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'Get Started With VestBlock',
  description:
    'Choose the right VestBlock path for sellers, buyers, lenders, developers, contractors, real estate funding, DealVault records, and member visibility support.',
  alternates: {
    canonical: '/get-started',
  },
  openGraph: {
    title: 'Get Started With VestBlock',
    description:
      'Choose the right VestBlock path for sellers, buyers, lenders, developers, contractors, real estate funding, DealVault records, and member visibility support.',
    url: absoluteUrl('/get-started'),
    images: [
      {
        url: absoluteUrl('/opengraph-image'),
        width: 1200,
        height: 630,
        alt: 'VestBlock get started preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Get Started With VestBlock',
    description:
      'Choose the right VestBlock path for sellers, buyers, lenders, developers, contractors, real estate funding, DealVault records, and member visibility support.',
    images: [absoluteUrl('/opengraph-image')],
  },
};

export default function GetStartedRoute() {
  return <GetStartedPage />;
}
