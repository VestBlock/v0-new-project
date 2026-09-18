import type { Metadata } from 'next'
import { PropertyOpportunityAnalyzer } from '@/components/property/property-opportunity-analyzer'
import { absoluteUrl } from '@/lib/seo/site'
import { vestBlockOpenGraphDefaults, vestBlockTwitterDefaults } from '@/lib/seo/socialMetadata'

export const metadata: Metadata = {
  title: 'Real Estate Deal Calculators',
  description:
    'Use VestBlock real estate deal calculators for rough MAO, ARV, rent yield, cash-review range, buyer fit, lender review, creative structure, and novation screening.',
  alternates: {
    canonical: '/calculators',
  },
  openGraph: {
    ...vestBlockOpenGraphDefaults,
    title: 'Real Estate Deal Calculators | VestBlock',
    description:
      'MAO, ARV, rent yield, buyer-fit, creative, novation, and lender-review calculators for real estate opportunities.',
    url: absoluteUrl('/calculators'),
    images: [
      {
        url: absoluteUrl('/opengraph-image?v=3'),
        width: 1200,
        height: 630,
        alt: 'VestBlock real estate calculators',
      },
    ],
  },
  twitter: {
    ...vestBlockTwitterDefaults,
    title: 'Real Estate Deal Calculators | VestBlock',
    description:
      'Screen property opportunities with MAO, ARV, rent yield, buyer-fit, creative, and novation calculators.',
  },
}

export default function CalculatorsPage() {
  return (
    <main className="premium-page text-slate-100">
      <PropertyOpportunityAnalyzer calculatorOnly />
    </main>
  )
}
