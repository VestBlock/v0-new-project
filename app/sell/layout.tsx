import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Property Review And Sale Path Evaluation | VestBlock",
  description:
    "Submit your property details so VestBlock can review the situation and route the right next sale conversation, including investor review, creative structures, or prep-first support.",
  keywords:
    "property review, sell house options, investor property review, creative sale options, home sale planning",
  alternates: {
    canonical: "/sell",
  },
  openGraph: {
    title: "VestBlock Property Review",
    description:
      "Request a property review so VestBlock can evaluate the best next sale path based on condition, timeline, liens, occupancy, and buyer fit.",
    type: "website",
    url: "https://www.vestblock.io/sell",
  },
  twitter: {
    card: "summary_large_image",
    title: "VestBlock Property Review",
    description:
      "Request a property review so VestBlock can evaluate the best next sale path based on condition, timeline, liens, occupancy, and buyer fit.",
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
