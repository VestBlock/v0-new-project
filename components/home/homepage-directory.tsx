"use client"

import Link from "next/link"
import { ArrowRight, ChevronDown } from "lucide-react"
import { useState } from "react"

type Offering = { title: string; body: string; access: string; limitation: string; href: string }
type Path = { id: string; label: string; heading: string; body: string; action: string; actionHref: string; offerings: Offering[] }

const paths: Path[] = [
  {
    id: "capital-path", label: "Capital", heading: "Prepare for capital with a clearer file.",
    body: "Start with readiness. Organize the purpose, records, credit considerations, and deal details that matter before a lender or funding partner makes a decision.",
    action: "Check funding readiness", actionHref: "/funding#free-eligibility-check",
    offerings: [
      { title: "Business funding eligibility", body: "Receive a readiness summary and a suggested preparation step.", access: "Free", limitation: "No approval, rate, limit, or timing promise.", href: "/funding#free-eligibility-check" },
      { title: "Funding preparation", body: "Build a reviewed document and application-preparation plan.", access: "Paid · scope shown first", limitation: "Final underwriting and terms belong to the provider.", href: "/funding/business-funding-strategy" },
      { title: "Business setup", body: "Organize entity, banking, records, and use-of-funds basics.", access: "Free guidance", limitation: "Not legal, tax, or accounting advice.", href: "/business-setup" },
      { title: "Business credit roadmap", body: "Sequence vendor, monitoring, utilization, and application-readiness steps.", access: "Free account", limitation: "No score, tradeline, approval, or funding guarantee.", href: "/tools/business-credit" },
      { title: "Grant matching", body: "Search potential programs and organize application language.", access: "Member tool", limitation: "Verify eligibility, deadlines, and awards with each program.", href: "/tools/grants" },
      { title: "Real-estate funding review", body: "Prepare an active property scenario for lender or partner review.", access: "Review required", limitation: "Subject to underwriting and third-party terms.", href: "/real-estate-funding" },
    ],
  },
  {
    id: "deals-path", label: "Deals", heading: "Move an opportunity from interest to informed review.",
    body: "Bring property, business, buyer, lender, builder, and partner context into view before an introduction, funding review, or recorded next step.",
    action: "Submit a property for review", actionHref: "/sell",
    offerings: [
      { title: "Seller Property Review", body: "Submit property and seller context for a structured sale-path review.", access: "Free submission", limitation: "No offer, structure, or closing timeline is promised.", href: "/sell" },
      { title: "Buyer criteria", body: "Store a reusable acquisition profile for better-fit introductions.", access: "Partner-routed", limitation: "No deal volume, exclusivity, or match is promised.", href: "/buyers" },
      { title: "Property analysis", body: "Screen property facts and economics using a consistent structure.", access: "Free", limitation: "Not an appraisal, title opinion, or investment recommendation.", href: "/property-analyzer" },
      { title: "Active deal funding", body: "Prepare a deal-specific capital file for review.", access: "Review required", limitation: "Subject to underwriting and third-party terms.", href: "/real-estate-funding" },
      { title: "Builder and developer routing", body: "Create a structured project-fit brief for operator review.", access: "Free questionnaire · review required", limitation: "No project, contract, capital, or introduction is guaranteed.", href: "/next-move?focus=builder-developer" },
      { title: "Business acquisition path", body: "Organize acquisition criteria, capital preparation, and diligence questions.", access: "Free questionnaire · review required", limitation: "No valuation, financing, business, or closing outcome is promised.", href: "/next-move?focus=business-acquisition" },
    ],
  },
  {
    id: "opportunity-path", label: "Opportunity", heading: "Strengthen the position behind your next move.",
    body: "Improve the conditions around a future capital or deal decision through practical credit, income, business, and growth preparation.",
    action: "Build my free roadmap", actionHref: "/next-move",
    offerings: [
      { title: "Free Next-Move Roadmap", body: "Receive an immediate analysis and ordered 7/30/60/90-day starting plan.", access: "Free", limitation: "Educational routing, not a promise of a financial result.", href: "/next-move" },
      { title: "Credit review and roadmap", body: "Upload a report in your account, receive analysis status, and build foundational steps.", access: "Free account", limitation: "No deletion, score increase, approval, or timing is guaranteed.", href: "/credit-upload" },
      { title: "Income-path preparation", body: "Choose and test practical income ideas around time, skills, and starting capacity.", access: "Free roadmap", limitation: "No income, demand, or profitability guarantee.", href: "/next-move?focus=increase-income" },
      { title: "Business creation", body: "Organize entity, banking, document, and operating foundations.", access: "Free guidance", limitation: "Not legal, tax, or accounting advice.", href: "/business-setup" },
      { title: "AI receptionist", body: "Review lead capture, response, and booking support for a service business.", access: "Paid", limitation: "No appointment or revenue result is guaranteed.", href: "/ai-assistant" },
      { title: "Visibility expansion", body: "Review search, local, answer-engine, and trust opportunities.", access: "Paid", limitation: "No ranking, traffic, citation, or revenue result is guaranteed.", href: "/visibility-expansion" },
    ],
  },
]

