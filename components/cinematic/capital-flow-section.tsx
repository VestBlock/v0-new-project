"use client"

import { useEffect, useRef, useState } from "react"

const chapters = [
  {
    number: "01",
    label: "Property intelligence",
    title: "Put the asset and its constraints in view.",
    body: "The record begins with the property, its intended use, timing, condition, and source materials. Every later discussion works from the same operating context.",
    note: "A shared factual record before outreach.",
  },
  {
    number: "02",
    label: "Capital diligence",
    title: "Frame the underwriting question.",
    body: "Capture the capital request, required terms, decision criteria, and remaining diligence. Each conversation can begin at the actual question instead of a generic lead handoff.",
    note: "A defined ask with the evidence to review it.",
  },
  {
    number: "03",
    label: "Qualified execution",
    title: "Move a responsible next step.",
    body: "Route the package to the counterparty who can assess it, then preserve the decision, source material, and next action in the private DealVault record.",
    note: "An introduction with purpose, ownership, and continuity.",
  },
]

export function CapitalFlowSection() {
  const chapterRefs = useRef<Array<HTMLLIElement | null>>([])
  const [activeChapter, setActiveChapter] = useState(0)

  useEffect(() => {
    let frame: number | null = null

    const updateChapter = () => {
      frame = null
      const viewportCenter = window.innerHeight / 2
      let nearestChapter = 0
      let nearestDistance = Number.POSITIVE_INFINITY

      chapterRefs.current.forEach((chapter, index) => {
        if (!chapter) return
        const rect = chapter.getBoundingClientRect()
        const distance = Math.abs(rect.top + rect.height / 2 - viewportCenter)
        if (distance < nearestDistance) {
          nearestDistance = distance
          nearestChapter = index
        }
      })

      setActiveChapter((currentChapter) => (currentChapter === nearestChapter ? currentChapter : nearestChapter))
    }

    const scheduleUpdate = () => {
      if (frame === null) frame = window.requestAnimationFrame(updateChapter)
    }

    window.addEventListener("scroll", scheduleUpdate, { passive: true })
    window.addEventListener("vestblock:scroll-state", scheduleUpdate)
    window.addEventListener("resize", scheduleUpdate)
    scheduleUpdate()

    return () => {
      window.removeEventListener("scroll", scheduleUpdate)
      window.removeEventListener("vestblock:scroll-state", scheduleUpdate)
      window.removeEventListener("resize", scheduleUpdate)
      if (frame !== null) window.cancelAnimationFrame(frame)
    }
  }, [])

  const current = chapters[activeChapter]

  return (
    <section
      id="platform-path"
      className="vb-opportunity-film"
      data-chapter={activeChapter}
      aria-labelledby="opportunity-film-title"
    >
      <div className="vb-section-shell">
        <div className="vb-section-intro vb-section-intro--split">
          <h2 id="opportunity-film-title">The operating path follows the work.</h2>
          <p>
            An opportunity earns attention when its property context, underwriting question, and next action arrive in a
            coherent order. VestBlock keeps that sequence intact.
          </p>
        </div>

        <div className="vb-opportunity-film__story">
          <figure className="vb-opportunity-film__frame" aria-label={`${current.label}: ${current.title}`}>
            <div className="vb-opportunity-film__property" aria-hidden="true">
              <video autoPlay loop muted playsInline preload="none" poster="/vestblock-city-hero-poster.png">
                <source src="/vestblock-city-hero.mp4" type="video/mp4" />
              </video>
              <span>Asset context</span>
            </div>

            <div className="vb-opportunity-film__underwriting" aria-hidden="true">
              <div className="vb-opportunity-film__paper-edge" />
              <p>Capital review</p>
              <strong>Define the decision before you distribute the file.</strong>
              <dl>
                <div>
                  <dt>Requested context</dt>
                  <dd>Property, purpose, timing</dd>
                </div>
                <div>
                  <dt>Decision criteria</dt>
                  <dd>Terms, capacity, diligence</dd>
                </div>
                <div>
                  <dt>Record owner</dt>
                  <dd>Private DealVault</dd>
                </div>
              </dl>
            </div>

            <div className="vb-opportunity-film__execution" aria-hidden="true">
              <span>Next responsible action</span>
              <strong>Qualified counterparties receive a record, not a vague handoff.</strong>
              <p>Purpose · materials · decision owner</p>
            </div>

            <figcaption>
              <span>{current.number}</span>
              <strong>{current.label}</strong>
            </figcaption>
          </figure>

          <ol className="vb-opportunity-film__chapters">
            {chapters.map((chapter, index) => {
              const isActive = activeChapter === index
              return (
                <li
                  key={chapter.number}
                  ref={(element) => {
                    chapterRefs.current[index] = element
                  }}
                  data-chapter={index}
                  data-active={isActive || undefined}
                  aria-current={isActive ? "step" : undefined}
                >
                  <span className="vb-opportunity-film__number">{chapter.number}</span>
                  <div>
                    <p>{chapter.label}</p>
                    <h3>{chapter.title}</h3>
                    <p className="vb-opportunity-film__body">{chapter.body}</p>
                    <small>{chapter.note}</small>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}
