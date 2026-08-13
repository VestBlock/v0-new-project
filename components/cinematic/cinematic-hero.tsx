"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowDown, ArrowRight, Check, Pause, Play } from "lucide-react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

const lanes = [
  { number: "01", label: "Capital", short: "Prepare and compare", href: "/capital" },
  { number: "02", label: "Real Estate", short: "Find the right role", href: "/real-estate" },
  { number: "03", label: "Opportunity", short: "Build readiness", href: "/opportunity" },
  { number: "04", label: "DealVault", short: "Keep work connected", href: "/dealvault" },
]

const chapters = [
  { lane: 0, step: "Establish the objective", title: "A real goal enters the room.", evidence: "Owner context in view", action: "Reviewing the working file" },
  { lane: 0, step: "Mark the priority", title: "Capital readiness is identified.", evidence: "Purpose and timing marked", action: "Organizing the decision inputs" },
  { lane: 1, step: "Match the criteria", title: "Property information joins the file.", evidence: "Role and criteria compared", action: "Connecting the relevant path" },
  { lane: 2, step: "Resolve the gaps", title: "Readiness becomes an ordered plan.", evidence: "Preparation gaps surfaced", action: "Sequencing practical actions" },
  { lane: 3, step: "Preserve the record", title: "Active work stays connected.", evidence: "Decision history recorded", action: "Preparing DealVault continuity" },
  { lane: 3, step: "Choose the next move", title: "The room resolves to one action.", evidence: "Recommended route ready", action: "Continue with your situation" },
]

