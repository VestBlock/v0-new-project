import type { Metadata } from "next"

import { PathwayPage } from "@/components/pathway-page"
import { analyticsEvents } from "@/lib/analytics/events"

export const metadata: Metadata = {
  title: "Find and Analyze Deals",
  description: "Explore property opportunities, analyze a deal, submit a property, share a buy box, or move an active deal into DealVault.",
  alternates: { canonical: "/deals" },
}

export default function DealsPage() {
  return (
    <PathwayPage
      eyebrow="Find deals"
      title="Enter the deal from the right side."
      body="Source, analyze, sell, buy, or document an opportunity through the VestBlock workflow built for your role."
      event={analyticsEvents.dealFlowStarted}
      primary={{
        eyebrow: "Deal discovery",
        title: "Explore property opportunities.",
        body: "Review the current opportunity workspace and narrow the search before spending time on the wrong property.",
        href: "/deal-hunter",
        action: "Explore deals",
      }}
      options={[
        {
          eyebrow: "Analysis",
          title: "Analyze the deal before you chase it.",
          body: "Use the existing property analyzer to organize the inputs, math, risk, and next questions.",
          href: "/property-analyzer",
          action: "Analyze a property",
        },
        {
          eyebrow: "Sellers",
          title: "Submit a property for review.",
          body: "Share the property, timing, and situation so VestBlock can route the opportunity clearly.",
          href: "/sell",
          action: "Submit a property",
        },
        {
          eyebrow: "Buyers",
          title: "Share the buy box that matters.",
          body: "Tell VestBlock the markets, assets, price range, and criteria that define a useful opportunity.",
          href: "/buyers",
          action: "Share a buy box",
        },
        {
          eyebrow: "Active deals",
          title: "Keep milestones and proof organized.",
          body: "Use DealVault when an opportunity needs clearer agreements, partner splits, records, and follow-through.",
          href: "/dealvault",
          action: "Open DealVault",
        },
      ]}
      note={<p>Property information and estimates require independent verification and professional due diligence.</p>}
    />
  )
}
