import type { Metadata } from "next"

import { HeroSection } from "@/components/hero-section"
import {
  CorePathsSection,
  DealVaultTrustSection,
  HomeFinalCta,
  NetworkWorkflowSection,
  ProductProofSection,
} from "@/components/home/rebrand-home-sections"
import { absoluteUrl } from "@/lib/seo/site"
import {
  homepageFaqJsonLd,
  organizationJsonLd,
  realEstatePartnerServiceJsonLd,
  websiteJsonLd,
} from "@/lib/seo/structuredData"

export const metadata: Metadata = {
  title: "Find Capital, Deals, and Opportunities",
  description:
    "VestBlock brings business funding, investment-property financing, real-estate deals, property analysis, DealVault, and practical business opportunities into one network.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Find Your Next Move | VestBlock",
    description: "Capital, deals, and opportunities brought together in one network.",
    url: absoluteUrl("/"),
    images: [{ url: absoluteUrl("/opengraph-image"), width: 1200, height: 630, alt: "VestBlock — find your next move" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Find Your Next Move | VestBlock",
    description: "Capital, deals, and opportunities brought together in one network.",
    images: [absoluteUrl("/opengraph-image")],
  },
}

export default function HomePage() {
  return (
    <div className="vb-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            organizationJsonLd(),
            websiteJsonLd(),
            homepageFaqJsonLd(),
            realEstatePartnerServiceJsonLd(),
          ]),
        }}
      />
      <HeroSection />
      <CorePathsSection />
      <NetworkWorkflowSection />
      <ProductProofSection />
      <DealVaultTrustSection />
      <HomeFinalCta />
    </div>
  )
}
