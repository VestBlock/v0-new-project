"use client"

import { useEffect, useRef, useState } from "react"
import { FileCheck2, Landmark, MapPinned, Scale } from "lucide-react"

const stages = [
  {
    number: "01",
    label: "Property",
    title: "Establish the property context",
    body: "Start with the asset, intended use, timing, known terms, and the materials available for review.",
    detail: "The opportunity begins with a shared factual record.",
    icon: MapPinned,
  },
  {
    number: "02",
    label: "Capital",
    title: "Define the capital criteria",
    body: "Clarify the capital request, acquisition parameters, operating capacity, and any inputs still needed.",
    detail: "The decision has a clear question before anyone is asked to answer it.",
    icon: Scale,
  },
  {
    number: "03",
    label: "Qualified route",
    title: "Route the qualified conversation",
    body: "Choose the buyer, lender, operator, or capital partner who should assess the opportunity and what should travel with it.",
    detail: "Each introduction has a defined purpose and next action.",
    icon: Landmark,
  },
  {
    number: "04",
    label: "Execution",
    title: "Carry the execution record forward",
    body: "Keep materials, milestones, conversations, and approved terms connected in the private DealVault record.",
    detail: "The record remains available as the opportunity progresses.",
    icon: FileCheck2,
  },
]

export function CapitalFlowSection() {
  const stageRefs = useRef<Array<HTMLLIElement | null>>([])
  const [activeStage, setActiveStage] = useState(0)

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduceMotion) return

    const observer = new IntersectionObserver(
      (entries) => {
        const active = entries.find((entry) => entry.isIntersecting)
        if (active) setActiveStage(Number((active.target as HTMLElement).dataset.stage))
      },
      { rootMargin: "-48% 0px -48% 0px", threshold: 0 },
    )

    stageRefs.current.forEach((stage) => stage && observer.observe(stage))
    return () => observer.disconnect()
  }, [])

  const current = stages[activeStage]

  return (
    <section id="platform-path" className="vb-capital-sequence" aria-labelledby="capital-sequence-title">
      <div className="vb-section-shell">
        <div className="vb-section-intro vb-section-intro--split">
          <h2 id="capital-sequence-title">One opportunity. Four decisions in sequence.</h2>
          <p>
            VestBlock keeps the property facts, decision criteria, qualified routing, and continuing record in the order a
            real-estate opportunity is reviewed and acted on.
          </p>
        </div>

        <div className="vb-platform-flow" data-stage={activeStage}>
          <div className="vb-platform-flow__figure" aria-hidden="true">
            <div className="vb-platform-flow__figure-inner">
              <svg viewBox="0 0 560 560" fill="none" className="vb-platform-flow__drawing">
                <path className="vb-platform-flow__boundary" d="M96 122L420 72L498 354L230 490L58 344L96 122Z" />
                <path className="vb-platform-flow__contour" d="M122 148L397 106L463 338L236 456L90 330L122 148Z" />
                <path className="vb-platform-flow__route" d="M112 347C174 339 213 309 272 268C328 229 377 188 442 144" />
              </svg>
              {stages.map((stage, index) => (
                <div key={stage.label} className={`vb-platform-flow__node vb-platform-flow__node--${index}`}>
                  <span>{stage.number}</span>
                  <strong>{stage.label}</strong>
                </div>
              ))}
              <div className="vb-platform-flow__current">
                <span>{current.number}</span>
                <strong>{current.label}</strong>
              </div>
            </div>
          </div>

          <ol className="vb-platform-flow__steps">
            {stages.map((stage, index) => {
              const Icon = stage.icon
              const isActive = activeStage === index
              return (
                <li
                  key={stage.number}
                  ref={(element) => {
                    stageRefs.current[index] = element
                  }}
                  data-stage={index}
                  data-active={isActive || undefined}
                  aria-current={isActive ? "step" : undefined}
                >
                  <div className="vb-platform-flow__step-mark">
                    <span>{stage.number}</span>
                    <Icon aria-hidden="true" />
                  </div>
                  <div>
                    <p className="vb-platform-flow__label">{stage.label}</p>
                    <h3>{stage.title}</h3>
                    <p>{stage.body}</p>
                    <small>{stage.detail}</small>
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
