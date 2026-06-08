import type { Metadata } from 'next';
import { BuyerSignupPage } from '@/components/buyers/buyer-signup-page';
import { FaqSection } from '@/components/marketing/faq-section';
import { absoluteUrl } from '@/lib/seo/site';
import {
  realEstatePartnerServiceJsonLd,
  faqPageJsonLd,
  breadcrumbJsonLd,
} from '@/lib/seo/structuredData';
import { buyerFaqs } from '@/lib/seo/faqContent';

export const metadata: Metadata = {
  title: 'Real Estate Buyer Network, Buy Box Criteria & Funding Access',
  description:
    'Real estate buyers share markets, asset types, price range, and criteria so VestBlock can introduce better-fit seller opportunities and organize No Limit Capital funding review when needed.',
  keywords: [
    'real estate buyer network',
    'cash buyer buy box',
    'fix and flip buyer criteria',
    'fix and flip funding partner',
    'No Limit Capital funding review',
    'DSCR funding for buyers',
    'bridge loan for real estate investors',
    'multifamily buyer signup',
    'real estate acquisition criteria',
    'buy box intake form',
    'VestBlock buyer network',
    'real estate buyer opportunities',
    'buyer partnership network',
  ],
  alternates: {
    canonical: '/buyers',
  },
  openGraph: {
    title: 'Real Estate Buyer Network, Buy Box Criteria & Funding Access',
    description:
      'Submit your buyer criteria so VestBlock can introduce better-fit seller opportunities and organize funding review when needed.',
    url: absoluteUrl('/buyers'),
    images: [
      {
        url: absoluteUrl('/opengraph-image'),
        width: 1200,
        height: 630,
        alt: 'VestBlock buyer network — share your buy box',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Real Estate Buyer Network, Buy Box Criteria & Funding Access',
    description:
      'Share your buy box criteria so VestBlock can introduce matching seller opportunities and organize funding review when needed.',
    images: [absoluteUrl('/opengraph-image')],
  },
};

export default function BuyersPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            realEstatePartnerServiceJsonLd(),
            faqPageJsonLd(buyerFaqs),
            breadcrumbJsonLd([
              { name: 'VestBlock', path: '/' },
              { name: 'Buyer Network', path: '/buyers' },
            ]),
          ]),
        }}
      />
      <BuyerSignupPage />
      <div className="premium-page">
        <FaqSection items={buyerFaqs} title="Buyer network FAQ" />
      </div>
    </>
  );
}
