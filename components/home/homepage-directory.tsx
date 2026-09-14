"use client"

import Link from "next/link"
import { ArrowRight, Bot, Building2, Landmark, ShieldCheck, TrendingUp } from "lucide-react"

export type HomepageOutcomeId = "capital" | "real-estate" | "business-growth" | "personal-roadmap"

export const homepageOutcomes = [
  {
    id: "capital",
    label: "Capital",
    title: "Prepare a business or real estate funding request",
    href: "/capital",
    action: "Review capital pathways",
    access: "Free to explore · Provider review may be required",
    summary: "Organize the purpose, amount, timing, and evidence behind a request before it reaches an independent provider.",
    prepare: "Use of funds, requested amount, timing, business or property context, and supporting records.",
    boundary: "VestBlock is not a lender and does not guarantee approval. Independent providers set eligibility, pricing, limits, and terms.",
    shortcuts: [
      ["Business funding", "/capital?path=business-funding#capital-intake"],
      ["Real estate funding", "/real-estate-funding"],
    ],
    icon: Landmark,
  },
  {
    id: "real-estate",
    label: "Real Estate",
    title: "Move through a buyer, seller, lender, or partner path",
    href: "/real-estate",
    action: "Choose a real estate role",
    access: "Free profiles and submissions · Routing requires review",
    summary: "Start with your role and criteria so a relevant property, participant, or intake workflow can be connected.",
    prepare: "Market, role, asset type, price range, timing, property details, capacity, and clear no-go criteria.",
    boundary: "VestBlock is not a broker or guarantor. Licensed and independent parties control regulated services, offers, underwriting, and closings.",
    shortcuts: [
      ["Buyer profile", "/buyers"],
      ["Sell a property", "/sell"],
      ["Lender profile", "/lenders"],
    ],
    icon: Building2,
  },
  {
    id: "business-growth",
    label: "Business Growth + AI",
    title: "Improve discovery, lead response, or operations",
    href: "/services",
    action: "Explore growth workflows",
    access: "Free reviews · Paid implementation is identified before purchase",
    summary: "Define the operating constraint, organize the current process, and connect the next practical growth or automation review.",
    prepare: "Primary offer, lead sources, response process, service area, operating capacity, and the result to improve.",
    boundary: "Growth and AI support do not guarantee rankings, leads, appointments, revenue, or profitability.",
    shortcuts: [
      ["AI receptionist", "/ai-assistant"],
      ["Search visibility", "/visibility-expansion"],
    ],
    icon: Bot,
  },
  {
    id: "personal-roadmap",
    label: "Personal Roadmap",
    title: "Build a starting plan for financial readiness",
    href: "/next-move",
    action: "Build my starting plan",
    access: "Free to view · No account or SSN required",
    summary: "Turn your goal, current position, time, and main obstacle into an ordered educational roadmap.",
    prepare: "Your goal, timeline, current position, available time, and main obstacle. The questionnaire does not request an SSN.",
    boundary: "The roadmap is educational. Creditors, issuers, programs, employers, and partners make their own decisions.",
    shortcuts: [
      ["Free questionnaire", "/next-move"],
      ["Credit review", "/credit-upload"],
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
      window.localStorage.setItem("vestblock:active-lane", selected.id)
    } catch {
      // The route still works when storage is unavailable.
    }
  }

  return (
    <section id="choose-your-path" className="vb-home-paths" aria-labelledby="path-selector-title">
      <div className="vb-home-shell">
        <div className="vb-home-heading vb-home-heading--split">
          <div>
            <p className="vb-home-kicker">Four outcomes · one starting point</p>
            <h2 id="path-selector-title">What are you working toward?</h2>
          </div>
          <p>Choose the closest outcome. VestBlock will show the information to organize, the next workflow, and where an independent decision applies.</p>
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

          <article id="selected-path" className="vb-home-paths__preview">
            <header><span>Selected outcome</span><strong>{selected.label}</strong></header>
            <h3>{selected.title}</h3>
            <p className="vb-home-paths__summary">{selected.summary}</p>
            <div className="vb-home-paths__shortcuts" aria-label={`${selected.label} options`}>
              {selected.shortcuts.map(([label, href]) => <Link key={href} href={href} onClick={rememberChoice}>{label}<ArrowRight aria-hidden="true" /></Link>)}
            </div>
            <dl>
              <div><dt>Organize</dt><dd>{selected.prepare}</dd></div>
              <div><dt>Decision boundary</dt><dd>{selected.boundary}</dd></div>
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
