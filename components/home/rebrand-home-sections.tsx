import Link from "next/link"
import { ArrowRight, Check, FileCheck2 } from "lucide-react"

import { PathwayLink } from "@/components/analytics/pathway-link"
import { analyticsEvents } from "@/lib/analytics/events"

const paths = [
  {
    number: "01",
    label: "Capital",
    title: "Find a funding path that fits.",
    body: "Start with business funding, investment-property financing, lender matching, or the readiness work that helps you qualify.",
    href: "/capital",
    action: "Find capital",
    event: analyticsEvents.capitalFlowStarted,
  },
  {
    number: "02",
    label: "Deals",
    title: "Find, analyze, or move a property.",
    body: "Explore opportunities, analyze a property, submit one for review, share a buy box, or carry an active deal into DealVault.",
    href: "/deals",
    action: "Find deals",
    event: analyticsEvents.dealFlowStarted,
  },
  {
    number: "03",
    label: "Opportunities",
    title: "Use the right resource at the right time.",
    body: "Explore grants, business credit, practical education, and selected business-building resources already inside VestBlock.",
    href: "/opportunities",
    action: "Explore opportunities",
    event: analyticsEvents.opportunityFlowStarted,
  },
] as const

const workflow = [
  { number: "01", title: "Choose the outcome", body: "Start with capital, a property decision, or a practical business opportunity." },
  { number: "02", title: "Share the essentials", body: "Answer the questions that matter for that request, without repeating the same intake across VestBlock." },
  { number: "03", title: "Get a clear next step", body: "Review an analysis, funding direction, matched criteria, useful resource, or active deal record." },
]

