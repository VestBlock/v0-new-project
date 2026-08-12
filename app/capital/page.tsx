import type { Metadata } from "next"

import { PathwayPage } from "@/components/pathway-page"
import { analyticsEvents } from "@/lib/analytics/events"

export const metadata: Metadata = {
  title: "Find Capital",
  description: "Start the right VestBlock capital path for business funding, investment-property financing, lender matching, or funding readiness.",
  alternates: { canonical: "/capital" },
}

export default function CapitalPage() {
  return (
    <PathwayPage
      eyebrow="Find capital"
      title="Capital for the move in front of you."
      body="Start with the kind of capital you need. VestBlock helps organize the request, check the fit, and identify a responsible next step."
      event={analyticsEvents.capitalFlowStarted}
      outcome="A funding direction you can evaluate before applying."
      whatYouProvide={[
        "The business or property purpose and amount requested",
        "Timing, revenue or property details, and current readiness",
        "The constraints that could affect lender fit",
      ]}
      whatHappensNext={[
        "VestBlock organizes the request and highlights missing information.",
        "Relevant funding or readiness paths are compared without promising approval.",
        "You choose whether to continue, prepare the file, or speak with a partner.",
      ]}
      proofPoints={[
        "Clear inputs before an introduction",
        "Lender criteria stay attached to the review",
        "No promise of approval, rate, or proceeds",
      ]}
      primary={{
        eyebrow: "Business capital",
        title: "Check business funding paths.",
        body: "Review eligibility and move into a funding strategy based on the business profile you share.",
        href: "/funding",
        action: "Check eligibility",
      }}
      options={[
        {
          eyebrow: "Real-estate capital",
          title: "Finance an investment property.",
          body: "Start a DSCR or investment-property funding conversation with the property and financing details that matter.",
          href: "/real-estate-funding",
          action: "Explore property funding",
        },
        {
          eyebrow: "Funding readiness",
          title: "Strengthen the profile behind the request.",
          body: "Use business-credit and related readiness tools when they materially improve a future funding application.",
          href: "/tools/business-credit",
          action: "Review business credit",
        },
        {
          eyebrow: "Capital partners",
          title: "Join the lender network.",
          body: "Share lending criteria so suitable opportunities can be routed toward the right capital box.",
          href: "/lenders",
          action: "Share lending criteria",
        },
      ]}
      note={<p>Funding is subject to third-party underwriting and approval. VestBlock does not promise approval, rates, or proceeds.</p>}
    />
  )
}
