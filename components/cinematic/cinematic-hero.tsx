"use client"

import { useEffect, useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowDown, ArrowRight } from "lucide-react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

const doorways = [
  {
    number: "01",
    label: "Capital",
    detail: "Prepare for funding and understand the paths that may fit.",
  },
  {
    number: "02",
    label: "Deals",
    detail: "Source, assess, and advance informed opportunities.",
  },
  {
    number: "03",
    label: "Opportunity",
    detail: "Explore resources, strategies, and relationships that can move you forward.",
  },
]

export function CinematicHero() {
  const sectionRef = useRef<HTMLElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const mediaRef = useRef<HTMLDivElement | null>(null)
  const transitionRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const section = sectionRef.current
    const content = contentRef.current
    const media = mediaRef.current
    const transition = transitionRef.current
    if (!section || !content || !media || !transition) return

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduceMotion) return

    gsap.registerPlugin(ScrollTrigger)
    const ctx = gsap.context(() => {
      const doorwayItems = section.querySelectorAll<HTMLElement>("[data-hero-doorway]")

      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .fromTo(media, { clipPath: "inset(5% 3% 5% 3%)", scale: 1.025 }, { clipPath: "inset(0% 0% 0% 0%)", scale: 1, duration: 1.05 })
        .fromTo(content, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.68 }, 0.18)
        .fromTo(doorwayItems, { opacity: 0, y: 9 }, { opacity: 1, y: 0, duration: 0.46, stagger: 0.09 }, 0.5)

      gsap
        .timeline({
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        })
        .to(content, { yPercent: -7, opacity: 0.12, ease: "none" }, 0.12)
        .to(media, { scale: 1.04, filter: "brightness(0.66) saturate(0.88)", ease: "none" }, 0.08)
        .fromTo(transition, { opacity: 0, yPercent: 7 }, { opacity: 1, yPercent: 0, ease: "none" }, 0.52)
    }, section)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} className="vb-material-hero" aria-labelledby="homepage-hero-title">
      <div ref={mediaRef} className="vb-material-hero__media" aria-hidden="true">
        <Image
          src="/hero/vestblock-material-ledger-opening.webp"
          alt=""
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          className="vb-material-hero__image"
        />
      </div>
      <div className="vb-material-hero__grade" aria-hidden="true" />

      <div ref={contentRef} className="vb-material-hero__content">
        <p className="vb-material-hero__eyebrow">Capital · Deals · Opportunity</p>
        <h1 id="homepage-hero-title">Find your next move.</h1>
        <p className="vb-material-hero__lede">
          VestBlock brings capital access, deal pathways, and opportunities to build, acquire, or grow into one
          coordinated place. Understand your options, prepare what matters, and act with a clear next step.
        </p>
        <div className="vb-material-hero__actions vb-material-hero__actions--desktop">
          <Link href="/get-started" className="vb-button vb-button--primary">
            Tell us what you&apos;re working toward
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="#platform-path" className="vb-button vb-button--text">
            Explore the three paths
          </Link>
        </div>
      </div>

      <div className="vb-material-hero__actions vb-material-hero__actions--mobile">
        <Link href="/get-started" className="vb-button vb-button--primary">
          Tell us what you&apos;re working toward
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link href="#platform-path" className="vb-button vb-button--text">
          Explore the three paths
        </Link>
      </div>

      <ol className="vb-material-hero__doorways" aria-label="Primary VestBlock doorways">
        {doorways.map((doorway) => (
          <li key={doorway.number} data-hero-doorway>
            <span>{doorway.number}</span>
            <strong>{doorway.label}</strong>
            <p>{doorway.detail}</p>
          </li>
        ))}
      </ol>

      <div ref={transitionRef} className="vb-material-hero__transition" aria-hidden="true">
        <span>One coordinated place</span>
        <strong>Three paths become one clear next step.</strong>
      </div>

      <a className="vb-material-hero__scroll" href="#platform-path">
        <span>See how the paths connect</span>
        <ArrowDown aria-hidden="true" />
      </a>
    </section>
  )
}
