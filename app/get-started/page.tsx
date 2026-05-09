import type { Metadata } from 'next';

import { GetStartedPage } from '@/components/get-started-page';
import { absoluteUrl } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'Get Started | VestBlock Workspace',
  description:
    'Choose the VestBlock service that matches your business, funding needs, buyer conversation, lender review, or seller opportunity.',
  alternates: {
    canonical: '/get-started',
  },
  openGraph: {
    title: 'Get Started | VestBlock Workspace',
    description:
      'Choose the VestBlock service that matches your current business, funding, buyer, lender, or seller need.',
    url: absoluteUrl('/get-started'),
  },
};

export default function GetStartedRoute() {
  return <GetStartedPage />;
}
