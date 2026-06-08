import type { Metadata } from 'next'
import { RealEstateFundingPage } from '@/components/real-estate-funding/real-estate-funding-page'
import { FaqSection } from '@/components/marketing/faq-section'
import { absoluteUrl } from '@/lib/seo/site'
import {
  realEstatePartnerServiceJsonLd,
  faqPageJsonLd,
  breadcrumbJsonLd,
} from '@/lib/seo/structuredData'
import { realEstateFundingFaqs } from '@/lib/seo/faqContent'

export const metadata: Metadata = {
  title: 'Real Estate Funding Review — DSCR, Fix & Flip, Bridge, Ground Up',
  description:
    'Share your DSCR, fix-and-flip, bridge, hard-money, or ground-up construction deal so VestBlock can organize the context and route qualified files toward No Limit Capital or another better-fit lender for review. VestBlock does not lend or guarantee terms.',
  keywords: [
    'real estate funding review',
    'DSCR loan deal review',
    'fix and flip funding',
    'bridge loan real estate',
    'ground up construction loan review',
    'No Limit Capital partner',
    'real estate investor capital partner',
    'hard money deal review',
    'investor real estate financing',
    'VestBlock funding review',
  ],
  alternates: {
    canonical: '/real-estate-funding',
  },
  openGraph: {
    title: 'Real Estate Funding Review — DSCR, Fix & Flip, Bridge, Ground Up',
    description:
      'Share your investor real estate deal so VestBlock can organize the context and route qualified files toward No Limit Capital or another better-fit lender for review.',
    url: absoluteUrl('/real-estate-funding'),
    images: [
      {
        url: absoluteUrl('/opengraph-image'),
        width: 1200,
        height: 630,
        alt: 'VestBlock real estate funding review',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Real Estate Funding Review — DSCR, Fix & Flip, Bridge, Ground Up',
    description:
      'Share your investor real estate deal so VestBlock can organize the context and route qualified files toward No Limit Capital or another better-fit lender for review.',
    images: [absoluteUrl('/opengraph-image')],
  },
}

export default function RealEstateFundingRoute() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            realEstatePartnerServiceJsonLd(),
            faqPageJsonLd(realEstateFundingFaqs),
            breadcrumbJsonLd([
              { name: 'VestBlock', path: '/' },
              { name: 'Real Estate Funding', path: '/real-estate-funding' },
            ]),
          ]),
        }}
      />
      <RealEstateFundingPage />
      <div className="premium-page">
        <FaqSection items={realEstateFundingFaqs} title="Funding review FAQ" />
      </div>
    </>
  )
}
