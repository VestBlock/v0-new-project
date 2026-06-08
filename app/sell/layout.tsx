import type { Metadata } from "next"
import { absoluteUrl } from "@/lib/seo/site"

export const metadata: Metadata = {
  title: "Property Review And Sale Path Evaluation",
  description:
    "Submit your property details so VestBlock can review the situation and recommend the right next sale conversation, including investor review, creative structures, or prep-first support.",
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
    url: absoluteUrl("/sell"),
    images: [
      {
        url: absoluteUrl("/opengraph-image"),
        width: 1200,
        height: 630,
        alt: "VestBlock property review preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "VestBlock Property Review",
    description:
      "Request a property review so VestBlock can evaluate the best next sale path based on condition, timeline, liens, occupancy, and buyer fit.",
    images: [absoluteUrl("/opengraph-image")],
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
