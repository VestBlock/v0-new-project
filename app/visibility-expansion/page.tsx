import type { Metadata } from 'next';
import { Suspense } from 'react';

import { VisibilityExpansionPage } from '@/components/visibility-expansion-page';
import { absoluteUrl } from '@/lib/seo/site';
import {
  breadcrumbJsonLd,
  organizationJsonLd,
  visibilityExpansionServiceJsonLd,
} from '@/lib/seo/structuredData';

export const metadata: Metadata = {
  title: 'Search Visibility Service | SEO, AI Answers, and PR',
  description:
    'Compare VestBlock visibility offers for SEO, AI-answer visibility, city pages, and PR authority growth.',
  alternates: {
    canonical: '/visibility-expansion',
  },
  keywords: [
    'answer engine optimization service',
    'AI search visibility service',
    'small business SEO service',
    'city page SEO',
    'local business PR',
    'AI receptionist visibility',
    'search visibility for service businesses',
  ],
  openGraph: {
    title: 'Search Visibility Service',
    description:
      'VestBlock packages SEO, AI-answer visibility, and PR into productized offers that are easier to understand and easier to buy.',
    url: absoluteUrl('/visibility-expansion'),
    images: [
      {
        url: absoluteUrl('/opengraph-image'),
        width: 1200,
        height: 630,
        alt: 'VestBlock search visibility service preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Search Visibility Service',
    description:
      'VestBlock packages SEO, AI-answer visibility, and PR into productized offers that are easier to understand and easier to buy.',
    images: [absoluteUrl('/opengraph-image')],
  },
};

export default function VisibilityExpansionRoute() {
  const breadcrumbs = breadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Search Visibility', path: '/visibility-expansion' },
  ]);

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            organizationJsonLd(),
            breadcrumbs,
            visibilityExpansionServiceJsonLd(),
          ]),
        }}
      />
      <Suspense fallback={null}>
        <VisibilityExpansionPage />
      </Suspense>
    </main>
  );
}
