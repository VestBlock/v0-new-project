"use client"

import Link from "next/link"
import { ArrowRight, Building2, Landmark, TrendingUp } from "lucide-react"

export type HomepageOutcomeId = "capital" | "deals" | "opportunity"

export const homepageOutcomes = [
  {
    id: "capital",
    hook: "funding",
    number: "01",
    eyebrow: "Capital",
    title: "Prepare for business funding",
    summary: "Use this path for business funding, grants, or business-credit preparation. Financing a specific property starts in Real Estate.",
    href: "/capital",
    action: "Explore funding",
    note: "VestBlock is not a lender. Independent providers set eligibility and terms.",
    links: [
      ["Business funding", "/capital?path=business-funding#capital-intake"],
      ["Grant preparation", "/next-move?focus=grants"],
    ],
    icon: Landmark,
  },
  {
    id: "deals",
    hook: "real-estate",
    number: "02",
    eyebrow: "Deals",
    title: "Buy, sell, or fund property",
    summary: "Start with your role, property details, criteria, and timeline, then continue into the right real-estate path.",
    href: "/real-estate",
    action: "Choose a real-estate path",
    note: "Licensed and independent parties control regulated services, offers, financing, and closings.",
    links: [
      ["I want to buy", "/buyers"],
      ["I want to sell", "/sell"],
      ["I need property funding", "/real-estate-funding"],
      ["I lend on property", "/lenders"],
    ],
    icon: Building2,
  },
  {
    id: "opportunity",
    hook: "opportunity",
    number: "03",
    eyebrow: "Opportunity",
    title: "Build from a stronger base",
    summary: "Get a practical starting plan for credit, income, business setup, visibility, or sustainable growth.",
    href: "/opportunity",
    action: "Build a growth plan",
    note: "Roadmaps are educational and do not guarantee credit, leads, revenue, rankings, or profitability.",
    links: [
      ["Free next-step plan", "/next-move"],
      ["Business setup", "/business-setup"],
      ["Growth services", "/services"],
    ],
    icon: TrendingUp,
  },
] as const

function rememberChoice(id: HomepageOutcomeId) {
  try {
    window.localStorage.setItem("vestblock:selected-homepage-goal", id)
    window.localStorage.setItem("vestblock:active-lane", id === "deals" ? "real-estate" : id)
  } catch {
    // Navigation still works when storage is unavailable.
  }
}

export function HomepageDirectory() {
  return (
    <section id="choose-your-path" className="vb3-paths" aria-labelledby="path-selector-title">
      <div className="vb3-shell">
        <div className="vb3-section-heading">
          <div>
            <p className="vb3-kicker vb3-kicker--dark"><span aria-hidden="true" /> Capital · Deals · Opportunity</p>
            <h2 id="path-selector-title">Choose where you want to start.</h2>
          </div>
          <p>Pick the goal closest to yours. You can explore every path before creating an account.</p>
        </div>

        <div className="vb3-paths__grid">
          {homepageOutcomes.map((goal) => {
            const Icon = goal.icon
            return (
              <article key={goal.id} className="vb3-path-card" data-home-path={goal.hook}>
                <header>
                  <span>{goal.number}</span>
                  <Icon aria-hidden="true" />
                </header>
                <p className="vb3-path-card__eyebrow">{goal.eyebrow}</p>
                <h3>{goal.title}</h3>
                <p className="vb3-path-card__summary">{goal.summary}</p>

                <p className="vb3-path-card__options-label">Common starting points</p>
                <div className="vb3-path-card__options" aria-label={`${goal.title} options`}>
                  {goal.links.map(([label, href]) => (
                    <Link key={href} href={href} onClick={() => rememberChoice(goal.id)}>{label}<ArrowRight aria-hidden="true" /></Link>
                  ))}
                </div>

                <p className="vb3-path-card__note">{goal.note}</p>
                <Link href={goal.href} onClick={() => rememberChoice(goal.id)} className="vb3-path-card__action">
                  {goal.action} <ArrowRight aria-hidden="true" />
                </Link>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