export function HomepageDirectory() {
  const [expanded, setExpanded] = useState<string[]>([])

  const toggle = (id: string) => setExpanded((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])

  return (
    <>
      <section id="choose-your-path" className="vb-directory" aria-labelledby="directory-title">
        <div className="vb-section-shell">
          <div className="vb-section-intro vb-section-intro--split">
            <div><p className="vb-kicker">Choose what you need</p><h2 id="directory-title">Start with the outcome you want.</h2></div>
            <p>Choose a path below, or answer a few questions and let VestBlock organize the next steps around your goal, timeline, and current position.</p>
          </div>
          <div className="vb-directory__grid">
            {paths.map((path) => {
              const isExpanded = expanded.includes(path.id)
              return (
                <article key={path.id} className="vb-directory__column">
                  <p className="vb-kicker">{path.label}</p>
                  <h3>{path.heading}</h3>
                  <ul>{path.offerings.slice(0, 5).map((offer) => <li key={offer.title}>{offer.title}</li>)}</ul>
                  <button type="button" onClick={() => toggle(path.id)} aria-expanded={isExpanded} aria-controls={`${path.id}-details`}>
                    {isExpanded ? "Hide details" : `See every ${path.label} option`}<ChevronDown aria-hidden="true" />
                  </button>
                  <div id={`${path.id}-details`} hidden={!isExpanded} className="vb-directory__details">
                    {path.offerings.map((offer) => <Link key={offer.title} href={offer.href}><strong>{offer.title}</strong><span>{offer.body}</span><small>{offer.access} · {offer.limitation}</small></Link>)}
                  </div>
                </article>
              )
            })}
          </div>
          <Link href="/next-move" className="vb-directory__roadmap">Not sure where to begin? Build my free roadmap <ArrowRight aria-hidden="true" /></Link>
        </div>
      </section>

      <section className="vb-how" aria-labelledby="how-title">
        <div className="vb-section-shell">
          <div className="vb-section-intro"><p className="vb-kicker">How VestBlock works</p><h2 id="how-title">One goal. A clear sequence.</h2></div>
          <ol className="vb-how__steps">
            {[
              ["01", "Tell us the goal", "Start with what you want to fund, sell, acquire, build, or improve."],
              ["02", "See what is ready", "Get a plain-language view of the information, timing, and preparation that matter."],
              ["03", "Choose the right path", "Continue with a VestBlock tool, request a review, or consider an appropriate partner route."],
              ["04", "Keep active work connected", "Use DealVault when proof, milestones, agreements, or payout references need a durable record."],
            ].map(([number, title, body]) => <li key={number}><span>{number}</span><h3>{title}</h3><p>{body}</p></li>)}
          </ol>
        </div>
      </section>

      {paths.map((path) => <PathSection key={path.id} path={path} />)}
    </>
  )
}

function PathSection({ path }: { path: Path }) {
  return (
    <section id={path.id} className={`vb-offerings vb-offerings--${path.label.toLowerCase()}`} aria-labelledby={`${path.id}-title`}>
      <div className="vb-section-shell">
        <div className="vb-offerings__head"><div><p className="vb-kicker">{path.label}</p><h2 id={`${path.id}-title`}>{path.heading}</h2></div><p>{path.body}</p></div>
        <div className="vb-offerings__list">
          {path.offerings.map((offer, index) => (
            <Link key={offer.title} href={offer.href} className="vb-offerings__row">
              <span>0{index + 1}</span><div><h3>{offer.title}</h3><p>{offer.body}</p></div><div><strong>{offer.access}</strong><small>{offer.limitation}</small></div><ArrowRight aria-hidden="true" />
            </Link>
          ))}
        </div>
        <Link href={path.actionHref} className="vb-button vb-button--primary">{path.action}<ArrowRight aria-hidden="true" /></Link>
      </div>
    </section>
  )
}
