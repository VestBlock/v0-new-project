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
  title: 'AEO/SEO Booster | Google, Answer Engines, Local Pages, and PR',
  description:
    'Compare VestBlock AEO/SEO Booster offers for clearer service pages, local content, answer-engine readiness, and PR authority growth.',
  alternates: {
    canonical: '/visibility-expansion',
  },
  keywords: [
    'search visibility service',
    'AEO SEO booster',
    'answer engine optimization service',
    'local search visibility service',
    'small business SEO service',
    'city page SEO',
    'local business PR',
    'answer engine optimization',
    'search visibility for service businesses',
  ],
  openGraph: {
    title: 'AEO/SEO Booster Service',
    description:
      'VestBlock packages SEO, AEO, local pages, content, and PR into productized offers that are easier to understand and easier to buy.',
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
    title: 'AEO/SEO Booster Service',
    description:
      'VestBlock packages SEO, AEO, local pages, content, and PR into productized offers that are easier to understand and easier to buy.',
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
