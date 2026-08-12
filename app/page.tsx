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
  realEstatePartnerServiceJsonLd,
} from '@/lib/seo/structuredData';

export const metadata: Metadata = {
  title: 'Real Estate Opportunity Intelligence and Execution | VestBlock',
  description:
    'VestBlock helps real-estate owners, capital partners, and execution teams prepare opportunities, assess fit, route qualified conversations, and maintain private DealVault records.',
  keywords: [
    'real estate partner network',
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
    title: 'Real Estate Opportunity Intelligence and Execution | VestBlock',
    description:
      'A real-estate platform for preparing opportunities, assessing fit, routing qualified conversations, and maintaining DealVault records.',
    url: absoluteUrl('/'),
    images: [
      {
        url: absoluteUrl('/opengraph-image'),
        width: 1200,
        height: 630,
        alt: 'VestBlock social preview with logo and real estate partner network message',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Real Estate Opportunity Intelligence and Execution | VestBlock',
    description:
      'Prepare real-estate opportunities, assess fit, route qualified conversations, and maintain DealVault records.',
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
            realEstatePartnerServiceJsonLd(),
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
