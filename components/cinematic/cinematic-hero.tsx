"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowRight, FileSearch, Landmark, MapPinned } from "lucide-react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

const reviewLayers = [
  { icon: MapPinned, label: "Property context", detail: "asset, use, timing, and diligence inputs" },
  { icon: Landmark, label: "Capital path", detail: "requirements, criteria, and counterparties" },
  { icon: FileSearch, label: "Decision record", detail: "materials, next steps, and DealVault history" },
]

export function CinematicHero() {
  const sectionRef = useRef<HTMLElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (reduceMotion || !sectionRef.current || !imageRef.current) return

    gsap.registerPlugin(ScrollTrigger)
    const ctx = gsap.context(() => {
      gsap.fromTo(
        imageRef.current,
        { scale: 1.04, yPercent: 0 },
        {
          scale: 1.14,
          yPercent: 6,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        },
      )

      if (contentRef.current) {
        gsap.to(contentRef.current, {
          yPercent: -10,
          opacity: 0.18,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "18% top",
            end: "76% top",
            scrub: true,
          },
        })
      }
    }, sectionRef)

    return () => ctx.revert()
  }, [reduceMotion])

  return (
    <section ref={sectionRef} className="vb-cinematic-hero" aria-labelledby="homepage-hero-title">
      <div className="vb-cinematic-hero__media" aria-hidden="true">
        {/* Original generated asset: see docs/VESTBLOCK_ASSET_PROVENANCE.md */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imageRef}
          src="/hero/vestblock-property-intelligence-v2.webp"
          alt=""
          fetchPriority="high"
          decoding="async"
          className="vb-cinematic-hero__image"
        />
      </div>

      <div className="vb-cinematic-hero__grade" aria-hidden="true" />
      <div className="vb-cinematic-hero__site-line" aria-hidden="true">
        <span />
      </div>

      <div ref={contentRef} className="vb-cinematic-hero__content">
        <motion.div
          initial={false}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="vb-cinematic-hero__title-block"
        >
          <p className="vb-cinematic-hero__statement">Capital moves through the built environment.</p>
          <h1 id="homepage-hero-title">
            See the property, the capital path, and the next decision.
          </h1>
          <p className="vb-cinematic-hero__lede">
            VestBlock gives real-estate participants a structured way to prepare an opportunity: property context,
            diligence materials, capital requirements, counterparty fit, and a durable DealVault record.
          </p>
        </motion.div>

        <motion.div
          initial={false}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
          className="vb-cinematic-hero__actions"
        >
          <Link href="/sell" className="vb-button vb-button--primary">
            Review an opportunity
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/get-started" className="vb-button vb-button--quiet">
            Build a partner profile
          </Link>
        </motion.div>

        <motion.ol
          initial={false}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="vb-cinematic-hero__review-layers"
          aria-label="How VestBlock organizes an opportunity"
        >
          {reviewLayers.map((layer, index) => {
            const Icon = layer.icon
            return (
              <li key={layer.label}>
                <span className="vb-cinematic-hero__layer-index">0{index + 1}</span>
                <Icon aria-hidden="true" />
                <span>
                  <strong>{layer.label}</strong>
                  <small>{layer.detail}</small>
                </span>
              </li>
            )
          })}
        </motion.ol>
      </div>

      <aside className="vb-cinematic-hero__record" aria-label="Illustrative opportunity preparation frame">
        <span className="vb-cinematic-hero__record-rule" aria-hidden="true" />
        <p>Illustrative preparation frame</p>
        <dl>
          <div>
            <dt>Asset</dt>
            <dd>Context assembled</dd>
          </div>
          <div>
            <dt>Capital</dt>
            <dd>Criteria mapped</dd>
          </div>
          <div>
            <dt>Record</dt>
            <dd>DealVault ready</dd>
          </div>
        </dl>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/vestblock-mark-transparent.png" alt="" aria-hidden="true" />
      </aside>

      <div className="vb-cinematic-hero__scroll-cue" aria-hidden="true">
        <span>Scroll to follow the capital thread</span>
        <i />
      </div>
    </section>
  )
}
