import type { Metadata } from 'next'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { SellPage } from '@/components/sell/sell-page'
import { absoluteUrl } from '@/lib/seo/site'
import { realEstatePartnerServiceJsonLd } from '@/lib/seo/structuredData'

const sellerMarkets = {
  milwaukee: {
    city: 'Milwaukee',
    state: 'WI',
    stateName: 'Wisconsin',
    title: 'Private Property Review in Milwaukee',
    description:
      'Milwaukee property owners can create a private, resumable case around condition, occupancy, timing, priorities, and voluntary price context for VestBlock review.',
  },
  toledo: {
    city: 'Toledo',
    state: 'OH',
    stateName: 'Ohio',
    title: 'Private Property Review in Toledo',
    description:
      'Toledo property owners can create a private, resumable case around condition, occupancy, timing, priorities, and voluntary price context for VestBlock review.',
  },
  memphis: {
    city: 'Memphis',
    state: 'TN',
    stateName: 'Tennessee',
    title: 'Private Property Review in Memphis',
    description:
      'Memphis property owners can create a private, resumable case around condition, occupancy, timing, priorities, and voluntary price context for VestBlock review.',
  },
  'west-michigan': {
    city: 'Grand Rapids',
    state: 'MI',
    stateName: 'Michigan',
    regionLabel: 'West Michigan',
    title: 'Private Property Review in West Michigan',
    description:
      'West Michigan property owners can create a private, resumable case around condition, occupancy, timing, priorities, and voluntary price context for VestBlock review.',
  },
  'west-mi': {
    city: 'Grand Rapids',
    state: 'MI',
    stateName: 'Michigan',
    regionLabel: 'West Michigan',
    title: 'Private Property Review in West Michigan',
    description:
      'West Michigan property owners can create a private, resumable case around condition, occupancy, timing, priorities, and voluntary price context for VestBlock review.',
  },
} as const

type MarketSlug = keyof typeof sellerMarkets

type PageProps = {
  params: Promise<{ market: string }>
}

function getMarket(slug: string) {
  return sellerMarkets[slug as MarketSlug] || null
}

function getMarketLabel(market: (typeof sellerMarkets)[MarketSlug]) {
  return 'regionLabel' in market ? market.regionLabel : market.city
}

export function generateStaticParams() {
  return Object.keys(sellerMarkets).map((market) => ({ market }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { market: slug } = await params
  const market = getMarket(slug)

  if (!market) {
    return {
      title: 'Property Review',
    }
  }

  const path = `/sell/${slug}`
  const marketLabel = getMarketLabel(market)

  return {
    title: market.title,
    description: market.description,
    keywords: [
      `sell my house ${market.city}`,
      `sell my house ${marketLabel}`,
      `sell house as-is ${market.city}`,
      `${market.city} property review`,
      `${market.city} investor property review`,
      `${market.city} private seller case`,
      `${market.city} property sale path review`,
      `${market.city} seller priorities review`,
      `sell property in ${market.city}`,
      'VestBlock seller intake',
      'private property review',
    ],
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: market.title,
      description: market.description,
      url: absoluteUrl(path),
      images: [
        {
          url: absoluteUrl('/opengraph-image'),
          width: 1200,
          height: 630,
          alt: `VestBlock ${marketLabel} property review`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: market.title,
      description: market.description,
      images: [absoluteUrl('/opengraph-image')],
    },
  }
}

export default async function MarketSellPage({ params }: PageProps) {
  const { market: slug } = await params
  const market = getMarket(slug)

  if (!market) notFound()

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(realEstatePartnerServiceJsonLd()),
        }}
      />
      <Suspense fallback={<div className="premium-page min-h-[60vh]" />}><SellPage market={market} /></Suspense>
    </>
  )
}
