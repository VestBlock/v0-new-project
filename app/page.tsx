import type { Metadata } from 'next';
import { CinematicHero } from '@/components/cinematic/cinematic-hero';
import { HomepageDecisionFlow } from '@/components/home/homepage-decision-flow';
import { DealVaultProofSection } from '@/components/home/dealvault-proof-section';
import { CinematicCta } from '@/components/cinematic/cinematic-cta';
import { absoluteUrl } from '@/lib/seo/site';
import {
  organizationJsonLd,
  websiteJsonLd,
  homepageFaqJsonLd,
} from '@/lib/seo/structuredData';

export const metadata: Metadata = {
  title: 'Capital, Property & Business Growth in One Platform',
  description:
    'VestBlock connects funding readiness, business growth, and active property acquisition—from sourcing and owner outreach through offer, negotiation, and signed-contract coordination.',
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
    title: 'Capital, Property & Business Growth | VestBlock',
    description:
      'One connected platform for funding readiness, business growth, and active property acquisition from criteria to signed contract.',
    url: absoluteUrl('/'),
    images: [
      {
        url: absoluteUrl('/opengraph-image'),
        width: 1200,
        height: 630,
        alt: 'VestBlock Private Ledger for capital, property acquisition, business growth, and DealVault records',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Capital, Property & Business Growth | VestBlock',
    description:
      'One connected platform for funding readiness, business growth, and active property acquisition from criteria to signed contract.',
    images: [absoluteUrl('/opengraph-image')],
  },
};

export default function HomePage() {
  return (
    <div className="premium-page vb-private-ledger">
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
      <CinematicHero />
      <HomepageDecisionFlow />
      <DealVaultProofSection />
      <CinematicCta />
    </div>
  );
}
