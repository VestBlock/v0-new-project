"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"

const chapters = [
  {
    number: "01",
    label: "Capital",
    title: "Prepare what a funding conversation needs.",
    body: "Organize the purpose, amount, timing, documents, and financial context. Then compare the capital paths that may fit before making an application or introduction.",
    note: "A defined request with the right materials in view.",
  },
  {
    number: "02",
    label: "Deals",
    title: "Turn an opportunity into an informed decision.",
    body: "Bring the relevant facts, economics, participants, and open questions together. Real-estate and business opportunities remain distinct, but each can be assessed with clearer context.",
    note: "A deal brief that makes the actual decision easier to see.",
  },
  {
    number: "03",
    label: "Opportunity",
    title: "Choose the resource, relationship, or action that moves the work forward.",
    body: "Explore practical ways to build, acquire, improve, or grow. When a next step involves partners, agreements, milestones, or payouts, DealVault keeps the supporting record connected.",
    note: "A selected next action with continuity underneath it.",
  },
]

export function CapitalFlowSection() {
  const chapterRefs = useRef<Array<HTMLLIElement | null>>([])
  const [activeChapter, setActiveChapter] = useState(0)

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduceMotion) return

    const observer = new IntersectionObserver(
      (entries) => {
        const active = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top))[0]

        const index = active?.target.getAttribute("data-chapter")
        if (index !== null && index !== undefined) setActiveChapter(Number(index))
      },
      { rootMargin: "-44% 0px -44% 0px", threshold: 0 }
    )

    chapterRefs.current.forEach((chapter) => chapter && observer.observe(chapter))
    return () => observer.disconnect()
  }, [])

  const current = chapters[activeChapter]

  return (
    <section id="platform-path" className="vb-material-path" data-chapter={activeChapter} aria-labelledby="material-path-title">
      <div className="vb-section-shell">
        <div className="vb-section-intro vb-section-intro--split">
          <h2 id="material-path-title">Three paths. One clear next move.</h2>
          <p>
            Capital helps prepare the resources. Deals bring the facts and people into view. Opportunity expands what
            you can do next. VestBlock keeps the decision connected from first question to active work.
          </p>
        </div>

        <div className="vb-material-path__story">
          <figure className="vb-material-path__frame" aria-label={`${current.label}: ${current.title}`}>
            <Image
              src="/hero/vestblock-material-ledger-transition.webp"
              alt="A person comparing capital documents, a deal brief, and opportunity materials at one decision workspace."
              fill
              sizes="(max-width: 900px) 100vw, 44vw"
              className="vb-material-path__image"
            />
            <div className="vb-material-path__shade" aria-hidden="true" />
            <div className="vb-material-path__caption">
              <span>{current.number}</span>
              <strong>{current.label}</strong>
              <p>{activeChapter === 0 ? "Prepare" : activeChapter === 1 ? "Assess" : "Act"}</p>
            </div>
          </figure>

          <ol className="vb-material-path__chapters">
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
                  <span className="vb-material-path__number">{chapter.number}</span>
                  <div>
                    <p>{chapter.label}</p>
                    <h3>{chapter.title}</h3>
                    <p className="vb-material-path__body">{chapter.body}</p>
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
