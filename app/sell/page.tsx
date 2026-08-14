import type { Metadata } from 'next'
import { Suspense } from 'react'
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
  title: 'Private Property Review and Seller Case',
  description:
    'Create a private seller case around property condition, occupancy, timing, priorities, and voluntary price context. Save progress and submit for accountable VestBlock review.',
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
    title: 'Private Property Review and Seller Case',
    description:
      'Organize property facts and seller priorities in one private, resumable case before a next-step conversation.',
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
    title: 'Private Property Review and Seller Case',
    description:
      'Organize property facts and seller priorities in one private, resumable case before a next-step conversation.',
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
      <Suspense fallback={<div className="premium-page min-h-[60vh]" />}><SellPage /></Suspense>
      <div className="premium-page">
        <FaqSection items={sellFaqs} title="Selling FAQ" />
      </div>
    </>
  )
}
