import type { Metadata } from "next"

import { PathwayPage } from "@/components/pathway-page"
import { analyticsEvents } from "@/lib/analytics/events"

export const metadata: Metadata = {
  title: "Explore Opportunities",
  description: "Explore curated VestBlock grants, business-credit tools, practical learning, and business-building resources.",
  alternates: { canonical: "/opportunities" },
}

export default function OpportunitiesPage() {
  return (
    <PathwayPage
      eyebrow="Explore opportunities"
      title="Useful options beyond the obvious path."
      body="VestBlock keeps grants, business-credit tools, education, and selected business-building resources in one curated lane—not a wall of unrelated tools."
      event={analyticsEvents.opportunityFlowStarted}
      outcome="A shorter list of resources tied to a real business need."
      whatYouProvide={[
        "The goal you are working toward",
        "Basic eligibility, timing, and location details when relevant",
        "The kind of help or information you need next",
      ]}
      whatHappensNext={[
        "VestBlock narrows the options to the stated need.",
        "You review eligibility, limitations, and the original source.",
        "You choose whether to apply, learn, prepare, or request support.",
      ]}
      proofPoints={[
        "Original program terms take priority",
        "Availability and eligibility can change",
        "No grant, credit, or business outcome is guaranteed",
      ]}
      primary={{
        eyebrow: "Grants",
        title: "Look for programs worth reviewing.",
        body: "Use the grants workflow to identify relevant programs and prepare a clearer review. Eligibility and awards are never guaranteed.",
        href: "/tools/grants",
        action: "Explore grants",
      }}
      options={[
        {
          eyebrow: "Business credit",
          title: "Understand the business-credit profile.",
          body: "Review the factors and next steps that can support future funding readiness.",
          href: "/tools/business-credit",
          action: "Open business credit",
        },
        {
          eyebrow: "Learning",
          title: "Get specific before taking action.",
          body: "Browse practical guides across funding, real-estate analysis, credit, and business decisions.",
          href: "/learn",
          action: "Browse learning",
        },
        {
          eyebrow: "Resources",
          title: "Find a resource for the current problem.",
          body: "Use the resource library and selected services when they fit a concrete business need.",
          href: "/resources",
          action: "Browse resources",
        },
      ]}
      note={<p>Program availability, qualification, and third-party outcomes change. Verify terms directly before relying on an opportunity.</p>}
    />
  )
}
