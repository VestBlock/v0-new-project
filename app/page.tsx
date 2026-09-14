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
  title: 'Capital, Real Estate, Business Growth + AI, and Personal Roadmaps | VestBlock',
  description:
    'Organize readiness and connect the next workflow across capital, real estate, business growth and AI, or a personal roadmap—with active work preserved in DealVault.',
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
    title: 'Capital, Real Estate, Business Growth + AI, and Personal Roadmaps | VestBlock',
    description:
      'Four clear outcomes, qualified workflow routing, and DealVault continuity organized around your next move.',
    url: absoluteUrl('/'),
    images: [
      {
        url: absoluteUrl('/opengraph-image'),
        width: 1200,
        height: 630,
        alt: 'VestBlock decision pathways for capital, real estate, business growth and AI, and personal roadmaps',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Capital, Real Estate, Business Growth + AI, and Personal Roadmaps | VestBlock',
    description:
      'Four clear outcomes, qualified workflow routing, and DealVault continuity organized around your next move.',
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
