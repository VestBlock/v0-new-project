import type { Metadata } from 'next';
import { LenisProvider } from '@/components/cinematic/lenis-provider';
import { CinematicHero } from '@/components/cinematic/cinematic-hero';
import { CapitalFlowSection } from '@/components/cinematic/capital-flow-section';
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
  title: 'Connect Real Estate Opportunities With the Right Partners',
  description:
    'VestBlock helps sellers, buyers, lenders, developers, contractors, operators, and capital partners connect around real estate opportunities, DealVault records, and funding-ready next steps.',
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
    title: 'Connect Real Estate Opportunities With the Right Partners | VestBlock',
    description:
      'A real estate partner network for sellers, buyers, lenders, developers, contractors, operators, and capital partners, with DealVault records and funding-ready next steps.',
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
    title: 'Connect Real Estate Opportunities With the Right Partners | VestBlock',
    description:
      'A real estate partner network for sellers, buyers, lenders, developers, contractors, operators, and capital partners.',
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
      <CapitalFlowSection />
      <IntelligenceSection />
      <NetworkSection />
      <DealVaultProofSection />
      <CinematicCta />
    </div>
  );
}
