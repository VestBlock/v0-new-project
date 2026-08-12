"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowDown, ArrowRight } from "lucide-react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

const chapters = ["Property intelligence", "Capital diligence", "Qualified execution"]

export function CinematicHero() {
  const sectionRef = useRef<HTMLElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const mediaRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [mediaReady, setMediaReady] = useState(false)

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const video = videoRef.current

    if (reduceMotion) {
      video?.pause()
      return
    }

    const section = sectionRef.current
    const content = contentRef.current
    const media = mediaRef.current
    if (!section || !content || !media) return

    gsap.registerPlugin(ScrollTrigger)
    const ctx = gsap.context(() => {
      const chapterItems = section.querySelectorAll<HTMLElement>("[data-hero-chapter]")

      const entrance = gsap.timeline({ defaults: { ease: "power3.out" } })
      entrance
        .fromTo(media, { clipPath: "inset(8% 5% 8% 5%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.1 })
        .fromTo(content, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.72 }, 0.22)
        .fromTo(chapterItems, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.1 }, 0.54)

      gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      })
        .to(content, { yPercent: -8, opacity: 0.2, ease: "none" }, 0.16)
        .to(media, { filter: "brightness(0.72) saturate(0.82)", ease: "none" }, 0.1)
    }, section)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} className="vb-architectural-hero" aria-labelledby="homepage-hero-title">
      <div ref={mediaRef} className="vb-architectural-hero__media" data-ready={mediaReady || undefined} aria-hidden="true">
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          poster="/vestblock-city-hero-poster.png"
          onCanPlay={() => setMediaReady(true)}
          className="vb-architectural-hero__film"
        >
          <source src="/vestblock-city-hero.mp4" type="video/mp4" />
        </video>
      </div>
      <div className="vb-architectural-hero__grade" aria-hidden="true" />

      <div ref={contentRef} className="vb-architectural-hero__content">
        <p className="vb-architectural-hero__eyebrow">VestBlock LLC</p>
        <h1 id="homepage-hero-title">Make the opportunity legible before you ask anyone to move.</h1>
        <p className="vb-architectural-hero__lede">
          VestBlock is a real estate opportunity platform that brings property context, capital requirements, and
          qualified execution into one private operating record, so the next conversation starts with the facts it needs.
        </p>
        <div className="vb-architectural-hero__actions">
          <Link href="/sell" className="vb-button vb-button--primary">
            Prepare an opportunity
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="#platform-path" className="vb-button vb-button--quiet">
            See the operating path
          </Link>
        </div>

        <ol className="vb-architectural-hero__chapters" aria-label="The VestBlock operating path">
          {chapters.map((chapter, index) => (
            <li key={chapter} data-hero-chapter>
              <span>0{index + 1}</span>
              <strong>{chapter}</strong>
            </li>
          ))}
        </ol>
      </div>

      <a className="vb-architectural-hero__scroll" href="#platform-path">
        <span>Scroll to follow the opportunity</span>
        <ArrowDown aria-hidden="true" />
      </a>
    </section>
  )
}
