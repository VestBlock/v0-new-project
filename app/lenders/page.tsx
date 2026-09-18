import type { Metadata } from 'next'
import { LenderSignupPage } from '@/components/lenders/lender-signup-page'
import { FaqSection } from '@/components/marketing/faq-section'
import { absoluteUrl } from '@/lib/seo/site'
import {
  vestBlockOpenGraphDefaults,
  vestBlockTwitterDefaults,
} from '@/lib/seo/socialMetadata'
import {
  realEstatePartnerServiceJsonLd,
  faqPageJsonLd,
  breadcrumbJsonLd,
} from '@/lib/seo/structuredData'
import { lenderFaqs } from '@/lib/seo/faqContent'

export const metadata: Metadata = {
  title: 'Private Lender Network, Deal Review & AI Visibility',
  description:
    'Private lenders, hard money lenders, DSCR lenders, and bridge lenders share lending criteria so VestBlock can introduce matching real estate opportunities and better-fit borrower conversations.',
  keywords: [
    'private lender network',
    'hard money lender deal review',
    'DSCR lender matching',
    'bridge lender real estate deals',
    'lender criteria intake',
    'real estate deal review for lenders',
    'VestBlock lender network',
    'fix and flip lender',
    'real estate lending partner network',
  ],
  alternates: {
    canonical: '/lenders',
  },
  openGraph: {
    ...vestBlockOpenGraphDefaults,
    title: 'Private Lender Network, Deal Review & Funding Fit | VestBlock',
    description:
      'Share your lending criteria so VestBlock can introduce better-fit real estate opportunities and cleaner borrower review.',
    url: absoluteUrl('/lenders'),
    images: [
      {
        url: absoluteUrl('/opengraph-image?v=3'),
        width: 1200,
        height: 630,
        alt: 'VestBlock lender network and real estate deal review',
      },
    ],
  },
  twitter: {
    ...vestBlockTwitterDefaults,
    title: 'Private Lender Network, Deal Review & Funding Fit | VestBlock',
    description:
      'Share your lending box so VestBlock can introduce matching real estate deals and cleaner borrower review.',
  },
}

export default function LendersPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            realEstatePartnerServiceJsonLd(),
            faqPageJsonLd(lenderFaqs),
            breadcrumbJsonLd([
              { name: 'VestBlock', path: '/' },
              { name: 'Lender Network', path: '/lenders' },
            ]),
          ]),
        }}
      />
      <LenderSignupPage />
      <div className="premium-page">
        <FaqSection items={lenderFaqs} title="Lender network FAQ" />
      </div>
    </>
  )
}
