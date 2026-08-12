import type { Metadata } from 'next';
import { LenisProvider } from '@/components/cinematic/lenis-provider';
import { CinematicHero } from '@/components/cinematic/cinematic-hero';
import { DealJourneySection } from '@/components/cinematic/deal-journey-section';
import { IntelligenceSection } from '@/components/cinematic/intelligence-section';
import { NetworkSection } from '@/components/cinematic/network-section';
import { DealVaultProofSection } from '@/components/home/dealvault-proof-section';
import { CinematicCta } from '@/components/cinematic/cinematic-cta';
import { absoluteUrl } from '@/lib/seo/site';
import {
  organizationJsonLd,
  websiteJsonLd,
  homepageFaqJsonLd,
} from '@/lib/seo/structuredData';

export const metadata: Metadata = {
  title: 'Capital, Deals, and Opportunity | VestBlock',
  description:
    'VestBlock brings capital access, deal pathways, and opportunities to build, acquire, or grow into one coordinated place. Find your next move.',
  keywords: [
    'business capital preparation',
    'capital readiness',
    'business acquisition opportunities',
    'deal evaluation',
    'business growth resources',
    'strategic opportunities',
    'real estate opportunity network',
    'seller property review',
    'buyer buy box network',
    'private lender network',
    'developer contractor partner network',
    'DealVault records',
    'real estate funding review',
    'cash buyer network',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Capital, Deals, and Opportunity | VestBlock',
    description:
      'Capital access, deal pathways, and opportunities to build, acquire, or grow—organized around a clear next move.',
    url: absoluteUrl('/'),
    images: [
      {
        url: absoluteUrl('/opengraph-image'),
        width: 1200,
        height: 630,
        alt: 'VestBlock Capital, Deals, and Opportunity social preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Capital, Deals, and Opportunity | VestBlock',
    description:
      'Capital access, deal pathways, and opportunities to build, acquire, or grow—organized around a clear next move.',
    images: [absoluteUrl('/opengraph-image')],
  },
};

export default function HomePage() {
  return (
    <div className="premium-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            organizationJsonLd(),
            websiteJsonLd(),
            homepageFaqJsonLd(),
          ]),
        }}
      />
      <LenisProvider />
      <CinematicHero />
      <DealJourneySection />
      <IntelligenceSection />
      <NetworkSection />
      <DealVaultProofSection />
      <CinematicCta />
    </div>
  );
}
