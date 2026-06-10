import type { Metadata } from 'next'
import { PropertyOpportunityAnalyzer } from '@/components/property/property-opportunity-analyzer'
import { absoluteUrl } from '@/lib/seo/site'

export const metadata: Metadata = {
  title: 'Free Property Opportunity Analyzer',
  description:
    'Analyze a real estate property for rough value, MAO, cash-review range, buyer interest, creative path fit, novation fit, rent signals, and lender review.',
  alternates: {
    canonical: '/property-analyzer',
  },
  openGraph: {
    title: 'Free Property Opportunity Analyzer | VestBlock',
    description:
      'Screen a property before routing it to VestBlock buyers, lenders, operators, or acquisition review.',
    url: absoluteUrl('/property-analyzer'),
    images: [
      {
        url: absoluteUrl('/opengraph-image'),
        width: 1200,
        height: 630,
        alt: 'VestBlock property opportunity analyzer',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free Property Opportunity Analyzer | VestBlock',
    description:
      'Rough value, MAO, buyer interest, creative, novation, and lender-fit screening for real estate opportunities.',
    images: [absoluteUrl('/opengraph-image')],
  },
}

export default function PropertyAnalyzerPage() {
  return (
    <main className="premium-page text-slate-100">
      <PropertyOpportunityAnalyzer />
    </main>
  )
}
