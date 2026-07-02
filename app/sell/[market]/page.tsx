import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SellPage } from '@/components/sell/sell-page'
import { absoluteUrl } from '@/lib/seo/site'
import { realEstatePartnerServiceJsonLd } from '@/lib/seo/structuredData'

const sellerMarkets = {
  milwaukee: {
    city: 'Milwaukee',
    state: 'WI',
    stateName: 'Wisconsin',
    title: 'Sell a Property in Milwaukee - Fast Cash, Creative, or Novation Review',
    description:
      'Milwaukee property owners can submit address, condition, timeline, occupancy, and payoff context for fast cash buyer, creative structure, novation, or partner review.',
  },
  toledo: {
    city: 'Toledo',
    state: 'OH',
    stateName: 'Ohio',
    title: 'Sell a Property in Toledo - Fast Cash, Creative, or Novation Review',
    description:
      'Toledo property owners can submit address, condition, timeline, occupancy, and payoff context for fast cash buyer, creative structure, novation, or partner review.',
  },
  memphis: {
    city: 'Memphis',
    state: 'TN',
    stateName: 'Tennessee',
    title: 'Sell a Property in Memphis - Fast Cash, Creative, or Novation Review',
    description:
      'Memphis property owners can submit address, condition, timeline, occupancy, and payoff context for fast cash buyer, creative structure, novation, or partner review.',
  },
  'west-michigan': {
    city: 'Grand Rapids',
    state: 'MI',
    stateName: 'Michigan',
    regionLabel: 'West Michigan',
    title: 'Sell a Property in West Michigan - Cash, Creative, or Partner Review',
    description:
      'West Michigan property owners can submit address, condition, timeline, occupancy, and payoff context for a practical cash buyer, creative structure, novation, or partner sale review.',
  },
  'west-mi': {
    city: 'Grand Rapids',
    state: 'MI',
    stateName: 'Michigan',
    regionLabel: 'West Michigan',
    title: 'Sell a Property in West Michigan - Cash, Creative, or Partner Review',
    description:
      'West Michigan property owners can submit address, condition, timeline, occupancy, and payoff context for a practical cash buyer, creative structure, novation, or partner sale review.',
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
      `${market.city} cash buyer review`,
      `${market.city} creative finance review`,
      `${market.city} novation review`,
      `sell property in ${market.city}`,
      'VestBlock seller intake',
      'fast cash creative novation review',
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
      <SellPage market={market} />
    </>
  )
}
