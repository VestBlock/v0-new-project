"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

const reviewLayers = [
  { label: "Property", detail: "asset context and diligence" },
  { label: "Capital", detail: "criteria and requirements" },
  { label: "Execution", detail: "the next qualified action" },
]

export function CinematicHero() {
  const sectionRef = useRef<HTMLElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduceMotion || !sectionRef.current || !imageRef.current || !sceneRef.current) return

    gsap.registerPlugin(ScrollTrigger)
    const ctx = gsap.context(() => {
      const scene = sceneRef.current!
      const sceneItems = scene.querySelectorAll<HTMLElement>("[data-scene-item]")
      const route = scene.querySelector<SVGPathElement>("[data-scene-route]")

      gsap.set(sceneItems, { opacity: 0, y: 18 })
      if (route) gsap.set(route, { strokeDashoffset: 1 })

      const introduction = gsap.timeline({ defaults: { ease: "power3.out" } })
      introduction
        .to(scene, { opacity: 1, duration: 0.42 })
        .to(route, { strokeDashoffset: 0, duration: 1.3 }, 0.08)
        .to(sceneItems, { opacity: 1, y: 0, duration: 0.58, stagger: 0.12 }, 0.35)

      gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      })
        .to(imageRef.current, { scale: 1.1, yPercent: 5, ease: "none" }, 0)
        .to(scene, { yPercent: 12, scale: 1.035, opacity: 0.72, ease: "none" }, 0)
        .to(contentRef.current, { yPercent: -9, opacity: 0.18, ease: "none" }, 0.08)
    }, sectionRef)

    return () => ctx.revert()
  }, [])

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

      <div ref={sceneRef} className="vb-hero-scene" aria-hidden="true">
        <svg className="vb-hero-scene__drawing" viewBox="0 0 640 680" fill="none" preserveAspectRatio="xMidYMid meet">
          <path className="vb-hero-scene__parcel" d="M116 118L514 72L572 492L198 590L76 362L116 118Z" />
          <path
            data-scene-route
            className="vb-hero-scene__route"
            d="M168 438C238 397 279 375 338 334C396 294 442 251 500 194"
            pathLength="1"
          />
          <circle className="vb-hero-scene__origin" cx="168" cy="438" r="7" />
          <circle className="vb-hero-scene__origin vb-hero-scene__origin--middle" cx="338" cy="334" r="7" />
          <circle className="vb-hero-scene__origin vb-hero-scene__origin--end" cx="500" cy="194" r="7" />
        </svg>
        <div data-scene-item className="vb-hero-scene__caption vb-hero-scene__caption--property">
          <span>01</span>
          <strong>Property context</strong>
          <small>asset · timing · record</small>
        </div>
        <div data-scene-item className="vb-hero-scene__caption vb-hero-scene__caption--capital">
          <span>02</span>
          <strong>Capital criteria</strong>
          <small>terms · fit · diligence</small>
        </div>
        <div data-scene-item className="vb-hero-scene__caption vb-hero-scene__caption--route">
          <span>03</span>
          <strong>Qualified route</strong>
          <small>counterparty · next action</small>
        </div>
      </div>

      <div ref={contentRef} className="vb-cinematic-hero__content">
        <div className="vb-cinematic-hero__title-block">
          <h1 id="homepage-hero-title">One clear path from property context to capital and execution.</h1>
          <p className="vb-cinematic-hero__lede">
            VestBlock helps owners, capital partners, and execution teams prepare an opportunity, assess fit, and carry
            the record forward with the facts each next conversation needs.
          </p>
        </div>

        <div className="vb-cinematic-hero__actions">
          <Link href="/sell" className="vb-button vb-button--primary">
            Prepare an opportunity
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/get-started" className="vb-button vb-button--quiet">
            Choose your entry path
          </Link>
        </div>

        <ol className="vb-cinematic-hero__review-layers" aria-label="How VestBlock organizes an opportunity">
          {reviewLayers.map((layer, index) => (
            <li key={layer.label}>
              <span className="vb-cinematic-hero__layer-index">0{index + 1}</span>
              <span>
                <strong>{layer.label}</strong>
                <small>{layer.detail}</small>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <a className="vb-cinematic-hero__scroll-cue" href="#platform-path">
        <span>Explore the decision path</span>
        <i />
      </a>
    </section>
  )
}
