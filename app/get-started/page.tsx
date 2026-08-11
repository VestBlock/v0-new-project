import type { Metadata } from 'next';

import { GetStartedPage } from '@/components/get-started-page';
import { absoluteUrl } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'Get Started With VestBlock',
  description:
    'Tell VestBlock whether you need capital, deals, or a business opportunity, then continue into the right existing workflow.',
  alternates: {
    canonical: '/get-started',
  },
  openGraph: {
    title: 'Get Started With VestBlock',
    description:
      'Tell VestBlock whether you need capital, deals, or a business opportunity, then continue into the right existing workflow.',
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
      'Tell VestBlock whether you need capital, deals, or a business opportunity, then continue into the right existing workflow.',
    images: [absoluteUrl('/opengraph-image')],
  },
};

export default function GetStartedRoute() {
  return <GetStartedPage />;
}
