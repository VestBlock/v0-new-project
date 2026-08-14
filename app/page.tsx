import type { Metadata } from 'next';
import { LenisProvider } from '@/components/cinematic/lenis-provider';
import { CinematicHero } from '@/components/cinematic/cinematic-hero';
import { HomepageDirectory } from '@/components/home/homepage-directory';
import { DealVaultProofSection } from '@/components/home/dealvault-proof-section';
import { TrustSection } from '@/components/home/trust-section';
import { CinematicCta } from '@/components/cinematic/cinematic-cta';
import {
  absoluteUrl,
  vestBlockDefaultDescription,
  vestBlockDefaultTitle,
} from '@/lib/seo/site';
import {
  homepageFaqJsonLd,
} from '@/lib/seo/structuredData';

export const metadata: Metadata = {
  title: { absolute: vestBlockDefaultTitle },
  description: vestBlockDefaultDescription,
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
    title: vestBlockDefaultTitle,
    description: vestBlockDefaultDescription,
    url: absoluteUrl('/'),
    images: [
      {
        url: absoluteUrl('/opengraph-image'),
        width: 1200,
        height: 630,
        alt: 'VestBlock AI-guided next-move platform for Capital, Real Estate, Opportunity, and DealVault',
        type: 'image/png',
      },
      {
        url: absoluteUrl('/vestblock-mark-platform-ai-3d.png'),
        width: 1254,
        height: 1254,
        alt: 'VestBlock compact AI platform mark',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: vestBlockDefaultTitle,
    description: vestBlockDefaultDescription,
    images: [
      {
        url: absoluteUrl('/opengraph-image'),
        alt: 'VestBlock AI-guided next-move platform',
      },
    ],
  },
};

export default function HomePage() {
  return (
    <div className="premium-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(homepageFaqJsonLd()),
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
