import type { Metadata } from 'next';
import { CinematicHero } from '@/components/cinematic/cinematic-hero';
import { HomepageDecisionFlow } from '@/components/home/homepage-decision-flow';
import { DealVaultProofSection } from '@/components/home/dealvault-proof-section';
import { CinematicCta } from '@/components/cinematic/cinematic-cta';
import { absoluteUrl } from '@/lib/seo/site';
import {
  organizationJsonLd,
  websiteJsonLd,
} from '@/lib/seo/structuredData';

export const metadata: Metadata = {
  title: 'Find Your Next Move',
  description:
    'Turn a capital, real-estate, or business goal into a focused roadmap. VestBlock shows you what to prepare and where to go next.',
  keywords: [
    'capital readiness',
    'deal pathways',
    'property opportunities',
    'business growth planning',
    'DealVault records',
    'next-move roadmap',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Find Your Next Move | VestBlock',
    description:
      'Capital preparation, real-estate deals, and practical business growth in one coordinated place.',
    url: absoluteUrl('/'),
    images: [
      {
        url: absoluteUrl('/opengraph-image?v=3'),
        width: 1200,
        height: 630,
        alt: 'VestBlock — find your next move across funding, real estate, and business growth',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Find Your Next Move | VestBlock',
    description:
      'Capital preparation, real-estate deals, and practical business growth in one coordinated place.',
    images: [
      {
        url: absoluteUrl('/twitter-image?v=3'),
        width: 1200,
        height: 630,
        alt: 'VestBlock — find your next move across funding, real estate, and business growth',
      },
    ],
  },
};

export default function HomePage() {
  return (
    <div className="premium-page vb-home-v3">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            organizationJsonLd(),
            websiteJsonLd(),
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
