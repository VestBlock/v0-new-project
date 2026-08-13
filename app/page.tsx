import type { Metadata } from 'next';
import { LenisProvider } from '@/components/cinematic/lenis-provider';
import { CinematicHero } from '@/components/cinematic/cinematic-hero';
import { HomepageDirectory } from '@/components/home/homepage-directory';
import { DealVaultProofSection } from '@/components/home/dealvault-proof-section';
import { TrustSection } from '@/components/home/trust-section';
import { CinematicCta } from '@/components/cinematic/cinematic-cta';
import { absoluteUrl } from '@/lib/seo/site';
import {
  organizationJsonLd,
  websiteJsonLd,
  homepageFaqJsonLd,
} from '@/lib/seo/structuredData';

export const metadata: Metadata = {
  title: 'Capital, Real Estate, Opportunity, and DealVault | VestBlock',
  description:
    'VestBlock coordinates practical next moves across capital, real estate, financial readiness, business growth, and DealVault records.',
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
    title: 'Capital, Real Estate, Opportunity, and DealVault | VestBlock',
    description:
      'Capital preparation, real estate pathways, practical opportunity roadmaps, and DealVault continuity—organized around a clear next move.',
    url: absoluteUrl('/'),
    images: [
      {
        url: absoluteUrl('/opengraph-image'),
        width: 1200,
        height: 630,
        alt: 'VestBlock Capital, Real Estate, Opportunity, and DealVault social preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Capital, Real Estate, Opportunity, and DealVault | VestBlock',
    description:
      'Capital preparation, real estate pathways, practical opportunity roadmaps, and DealVault continuity—organized around a clear next move.',
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
      <HomepageDirectory />
      <DealVaultProofSection />
      <TrustSection />
      <CinematicCta />
    </div>
  );
}
