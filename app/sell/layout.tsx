import type { Metadata } from "next"
import { absoluteUrl } from "@/lib/seo/site"

export const metadata: Metadata = {
  title: "Private Property Review and Seller Case",
  description:
    "Save a private seller case with property facts, condition, occupancy, timing, and priorities for accountable VestBlock review.",
  keywords:
    "property review, sell house options, investor property review, creative sale options, home sale planning",
  alternates: {
    canonical: "/sell",
  },
  openGraph: {
    title: "VestBlock Property Review",
    description:
      "Build one private property record around condition, timeline, occupancy, and seller priorities before the next conversation.",
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
      "Build one private property record around condition, timeline, occupancy, and seller priorities before the next conversation.",
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
