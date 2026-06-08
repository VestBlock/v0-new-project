import type { Metadata } from 'next'
import { SellPage } from '@/components/sell/sell-page'
import { FaqSection } from '@/components/marketing/faq-section'
import { absoluteUrl } from '@/lib/seo/site'
import {
  realEstatePartnerServiceJsonLd,
  faqPageJsonLd,
  breadcrumbJsonLd,
} from '@/lib/seo/structuredData'
import { sellFaqs } from '@/lib/seo/faqContent'

export const metadata: Metadata = {
  title: 'Submit a Property for Fast Cash, Creative, or Novation Review',
  description:
    'Submit your property online for review. VestBlock routes condition, timeline, payoff, and seller context to acquisitions review for fast cash, creative structure, novation, or partner-fit sale paths.',
  keywords: [
    'sell my house fast',
    'novation real estate review',
    'creative finance property review',
    'property review request',
    'cash buyer intake form',
    'sell property to investor',
    'motivated seller intake',
    'real estate property review seller',
    'submit property for review',
    'VestBlock seller intake',
    'sell house as-is',
    'fast cash creative novation review',
  ],
  alternates: {
    canonical: '/sell',
  },
  openGraph: {
    title: 'Submit a Property for Fast Cash, Creative, or Novation Review',
    description:
      'Submit property details for review. VestBlock routes the submission to acquisitions review for fast cash, creative structure, novation, or another partner-fit sale path.',
    url: absoluteUrl('/sell'),
    images: [
      {
        url: absoluteUrl('/opengraph-image'),
        width: 1200,
        height: 630,
        alt: 'VestBlock — Submit your property for deal network review',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Submit a Property for Fast Cash, Creative, or Novation Review',
    description:
      'Submit property details for review. VestBlock routes fast cash, creative, novation, and partner-fit review based on your situation.',
    images: [absoluteUrl('/opengraph-image')],
  },
}

export default function SellPageRoute() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            realEstatePartnerServiceJsonLd(),
            faqPageJsonLd(sellFaqs),
            breadcrumbJsonLd([
              { name: 'VestBlock', path: '/' },
              { name: 'Sell My Property', path: '/sell' },
            ]),
          ]),
        }}
      />
      <SellPage />
      <div className="premium-page">
        <FaqSection items={sellFaqs} title="Selling FAQ" />
      </div>
    </>
  )
}
