"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Check } from "lucide-react"

const operatorBeats = [
  {
    number: "01",
    label: "Goal",
    title: "Tell us what you want to move forward.",
    body: "Start with Capital, Deals, or Opportunity. VestBlock uses your goal, timing, and current position to shape a useful starting plan.",
  },
  {
    number: "02",
    label: "Readiness",
    title: "See where you stand.",
    body: "Get a plain-language view of what is ready, what is missing, and what deserves attention first.",
  },
  {
    number: "03",
    label: "Next step",
    title: "Act on an ordered plan.",
    body: "Receive clear next actions and, when appropriate, submit information for review or continue into the relevant VestBlock path.",
  },
] as const

function DecisionConsole({ activeBeat }: { activeBeat: number }) {
  return (
    <div className="vb-decision-console" data-beat={activeBeat} aria-hidden="true">
      <header className="vb-decision-console__bar">
        <span><i /> Example next-step plan</span>
        <strong>{operatorBeats[activeBeat].label}</strong>
      </header>

      <div className="vb-decision-console__canvas">
        <div className="vb-decision-console__rail">
          {["Goal", "Readiness", "Options", "Action plan"].map((label, index) => (
            <span key={label} data-active={(activeBeat === 0 ? index === 0 : activeBeat === 1 ? index <= 1 : true) || undefined}>
              <i>{index + 1}</i>{label}
            </span>
          ))}
        </div>

        <section className="vb-decision-console__panel vb-decision-console__goal">
          <div className="vb-decision-console__panel-head"><span>Input 01</span><b>Goal confirmed</b></div>
          <p>Selected outcome</p>
          <h3>Prepare for business capital</h3>
          <dl>
            <div><dt>Objective</dt><dd>Prepare a request that can be reviewed</dd></div>
            <div><dt>Timing</dt><dd>Within 30 days</dd></div>
          </dl>
        </section>

        <section className="vb-decision-console__panel vb-decision-console__evidence">
          <div className="vb-decision-console__panel-head"><span>Review 02</span><b>2 items to address</b></div>
          <h3>Funding readiness</h3>
          <ul>
            <li data-state="ready"><span>Use of funds</span><b>Ready</b></li>
            <li data-state="ready"><span>Requested amount</span><b>Ready</b></li>
            <li data-state="gap"><span>Recent statements</span><b>Missing</b></li>
            <li data-state="gap"><span>Repayment picture</span><b>Review</b></li>
          </ul>
          <p className="vb-decision-console__boundary">A provider makes the final eligibility and terms decision.</p>
        </section>

        <section className="vb-decision-console__panel vb-decision-console__route">
          <div className="vb-decision-console__panel-head"><span>Option 03</span><b>Starting path</b></div>
          <p>Recommended place to begin</p>
          <h3>Business funding readiness review</h3>
          <div><span>First action</span><strong>Gather the two missing records</strong></div>
          <small>Preparation first · provider review later</small>
        </section>

        <section className="vb-decision-console__panel vb-decision-console__record">
          <div className="vb-decision-console__panel-head"><span>Plan 04</span><b>Saved next steps</b></div>
          <h3>30-day starting plan</h3>
          <ul>
            <li><Check /> Goal</li>
            <li><Check /> Readiness gaps</li>
            <li><Check /> Ordered actions</li>
          </ul>
        </section>

        <div className="vb-decision-console__route-line"><span /><i /></div>
      </div>
    </div>
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
          <p className="vb-home-kicker">Capital · Deals · Opportunity</p>
          <h1 id="homepage-hero-title">Find your next move.</h1>
          <p className="vb-operator-hero__lede">
            VestBlock helps you prepare for capital, evaluate real estate deals, and build or grow opportunities—then
            turns your starting point into a clear, practical plan.
          </p>
          <div className="vb-operator-hero__actions">
            <Link href="/next-move" className="vb-home-button vb-home-button--primary">
              Get my free next-step plan <ArrowRight aria-hidden="true" />
            </Link>
            <Link href="#choose-your-path" className="vb-home-button vb-home-button--secondary">
              Explore the three paths
            </Link>
          </div>
          <p className="vb-operator-hero__assurance"><Check aria-hidden="true" /> About 3 minutes · No SSN required.</p>
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
