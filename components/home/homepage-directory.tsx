"use client"

import Link from "next/link"
import { ArrowRight, Building2, Landmark, ShieldCheck, TrendingUp } from "lucide-react"

export type HomepageOutcomeId = "capital" | "deals" | "opportunity"

export const homepageOutcomes = [
  {
    id: "capital",
    label: "Prepare for funding",
    title: "Build a funding request that is ready for a real review",
    href: "/capital",
    action: "Start the funding path",
    access: "Free to explore · Provider review may be required",
    summary: "Clarify the amount, purpose, timing, and supporting information behind a business or real-estate request before it reaches an independent provider.",
    prepare: "Use of funds, requested amount, timing, business or property context, and supporting records.",
    boundary: "VestBlock is not a lender and does not guarantee approval. Independent providers set eligibility, pricing, limits, and terms.",
    shortcuts: [
      ["Fund a business", "/capital?path=business-funding#capital-intake"],
      ["Fund a property", "/real-estate-funding"],
    ],
    icon: Landmark,
  },
  {
    id: "deals",
    label: "Find, buy, or sell property",
    title: "Move a property from criteria to a signed agreement",
    href: "/real-estate",
    action: "Open the real-estate path",
    access: "Free profiles and submissions · Routing requires review",
    summary: "Sellers can submit a property. Buyers define their criteria. VestBlock uses approved sources, underwriting, and compliant owner outreach to qualify possible matches, support offer decisions, preserve negotiation history, and coordinate the path to a signed agreement.",
    prepare: "Market, role, asset type, price range, timing, property details, capacity, and clear no-go criteria.",
    boundary: "VestBlock is not a broker or guarantor. Licensed and independent parties control regulated services, offers, underwriting, and closings.",
    shortcuts: [
      ["Find a property", "/buyers"],
      ["Sell a property", "/sell"],
      ["Fund a deal", "/real-estate-funding"],
      ["Join as a lender", "/lenders"],
    ],
    icon: Building2,
  },
  {
    id: "opportunity",
    label: "Build or grow a business",
    title: "Turn a business goal into an ordered growth plan",
    href: "/opportunity",
    action: "Start the business-growth path",
    access: "Free starting plan · Some tools require an account · Paid services are identified upfront",
    summary: "Build a personal or business starting plan, improve financial readiness, set up a business, or explore practical growth and AI support.",
    prepare: "Your goal, current position, available time, main obstacle, and—when relevant—your business offer and operating needs.",
    boundary: "Roadmaps are educational, and growth support does not guarantee credit, rankings, leads, revenue, or profitability.",
    shortcuts: [
      ["Free next-step plan", "/next-move"],
      ["Set up a business", "/business-setup"],
      ["Growth and AI support", "/services"],
    ],
    icon: TrendingUp,
  },
] as const

type HomepageDirectoryProps = {
  selectedId: HomepageOutcomeId
  onSelect: (id: HomepageOutcomeId) => void
}

export function HomepageDirectory({ selectedId, onSelect }: HomepageDirectoryProps) {
  const selected = homepageOutcomes.find((goal) => goal.id === selectedId) || homepageOutcomes[0]

  const rememberChoice = () => {
    try {
      window.localStorage.setItem("vestblock:selected-homepage-goal", selected.id)
      window.localStorage.setItem(
        "vestblock:active-lane",
        selected.id === "deals" ? "real-estate" : selected.id,
      )
    } catch {
      // The route still works when storage is unavailable.
    }
  }

  return (
    <section id="choose-your-path" className="vb-home-paths" aria-labelledby="path-selector-title">
      <div className="vb-home-shell">
        <div className="vb-home-heading vb-home-heading--split">
          <div>
            <p className="vb-home-kicker">One platform · three clear outcomes</p>
            <h2 id="path-selector-title">What are you working toward?</h2>
          </div>
          <p>Choose the closest goal. VestBlock shows what to prepare, what deserves attention first, and the next action that can move the work forward.</p>
        </div>

        <div className="vb-home-paths__workspace">
          <div className="vb-home-paths__choices" aria-label="Choose your outcome">
            {homepageOutcomes.map((goal, index) => {
              const Icon = goal.icon
              const active = selected.id === goal.id
              return (
                <button
                  key={goal.id}
                  type="button"
                  aria-pressed={active}
                  aria-controls="selected-path"
                  data-active={active || undefined}
                  onClick={() => onSelect(goal.id)}
                >
                  <span>0{index + 1}</span>
                  <Icon aria-hidden="true" />
                  <strong>{goal.label}</strong>
                  <ArrowRight aria-hidden="true" />
                </button>
              )
            })}
          </div>

          <article id="selected-path" className="vb-home-paths__preview" aria-live="polite" aria-atomic="true">
            <header><span>Selected outcome</span><strong>{selected.label}</strong></header>
            <h3>{selected.title}</h3>
            <p className="vb-home-paths__summary">{selected.summary}</p>
            <div className="vb-home-paths__shortcuts" aria-label={`${selected.label} options`}>
              {selected.shortcuts.map(([label, href]) => <Link key={href} href={href} onClick={rememberChoice}>{label}<ArrowRight aria-hidden="true" /></Link>)}
            </div>
            <dl>
              <div><dt>What to prepare</dt><dd>{selected.prepare}</dd></div>
              <div><dt>What to know</dt><dd>{selected.boundary}</dd></div>
            </dl>
            <p className="vb-home-paths__access"><ShieldCheck aria-hidden="true" /> {selected.access}</p>
            <div className="vb-home-paths__actions">
              <Link href={selected.href} onClick={rememberChoice} className="vb-home-button vb-home-button--ink">
                {selected.action} <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}
