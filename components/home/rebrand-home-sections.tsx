import Link from "next/link"
import { ArrowRight, Check, FileCheck2, LockKeyhole, Sparkles } from "lucide-react"

import { PathwayLink } from "@/components/analytics/pathway-link"
import { analyticsEvents } from "@/lib/analytics/events"

const paths = [
  {
    number: "01",
    label: "Capital",
    title: "Build the file behind the ask.",
    body: "Clarify the request, pressure-test the scenario, and find the capital path that fits the move in front of you.",
    href: "/capital",
    action: "Open capital",
    event: analyticsEvents.capitalFlowStarted,
    signal: "Readiness / fit / route",
  },
  {
    number: "02",
    label: "Deals",
    title: "See the property clearly.",
    body: "Bring discovery, analysis, buyer criteria, and the active record into one place before the next conversation.",
    href: "/deals",
    action: "Open deals",
    event: analyticsEvents.dealFlowStarted,
    signal: "Discover / underwrite / move",
  },
  {
    number: "03",
    label: "Opportunity",
    title: "Turn the right resource into motion.",
    body: "Find grants, education, business tools, and practical support without losing the context that made them relevant.",
    href: "/opportunities",
    action: "Open opportunity",
    event: analyticsEvents.opportunityFlowStarted,
    signal: "Research / decide / advance",
  },
] as const

const workflow = [
  { number: "01", title: "Name the decision", body: "Start with capital, a property, or an opportunity. The system keeps the first step human and specific." },
  { number: "02", title: "Bring the useful facts", body: "Share only what changes the decision. VestBlock keeps the evidence, assumptions, and next action together." },
  { number: "03", title: "Move with a record", body: "Review the route, match the right people, and keep milestones, proof, and outcomes attached to the work." },
]

export function CorePathsSection() {
  return (
    <section id="paths" className="vb-section vb-paths-section scroll-mt-24 border-b border-white/10">
      <div className="vb-container">
        <div className="vb-section-intro grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
          <div>
            <p className="vb-eyebrow">The operating network</p>
            <h2 className="vb-section-title mt-4">One place to make the next decision.</h2>
          </div>
          <p className="max-w-2xl text-lg leading-8 text-[#aaa9a2] lg:justify-self-end">
            VestBlock connects the work around a move, so the answer is not another tab. It is a clearer route forward.
          </p>
        </div>

        <div className="vb-path-rail mt-16">
          {paths.map((path, index) => (
            <article key={path.label} className="vb-path-card group">
              <div className="vb-path-card-top">
                <span className="vb-path-number">{path.number}</span>
                <span className="vb-path-signal">{path.signal}</span>
              </div>
              <div className="vb-path-card-art" aria-hidden="true">
                <span className="vb-path-card-glow" />
                <span className="vb-path-card-line vb-path-card-line-a" />
                <span className="vb-path-card-line vb-path-card-line-b" />
                <span className="vb-path-card-node" />
                <span className="vb-path-card-index">0{index + 1}</span>
              </div>
              <p className="vb-path-label">{path.label}</p>
              <h3>{path.title}</h3>
              <p className="vb-path-body">{path.body}</p>
              <PathwayLink href={path.href} analyticsEvent={path.event} placement={`home_path_${index + 1}`} className="vb-path-action">
                {path.action}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
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
    <section className="vb-section vb-workflow-section border-b border-white/10">
      <div className="vb-container grid gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24">
        <div>
          <p className="vb-eyebrow">A calmer way to move</p>
          <h2 className="vb-section-title mt-4 max-w-[10ch]">Clarity has a sequence.</h2>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[#aaa9a2]">
            The platform is designed around the decision, not the software. Each stage makes the next conversation easier to have.
          </p>
          <Link href="/get-started" className="vb-text-link mt-8 inline-flex">
            Tell us where you are going
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <ol className="vb-workflow-list">
          {workflow.map((step) => (
            <li key={step.number} className="vb-workflow-step">
              <span className="vb-workflow-index">{step.number}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
              <span className="vb-workflow-dot" aria-hidden="true" />
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
    <section className="vb-section vb-proof-section border-b border-white/10">
      <div className="vb-container grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-20">
        <div className="vb-proof-console" aria-label="VestBlock connected decision record">
          <div className="vb-proof-console-top">
            <div className="flex items-center gap-3"><span className="vb-proof-pulse" /><span>Decision record / live context</span></div>
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-[#70756a]">VB-042</span>
          </div>
          <div className="vb-proof-console-core">
            <div className="vb-proof-console-orbit" aria-hidden="true"><span /><span /><span /></div>
            <div className="vb-proof-console-center"><Sparkles className="h-5 w-5 text-[#b7ff3c]" /><span>Next move</span><strong>Visible</strong></div>
            <div className="vb-proof-console-callout vb-proof-console-callout-a"><span>Source</span><strong>Verified facts</strong></div>
            <div className="vb-proof-console-callout vb-proof-console-callout-b"><span>Route</span><strong>Capital fit</strong></div>
            <div className="vb-proof-console-callout vb-proof-console-callout-c"><span>Record</span><strong>DealVault</strong></div>
          </div>
          <div className="vb-proof-console-bottom"><span><LockKeyhole className="h-3.5 w-3.5" /> Private by design</span><span>Context retained / action clear</span></div>
        </div>

        <div>
          <p className="vb-eyebrow">One connected network</p>
          <h2 className="vb-section-title mt-4">Useful information stays with the opportunity.</h2>
          <p className="mt-6 text-lg leading-8 text-[#aaa9a2]">
            Move from a first review to the right capital, buyer, lender, partner, or DealVault record while keeping the important context visible.
          </p>
          <ul className="mt-8 space-y-4">
            {capabilities.map((item) => (
              <li key={item} className="flex gap-3 text-[#d7d3ca]"><Check className="mt-0.5 h-5 w-5 shrink-0 text-[#b7ff3c]" /><span>{item}</span></li>
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
        <div className="vb-dealvault-banner grid gap-10 px-6 py-10 sm:px-10 sm:py-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:px-16">
          <div>
            <div className="flex items-center gap-3 font-mono text-xs font-semibold uppercase tracking-[0.2em]"><FileCheck2 className="h-4 w-4" /> DealVault</div>
            <h2 className="mt-5 max-w-2xl text-4xl font-semibold leading-[0.98] tracking-[-0.045em] sm:text-6xl">Keep the deal clear after the introduction.</h2>
          </div>
          <div>
            <p className="max-w-xl text-lg leading-8 text-[#28301f]">Organize agreements, milestones, partner splits, and proof records without turning private documents into public claims.</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row"><Link href="/dealvault/demo" className="vb-button bg-[#11130f] text-[#f3efe6] hover:bg-black">See the demo<ArrowRight className="h-4 w-4" /></Link><Link href="/dealvault" className="vb-button border border-[#11130f]/30 text-[#11130f] hover:bg-[#11130f]/10">How DealVault works</Link></div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function HomeFinalCta() {
  return (
    <section className="vb-section vb-final-cta">
      <div className="vb-container grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div><p className="vb-eyebrow">The first move is yours</p><h2 className="vb-section-title mt-4 max-w-[12ch]">Start with the outcome.</h2><p className="mt-5 max-w-2xl text-lg leading-8 text-[#aaa9a2]">Choose capital, deals, or opportunity. VestBlock will take you to the right place from there.</p></div>
        <a href="#paths" className="vb-button vb-button-primary justify-self-start lg:justify-self-end">Choose a path<ArrowRight className="h-4 w-4" /></a>
      </div>
    </section>
  )
}
