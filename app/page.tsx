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
  title: 'Find Your Next Move Across Capital, Deals, and Opportunity',
  description:
    'VestBlock helps people prepare for capital, evaluate real estate deals, and build or grow opportunities—with a clear next-step plan and DealVault support for active work.',
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
    title: 'Find Your Next Move Across Capital, Deals, and Opportunity | VestBlock',
    description:
      'Prepare for capital, evaluate deals, and build or grow opportunities from one coordinated starting point.',
    url: absoluteUrl('/'),
    images: [
      {
        url: absoluteUrl('/opengraph-image'),
        width: 1200,
        height: 630,
        alt: 'VestBlock pathways for capital, deals, opportunity, and DealVault',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Find Your Next Move Across Capital, Deals, and Opportunity | VestBlock',
    description:
      'Prepare for capital, evaluate deals, and build or grow opportunities from one coordinated starting point.',
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
      <CinematicHero />
      <HomepageDecisionFlow />
      <DealVaultProofSection />
      <CinematicCta />
    </div>
  );
}
