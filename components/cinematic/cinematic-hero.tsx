"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Check } from "lucide-react"

const operatorBeats = [
  {
    number: "01",
    label: "Direction",
    title: "Set the mandate—not a menu of products.",
    body: "Define the outcome, criteria, constraints, and decision rights. VestBlock keeps funding, property, and business work organized around that mandate.",
  },
  {
    number: "02",
    label: "Readiness",
    title: "Qualify the opportunity before effort is wasted.",
    body: "VestBlock identifies missing evidence, orders the work by importance, and makes the next decision visible before outreach or submission begins.",
  },
  {
    number: "03",
    label: "Execution",
    title: "Advance the work to an accountable outcome.",
    body: "For property acquisition, that means sourcing, underwriting, compliant owner contact, qualification, offer decisions, negotiation, and a signed-contract handoff.",
  },
] as const

function DecisionConsole({ activeBeat }: { activeBeat: number }) {
  return (
    <figure className="vb-decision-console" data-beat={activeBeat} aria-label="Illustrative Private Ledger acquisition workflow">
      <header className="vb-decision-console__bar">
        <span><i /> Private Ledger · acquisition workflow</span>
        <strong>{operatorBeats[activeBeat].label}</strong>
      </header>

      <div className="vb-decision-console__canvas">
        <div className="vb-decision-console__rail">
          {["Source", "Analyze", "Offer", "Contract"].map((label, index) => (
            <span key={label} data-active={(activeBeat === 0 ? index === 0 : activeBeat === 1 ? index <= 1 : true) || undefined}>
              <i>{index + 1}</i>{label}
            </span>
          ))}
        </div>

        <section className="vb-decision-console__panel vb-decision-console__goal">
          <div className="vb-decision-console__panel-head"><span>Input 01</span><b>Goal confirmed</b></div>
          <p>Selected outcome</p>
          <h3>Acquire an off-market property</h3>
          <dl>
            <div><dt>Criteria</dt><dd>2–8 units · Milwaukee area</dd></div>
            <div><dt>Range</dt><dd>$150K–$450K · value-add</dd></div>
          </dl>
        </section>

        <section className="vb-decision-console__panel vb-decision-console__evidence">
          <div className="vb-decision-console__panel-head"><span>Review 02</span><b>2 actions ready</b></div>
          <h3>Acquisition readiness</h3>
          <ul>
            <li data-state="ready"><span>Buy box</span><b>Ready</b></li>
            <li data-state="ready"><span>Target markets</span><b>Ready</b></li>
            <li data-state="gap"><span>Proof of capacity</span><b>Review</b></li>
            <li data-state="gap"><span>Offer guardrails</span><b>Set</b></li>
          </ul>
          <p className="vb-decision-console__boundary">Owners and participants control every offer, contract, and closing decision.</p>
        </section>

        <section className="vb-decision-console__panel vb-decision-console__route">
          <div className="vb-decision-console__panel-head"><span>Action 03</span><b>Owner sequence</b></div>
          <p>Controlled acquisition route</p>
          <h3>Seller contact to offer decision</h3>
          <div><span>Next action</span><strong>Work qualified owner replies within the offer guardrails</strong></div>
          <small>Source · underwrite · contact · qualify · offer</small>
        </section>

        <section className="vb-decision-console__panel vb-decision-console__record">
          <div className="vb-decision-console__panel-head"><span>Record 04</span><b>Controlled access</b></div>
          <h3>DealVault contract record</h3>
          <ul>
            <li><Check /> Owner response</li>
            <li><Check /> Offer history</li>
            <li><Check /> Agreement status</li>
          </ul>
        </section>

        <div className="vb-decision-console__route-line"><span /><i /></div>
      </div>
      <figcaption className="sr-only">An illustrative workflow showing a property moving from source and analysis through owner contact, offer, negotiation, and contract record.</figcaption>
    </figure>
  )
}

export function CinematicHero() {
  const [activeBeat, setActiveBeat] = useState(0)

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-operator-beat]"))
    let frame = 0

    const updateBeat = () => {
      frame = 0
      if (window.scrollY < 96) {
        setActiveBeat(0)
        return
      }

      // Align the narrative change with the readable area below the sticky
      // ledger, rather than the viewport center hidden behind that surface.
      const targetY = window.innerHeight * (window.innerWidth <= 1100 ? 0.72 : 0.81)
      const nearest = elements.reduce(
        (best, element) => {
          const rect = element.getBoundingClientRect()
          const distance = Math.abs(rect.top + rect.height / 2 - targetY)
          return distance < best.distance ? { element, distance } : best
        },
        { element: elements[0], distance: Number.POSITIVE_INFINITY },
      )

      if (nearest.element) setActiveBeat(Number(nearest.element.dataset.operatorBeat || 0))
    }

    const requestUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateBeat)
    }

    updateBeat()
    window.addEventListener("scroll", requestUpdate, { passive: true })
    window.addEventListener("resize", requestUpdate)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener("scroll", requestUpdate)
      window.removeEventListener("resize", requestUpdate)
    }
  }, [])

  return (
    <section className="vb-operator-hero" aria-labelledby="homepage-hero-title">
      <div className="vb-home-shell vb-operator-hero__grid">
        <div className="vb-operator-hero__lead" data-operator-beat="0">
          <p className="vb-home-kicker">VestBlock · Private Ledger operating system</p>
          <h1 id="homepage-hero-title">Capital, property, and business growth—one connected platform.</h1>
          <p className="vb-operator-hero__lede">
            Clarify the move, prepare the evidence, and carry the work forward—from funding readiness and business
            growth to active property sourcing, owner outreach, offers, and contract coordination.
          </p>
          <div className="vb-operator-hero__mandate">
            <span>Current acquisition mandate</span>
            <strong>Move qualified owner-direct opportunities from first contact to signed contract.</strong>
            <small>Source → underwrite → contact → qualify → offer → negotiate → under contract</small>
          </div>
          <div className="vb-operator-hero__actions">
            <Link href="/buyers" className="vb-home-button vb-home-button--primary">
              Start my acquisition criteria <ArrowRight aria-hidden="true" />
            </Link>
            <Link href="/sell" className="vb-home-button vb-home-button--secondary">
              Submit a property
            </Link>
          </div>
          <p className="vb-operator-hero__assurance"><Check aria-hidden="true" /> Free criteria and property submissions · Review required.</p>
          <Link href="/next-move" className="vb-operator-hero__acquisition">
            <span>Not starting with a property?</span>
            Build a free roadmap for funding, financial readiness, or business growth
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>

        <div className="vb-operator-hero__stage">
          <DecisionConsole activeBeat={activeBeat} />
        </div>

        <div className="vb-operator-hero__steps" aria-label="How VestBlock turns a goal into a connected path">
          {operatorBeats.slice(1).map((beat, index) => (
            <article
              key={beat.number}
              id={index === 0 ? "operator-criteria" : undefined}
              data-operator-beat={index + 1}
              data-active={activeBeat === index + 1 || undefined}
            >
              <div><span>{beat.number}</span><small>{beat.label}</small></div>
              <h2>{beat.title}</h2>
              <p>{beat.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
