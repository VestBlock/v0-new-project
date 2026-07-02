import type { Metadata } from 'next';
import { LenisProvider } from '@/components/cinematic/lenis-provider';
import { CinematicHero } from '@/components/cinematic/cinematic-hero';
import { DealflowOperatingSection } from '@/components/home/dealflow-operating-section';
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
  title: 'VestBlock | Real Estate Deal Flow Operating System',
  description:
    'VestBlock helps property owners, buyers, lenders, builders, and investors analyze opportunities, route deals, create buyer packets, and move faster with cleaner deal records.',
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
    title: 'VestBlock | Real Estate Deal Flow Operating System',
    description:
      'Analyze properties, route opportunities to the right buyers and capital partners, and keep deal records organized with VestBlock.',
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
    title: 'VestBlock | Real Estate Deal Flow Operating System',
    description:
      'A real estate deal-flow operating system for property analysis, buyer matching, funding paths, and deal records.',
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
      <DealflowOperatingSection />
      <DealVaultProofSection />
      <CinematicCta />
    </div>
  );
}
