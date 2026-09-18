import type { Metadata } from 'next';

import { GetStartedPage } from '@/components/get-started-page';
import { absoluteUrl } from '@/lib/seo/site';
import {
  vestBlockOpenGraphDefaults,
  vestBlockTwitterDefaults,
} from '@/lib/seo/socialMetadata';

export const metadata: Metadata = {
  title: 'Choose Your VestBlock Path',
  description:
    'Choose the right VestBlock path for sellers, buyers, lenders, developers, contractors, real estate funding, DealVault records, and member visibility support.',
  alternates: {
    canonical: '/get-started',
  },
  openGraph: {
    ...vestBlockOpenGraphDefaults,
    title: 'Get Started With VestBlock',
    description:
      'Choose the right VestBlock path for sellers, buyers, lenders, developers, contractors, real estate funding, DealVault records, and member visibility support.',
    url: absoluteUrl('/get-started'),
    images: [
      {
        url: absoluteUrl('/opengraph-image?v=3'),
        width: 1200,
        height: 630,
        alt: 'VestBlock get started preview',
      },
    ],
  },
  twitter: {
    ...vestBlockTwitterDefaults,
    title: 'Get Started With VestBlock',
    description:
      'Choose the right VestBlock path for sellers, buyers, lenders, developers, contractors, real estate funding, DealVault records, and member visibility support.',
  },
};

export default function GetStartedRoute() {
  return <GetStartedPage />;
}
