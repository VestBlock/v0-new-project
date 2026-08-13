"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowDown, ArrowRight, Pause, Play } from "lucide-react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

const doorways = [
  { number: "01", label: "Capital", detail: "Prepare for funding and understand the paths that may fit.", href: "/capital" },
  { number: "02", label: "Real Estate", detail: "Buy, sell, fund, analyze, build, or participate from the right role.", href: "/real-estate" },
  { number: "03", label: "Opportunity", detail: "Strengthen credit, income, business readiness, or growth.", href: "/opportunity" },
]

const chapters = [
  { label: "Capital readiness", detail: "Review the working file", materials: ["Purpose defined", "Documents reviewed", "Options compared"] },
  { label: "Deal evidence", detail: "Bring the facts into view", materials: ["Context organized", "Criteria matched", "Questions flagged"] },
  { label: "Recommended next step", detail: "Choose the appropriate route", materials: ["Path selected", "Access disclosed", "Action recorded"] },
]

export function CinematicHero() {
  const sectionRef = useRef<HTMLElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const mediaRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [paused, setPaused] = useState(false)
  const [chapter, setChapter] = useState(0)
  const [mediaReady, setMediaReady] = useState(false)
  const [mediaFailed, setMediaFailed] = useState(false)

  useEffect(() => {
    const section = sectionRef.current
    const content = contentRef.current
    const media = mediaRef.current
    const video = videoRef.current
    if (!section || !content || !media || !video) return

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduceMotion) {
      video.pause()
      setPaused(true)
      return
    }

    const onTime = () => setChapter(video.currentTime < 4 ? 0 : video.currentTime < 8 ? 1 : 2)
    video.addEventListener("timeupdate", onTime)
    void video.play().catch(() => setPaused(true))

    gsap.registerPlugin(ScrollTrigger)
    const ctx = gsap.context(() => {
      gsap.timeline({ defaults: { ease: "power3.out" } })
        .fromTo(media, { clipPath: "inset(4% 2.5% 4% 2.5%)", scale: 1.02 }, { clipPath: "inset(0% 0% 0% 0%)", scale: 1, duration: 1.05 })
        .fromTo(content, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.68 }, 0.18)
        .fromTo("[data-hero-doorway]", { opacity: 0, y: 9 }, { opacity: 1, y: 0, duration: 0.46, stagger: 0.09 }, 0.5)

      gsap.timeline({ scrollTrigger: { trigger: section, start: "top top", end: "bottom top", scrub: true } })
        .to(content, { yPercent: -6, opacity: 0.18, ease: "none" }, 0.08)
        .to(media, { scale: 1.035, filter: "brightness(0.68) saturate(0.86)", ease: "none" }, 0.08)
        .to(".vb-material-hero__spatial", { yPercent: 6, opacity: 0.25, ease: "none" }, 0.16)
    }, section)

    return () => {
      video.removeEventListener("timeupdate", onTime)
      ctx.revert()
    }
  }, [])

  const togglePlayback = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      void video.play()
      setPaused(false)
    } else {
      video.pause()
      setPaused(true)
    }
  }

  const current = chapters[chapter]

  return (
    <section ref={sectionRef} className="vb-material-hero" aria-labelledby="homepage-hero-title">
      <div ref={mediaRef} className="vb-material-hero__media" data-ready={mediaReady && !mediaFailed || undefined} data-failed={mediaFailed || undefined}>
        <video
          ref={videoRef}
          className="vb-material-hero__video"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/hero/material-ledger/opening-poster.jpg"
          onCanPlay={() => setMediaReady(true)}
          onPlaying={() => { setMediaReady(true); setPaused(false) }}
          onPause={() => setPaused(true)}
          onError={() => { setMediaFailed(true); setMediaReady(false); setPaused(true) }}
          aria-label="A Black business owner reviewing and marking a working file with an AI-assisted spatial interface."
        >
          <source media="(max-width: 640px)" src="/hero/material-ledger/mobile.webm" type="video/webm" />
          <source media="(max-width: 640px)" src="/hero/material-ledger/mobile.mp4" type="video/mp4" />
          <source src="/hero/material-ledger/desktop.webm" type="video/webm" />
          <source src="/hero/material-ledger/desktop.mp4" type="video/mp4" />
        </video>
        <Image className="vb-material-hero__fallback" src="/hero/material-ledger/reduced-motion.jpg" alt="A Black business owner reviewing a working file in a modern office." fill priority sizes="100vw" />
        <div className="vb-material-hero__spatial" data-state={chapter} aria-hidden="true">
          <div className="vb-material-hero__glass" />
          <Image src="/hero/material-ledger/assistant.png" alt="" width={246} height={420} className="vb-material-hero__assistant" />
          <span className="vb-material-hero__evidence" />
        </div>
      </div>
      <div className="vb-material-hero__grade" aria-hidden="true" />

      <button type="button" className="vb-material-hero__playback" onClick={togglePlayback} aria-label={paused ? "Play hero video" : "Pause hero video"}>
        {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
      </button>

      <div ref={contentRef} className="vb-material-hero__content">
        <p className="vb-material-hero__eyebrow">Capital · Real Estate · Opportunity · DealVault</p>
        <h1 id="homepage-hero-title">Find your next move.</h1>
        <p className="vb-material-hero__lede">
          VestBlock helps people and businesses prepare for and coordinate practical next moves across capital, real estate, financial readiness, business growth, and active deal records.
        </p>
        <div className="vb-material-hero__actions">
          <Link href="/next-move" className="vb-button vb-button--primary">Build my free roadmap <ArrowRight className="h-4 w-4" /></Link>
          <Link href="#choose-your-path" className="vb-button vb-button--text">Choose a path</Link>
        </div>
      </div>

      <div className="vb-material-hero__chapter" aria-live="polite">
        <span>0{chapter + 1} · {current.label}</span>
        <strong>{current.detail}</strong>
        <div>{current.materials.map((material) => <small key={material}>{material}</small>)}</div>
      </div>

      <ol className="vb-material-hero__doorways" aria-label="Primary VestBlock paths">
        {doorways.map((doorway) => (
          <li key={doorway.number} data-hero-doorway>
            <Link href={doorway.href}>
              <span>{doorway.number}</span><strong>{doorway.label}</strong><p>{doorway.detail}</p>
            </Link>
          </li>
        ))}
      </ol>

      <a className="vb-material-hero__scroll" href="#choose-your-path"><span>See what VestBlock can help with</span><ArrowDown aria-hidden="true" /></a>
    </section>
  )
}
