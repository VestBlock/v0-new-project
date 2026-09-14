"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Check } from "lucide-react"

const operatorBeats = [
  {
    number: "01",
    label: "Goal",
    title: "Start with the outcome and the timing.",
    body: "Choose the result you want across Capital, Real Estate, Business Growth + AI, or a Personal Roadmap. VestBlock captures the objective before it suggests a path.",
  },
  {
    number: "02",
    label: "Criteria + gaps",
    title: "Organize criteria. Surface gaps.",
    body: "VestBlock structures the facts, surfaces missing preparation, and keeps independent decision criteria clear.",
  },
  {
    number: "03",
    label: "Route + record",
    title: "Connect the route. Keep the record.",
    body: "Qualified requests enter the right workflow. DealVault keeps the active record connected.",
  },
] as const

function DecisionConsole({ activeBeat }: { activeBeat: number }) {
  return (
    <div className="vb-decision-console" data-beat={activeBeat} aria-hidden="true">
      <header className="vb-decision-console__bar">
        <span><i /> VestBlock decision interface</span>
        <strong>{operatorBeats[activeBeat].label}</strong>
      </header>

      <div className="vb-decision-console__canvas">
        <div className="vb-decision-console__rail">
          {["Goal", "Criteria / gaps", "Route", "Connected record"].map((label, index) => (
            <span key={label} data-active={(activeBeat === 0 ? index === 0 : activeBeat === 1 ? index <= 1 : true) || undefined}>
              <i>{index + 1}</i>{label}
            </span>
          ))}
        </div>

        <section className="vb-decision-console__panel vb-decision-console__goal">
          <div className="vb-decision-console__panel-head"><span>Input 01</span><b>Goal confirmed</b></div>
          <p>Selected outcome</p>
          <h3>Business Growth + AI</h3>
          <dl>
            <div><dt>Objective</dt><dd>Respond to every qualified inquiry</dd></div>
            <div><dt>Timing</dt><dd>Within 30 days</dd></div>
          </dl>
        </section>

        <section className="vb-decision-console__panel vb-decision-console__evidence">
          <div className="vb-decision-console__panel-head"><span>Review 02</span><b>2 gaps surfaced</b></div>
          <h3>Readiness evidence</h3>
          <ul>
            <li data-state="ready"><span>Offer + service area</span><b>Recorded</b></li>
            <li data-state="ready"><span>Current inquiry volume</span><b>Recorded</b></li>
            <li data-state="gap"><span>After-hours response path</span><b>Missing</b></li>
            <li data-state="gap"><span>Qualified-call handoff rule</span><b>Define</b></li>
          </ul>
          <p className="vb-decision-console__boundary">Boundary: implementation fit still requires review.</p>
        </section>

        <section className="vb-decision-console__panel vb-decision-console__route">
          <div className="vb-decision-console__panel-head"><span>Route 03</span><b>Path matched</b></div>
          <p>Recommended next workflow</p>
          <h3>AI receptionist assessment</h3>
          <div><span>First action</span><strong>Define intake and handoff rules</strong></div>
          <small>Qualified request · review required</small>
        </section>

        <section className="vb-decision-console__panel vb-decision-console__record">
          <div className="vb-decision-console__panel-head"><span>Record 04</span><b>DealVault layer</b></div>
          <h3>VB–GROW–018</h3>
          <ul>
            <li><Check /> Goal + criteria</li>
            <li><Check /> Readiness review</li>
            <li><Check /> Next action</li>
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
          <p className="vb-home-kicker">Capital · Real Estate · Business Growth + AI · Personal Roadmap</p>
          <h1 id="homepage-hero-title">Turn a goal into a clear next move.</h1>
          <p className="vb-operator-hero__lede">
            VestBlock organizes readiness, routes qualified requests into the right workflow, connects the next action,
            and preserves active work in DealVault&apos;s record layer.
          </p>
          <div className="vb-operator-hero__actions">
            <Link href="/next-move" className="vb-home-button vb-home-button--primary">
              Start the free questionnaire <ArrowRight aria-hidden="true" />
            </Link>
            <Link href="#choose-your-path" className="vb-home-button vb-home-button--secondary">
              Choose an outcome
            </Link>
          </div>
          <p className="vb-operator-hero__assurance"><Check aria-hidden="true" /> No SSN required to receive a starting plan.</p>
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