export function CorePathsSection() {
  return (
    <section id="paths" className="vb-section scroll-mt-24 border-b border-white/10">
      <div className="vb-container">
        <div className="grid gap-8 border-b border-white/10 pb-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
          <div>
            <p className="vb-eyebrow">Choose a direction</p>
            <h2 className="vb-section-title mt-4">Three doors. One platform.</h2>
          </div>
          <p className="max-w-2xl text-lg leading-8 text-[#aaa9a2] lg:justify-self-end">
            Start with the outcome you need. VestBlock will show what to provide, what can be reviewed, and what happens next.
          </p>
        </div>

        <div className="divide-y divide-white/10">
          {paths.map((path, index) => (
            <article key={path.label} className="group grid gap-6 py-9 sm:py-12 lg:grid-cols-[5rem_0.55fr_1fr_auto] lg:items-center lg:gap-10">
              <span className="font-mono text-xs tracking-[0.18em] text-[#878a80]">{path.number}</span>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#b7ff3c]">{path.label}</p>
              <div>
                <h3 className="max-w-xl text-2xl font-semibold tracking-[-0.025em] text-[#f3efe6] sm:text-3xl">{path.title}</h3>
                <p className="mt-3 max-w-2xl leading-7 text-[#aaa9a2]">{path.body}</p>
              </div>
              <PathwayLink
                href={path.href}
                analyticsEvent={path.event}
                placement={`home_path_${index + 1}`}
                className="vb-button vb-button-secondary justify-self-start lg:justify-self-end"
              >
                {path.action}
                <ArrowRight className="h-4 w-4" />
              </PathwayLink>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export function NetworkWorkflowSection() {
  return (
    <section className="vb-section border-b border-white/10">
      <div className="vb-container grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-24">
        <div>
          <p className="vb-eyebrow">How VestBlock works</p>
          <h2 className="vb-section-title mt-4 max-w-[12ch]">Less searching. A clearer next step.</h2>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[#aaa9a2]">
            Capital, property, partner, and business resources share one clear starting point, so you can move forward without searching across separate tools.
          </p>
          <Link href="/get-started" className="vb-text-link mt-8 inline-flex">
            Tell us where you’re going
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <ol className="border-t border-white/10">
          {workflow.map((step) => (
            <li key={step.number} className="grid gap-4 border-b border-white/10 py-7 sm:grid-cols-[4rem_1fr] sm:py-9">
              <span className="font-mono text-xs tracking-[0.18em] text-[#b7ff3c]">{step.number}</span>
              <div>
                <h3 className="text-xl font-semibold text-[#f3efe6]">{step.title}</h3>
                <p className="mt-2 max-w-xl leading-7 text-[#aaa9a2]">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function ProductProofSection() {
  const capabilities = [
    "Business and investment-property funding paths",
    "Property analysis and opportunity intelligence",
    "Buyer, lender, and partner criteria",
    "DealVault milestones, proof, and payout records",
  ]

  return (
    <section className="vb-section border-b border-white/10">
      <div className="vb-container grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-20">
        <div className="relative min-h-[28rem] overflow-hidden border border-white/10 bg-[#0d100d] p-6 sm:p-10">
          <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(183,255,60,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(183,255,60,0.06)_1px,transparent_1px)] [background-size:42px_42px]" />
          <div className="relative flex h-full min-h-[24rem] flex-col justify-between">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-[#8f9189]">Opportunity record</span>
              <span className="h-2 w-2 rounded-full bg-[#b7ff3c]" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["Analyze", "Know the numbers before you chase the deal."],
                ["Match", "Route by funding, market, asset, and partner fit."],
                ["Advance", "Keep the next action visible."],
                ["Record", "Track terms, milestones, proof, and payouts."],
              ].map(([title, body]) => (
                <div key={title} className="border-l border-[#b7ff3c]/50 bg-[#090a08]/80 p-5">
                  <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[#b7ff3c]">{title}</p>
                  <p className="mt-3 text-sm leading-6 text-[#c7c5bd]">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <p className="vb-eyebrow">One connected network</p>
          <h2 className="vb-section-title mt-4">Useful information stays with the opportunity.</h2>
          <p className="mt-6 text-lg leading-8 text-[#aaa9a2]">
            Move from a first review to the right capital, buyer, lender, partner, or DealVault record while keeping the important context visible.
          </p>
          <ul className="mt-8 space-y-4">
            {capabilities.map((item) => (
              <li key={item} className="flex gap-3 text-[#d7d3ca]">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-[#b7ff3c]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

export function DealVaultTrustSection() {
  return (
    <section className="vb-section border-b border-white/10">
      <div className="vb-container">
        <div className="grid gap-10 bg-[#b7ff3c] px-6 py-10 text-[#11130f] sm:px-10 sm:py-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:px-16">
          <div>
            <div className="flex items-center gap-3 font-mono text-xs font-semibold uppercase tracking-[0.2em]">
              <FileCheck2 className="h-4 w-4" />
              DealVault
            </div>
            <h2 className="mt-5 max-w-2xl text-4xl font-semibold leading-[0.98] tracking-[-0.045em] sm:text-6xl">
              Keep the deal clear after the introduction.
            </h2>
          </div>
          <div>
            <p className="max-w-xl text-lg leading-8 text-[#28301f]">
              Organize agreements, milestones, partner splits, and proof records without turning private documents into public claims.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/dealvault/demo" className="vb-button bg-[#11130f] text-[#f3efe6] hover:bg-black">
                See the demo
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/dealvault" className="vb-button border border-[#11130f]/30 text-[#11130f] hover:bg-[#11130f]/10">
                How DealVault works
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function HomeFinalCta() {
  return (
    <section className="vb-section">
      <div className="vb-container grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="vb-eyebrow">Your next move</p>
          <h2 className="vb-section-title mt-4 max-w-[14ch]">Start with the outcome, not the tool.</h2>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[#aaa9a2]">
            Choose capital, deals, or opportunities. VestBlock will take you to the right place from there.
          </p>
        </div>
        <a href="#paths" className="vb-button vb-button-primary justify-self-start lg:justify-self-end">
          Choose a path
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </section>
  )
}