export function CinematicHero() {
  const sectionRef = useRef<HTMLElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [paused, setPaused] = useState(false)
  const [chapter, setChapter] = useState(0)
  const [mediaReady, setMediaReady] = useState(false)
  const [mediaFailed, setMediaFailed] = useState(false)

  useEffect(() => {
    const section = sectionRef.current
    const content = contentRef.current
    const scene = sceneRef.current
    const video = videoRef.current
    if (!section || !content || !scene || !video) return

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)")
    const reduceMotion = motionPreference.matches
    if (reduceMotion) {
      video.pause()
      return
    }

    const onTime = () => setChapter(Math.min(chapters.length - 1, Math.floor(video.currentTime / 2)))
    video.addEventListener("timeupdate", onTime)
    void video.play().catch(() => setPaused(true))

    gsap.registerPlugin(ScrollTrigger)
    const ctx = gsap.context(() => {
      gsap.timeline({ defaults: { ease: "power3.out" } })
        .fromTo(content, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.72 })
        .fromTo(scene, { opacity: 0, x: 26, clipPath: "inset(0 7% 0 0)" }, { opacity: 1, x: 0, clipPath: "inset(0 0% 0 0)", duration: 0.9 }, 0.1)
        .fromTo("[data-hero-lane]", { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.42, stagger: 0.07 }, 0.48)

      gsap.timeline({
        scrollTrigger: { trigger: section, start: "top top", end: "bottom 18%", scrub: 0.35 },
      })
        .to(content, { y: -28, opacity: 0.32, ease: "none" }, 0)
        .to(scene, { y: 34, scale: 0.965, filter: "brightness(0.76) saturate(0.82)", ease: "none" }, 0)
        .to(".vb-material-hero__scene-head", { opacity: 0, y: -10, ease: "none" }, 0)
        .to(".vb-material-hero__handoff", { opacity: 1, y: 0, ease: "none" }, 0.45)
    }, section)

    return () => {
      video.removeEventListener("timeupdate", onTime)
      ctx.revert()
    }
  }, [])

  const togglePlayback = () => {
    const video = videoRef.current
    if (!video || mediaFailed) return
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
      <div className="vb-material-hero__shell">
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
          <p className="vb-material-hero__assurance"><Check aria-hidden="true" /> Start free. Keep your work connected when you are ready.</p>
        </div>

        <div ref={sceneRef} className="vb-material-hero__scene" data-chapter={chapter} data-media-failed={mediaFailed || undefined}>
          <div className="vb-material-hero__scene-head">
            <span><i aria-hidden="true" /> VestBlock decision room</span>
            <small>
              {mediaFailed
                ? "Static working reference"
                : mediaReady
                  ? `Live working session · 0${chapter + 1}/06`
                  : "Preparing working session"}
            </small>
          </div>

          <div
            className="vb-material-hero__media"
            data-ready={(mediaReady && !mediaFailed) || undefined}
            data-failed={mediaFailed || undefined}
          >
            <div className="vb-material-hero__poster">
              <Image
                className="vb-material-hero__fallback vb-material-hero__fallback--desktop"
                src="/hero/decision-room-v2/desktop-poster.webp"
                alt="A Black business owner and a physical AI robot reviewing the same marked business document in a modern office."
                fill
                priority
                sizes="(max-width: 900px) 100vw, 62vw"
              />
              <Image
                className="vb-material-hero__fallback vb-material-hero__fallback--mobile"
                src="/hero/decision-room-v2/mobile-poster.webp"
                alt="A Black business owner and a physical AI robot reviewing the same marked business document in a dedicated mobile composition."
                fill
                priority
                sizes="(max-width: 640px) 100vw, 1px"
              />
            </div>

            <video
              ref={videoRef}
              className="vb-material-hero__video"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster="/hero/decision-room-v2/desktop-poster.webp"
              onLoadedData={() => setMediaReady(true)}
              onCanPlay={() => setMediaReady(true)}
              onPlaying={() => { setMediaReady(true); setPaused(false) }}
              onPause={() => setPaused(true)}
              onError={() => { setMediaFailed(true); setMediaReady(false); setPaused(true) }}
              aria-label="A Black business owner actively reviewing and marking a working file while a physical AI robot responds and organizes the next decision."
            >
              <source media="(max-width: 640px)" src="/hero/material-ledger/mobile.webm" type="video/webm" />
              <source media="(max-width: 640px)" src="/hero/material-ledger/mobile.mp4" type="video/mp4" />
              <source src="/hero/material-ledger/desktop.webm" type="video/webm" />
              <source src="/hero/material-ledger/desktop.mp4" type="video/mp4" />
            </video>

            <div className="vb-material-hero__robot-mask" aria-hidden="true" />
            <Image className="vb-material-hero__robot" src="/hero/decision-room-v2/robot-pointing.webp" alt="" width="900" height="766" />
            <div className="vb-material-hero__decision-line" aria-hidden="true"><span /></div>

            <div className="vb-material-hero__decision" aria-live="polite">
              <span>{current.step}</span>
              <strong>{current.title}</strong>
              <div><small>Evidence</small><p>{current.evidence}</p></div>
              <div><small>AI response</small><p>{current.action}</p></div>
            </div>
          </div>

          <nav className="vb-material-hero__lanes" aria-label="Explore VestBlock's four platform lanes">
            {lanes.map((lane, index) => (
              <Link key={lane.number} href={lane.href} data-hero-lane data-active={current.lane === index || undefined}>
                <span>{lane.number}</span>
                <strong>{lane.label}</strong>
                <small>{lane.short}</small>
                <ArrowRight aria-hidden="true" />
              </Link>
            ))}
          </nav>

          {mediaReady && !mediaFailed ? (
            <button type="button" className="vb-material-hero__playback" onClick={togglePlayback} aria-label={paused ? "Play hero scene" : "Pause hero scene"}>
              {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
              <span>{paused ? "Play" : "Pause"}</span>
            </button>
          ) : null}
        </div>
      </div>

      <a className="vb-material-hero__handoff" href="#choose-your-path">
        <span>Continue the decision</span><strong>What are you trying to do next?</strong><ArrowDown aria-hidden="true" />
      </a>
    </section>
  )
}
