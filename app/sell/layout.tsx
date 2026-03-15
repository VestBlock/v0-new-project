import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sell Your House Fast - Cash Offer in 24 Hours | VestBlock",
  description: "Get a cash offer for your house in 24 hours. No repairs, no agents, no fees. Flexible closing options available.",
  keywords: "sell my house fast, cash home buyers, we buy houses, sell house as-is",
  openGraph: {
    title: "Sell Your House Fast - Cash Offer in 24 Hours | VestBlock",
    description: "Get a cash offer for your house in 24 hours. No repairs, no agents, no fees. Flexible closing options available.",
    type: "website",
    url: "https://vestblock.io/sell",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sell Your House Fast - Cash Offer in 24 Hours | VestBlock",
    description: "Get a cash offer for your house in 24 hours. No repairs, no agents, no fees. Flexible closing options available.",
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function SellLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
