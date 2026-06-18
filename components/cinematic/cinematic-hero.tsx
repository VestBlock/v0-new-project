"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowRight, Building2, Calculator, ShieldCheck, Sparkles, TrendingUp } from "lucide-react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

const tickerItems = [
  { label: "SELLER LEADS", dot: "bg-[#f6c860]" },
  { label: "PROPERTY ANALYSIS", dot: "bg-[#4fcf9f]" },
  { label: "BUYER MATCHING", dot: "bg-sky-300" },
  { label: "LENDER ROUTING", dot: "bg-[#f6c860]" },
  { label: "BUILDER DEMAND", dot: "bg-[#4fcf9f]" },
  { label: "BUYER PACKETS", dot: "bg-slate-200" },
  { label: "DEAL RECORDS", dot: "bg-[#f8e6b0]" },
]

const floatingCards = [
  {
    title: "Start with your role",
    meta: "Seller · Buyer · Lender · Builder",
    icon: Building2,
    className: "hidden md:block md:left-8 md:top-[22%] lg:left-16",
    delay: 0,
    depth: 18,
  },
  {
    title: "Find the right match",
    meta: "Buyers · Capital · Operators",
    icon: TrendingUp,
    className: "hidden md:block md:right-8 md:top-[26%] lg:right-20",
    delay: 0.6,
    depth: -24,
  },
  {
    title: "Keep the record clean",
    meta: "Terms · milestones · proof",
    icon: ShieldCheck,
    className: "hidden md:block md:bottom-[24%] md:right-16 lg:right-40",
    delay: 1.1,
    depth: 12,
  },
]

const HEADLINE_WORDS: Array<{ text: string; gradient?: boolean; break?: boolean }> = [
  { text: "VestBlock" },
  { text: "deal-flow", break: true, gradient: true },
  { text: "operating", gradient: true },
  { text: "system.", gradient: true },
]

export function CinematicHero() {
  const sectionRef = useRef<HTMLDivElement | null>(null)
  const videoWrapRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const reduceMotion = useReducedMotion()
  const [videoOk, setVideoOk] = useState(true)

  // Scroll choreography: footage parallax in, content lifts away with depth
  useEffect(() => {
    if (reduceMotion) return
    if (!sectionRef.current || !videoWrapRef.current) return

    gsap.registerPlugin(ScrollTrigger)
    const ctx = gsap.context(() => {
      gsap.to(videoWrapRef.current, {
        yPercent: 18,
        scale: 1.14,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      })

      if (contentRef.current) {
        gsap.to(contentRef.current, {
          yPercent: -14,
          opacity: 0.08,
          scale: 0.965,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "12% top",
            end: "75% top",
            scrub: true,
          },
        })
      }
    }, sectionRef)

    return () => ctx.revert()
  }, [reduceMotion])

  // Pointer-depth parallax on the floating cards (single listener, CSS vars)
  useEffect(() => {
    if (reduceMotion) return
    const section = sectionRef.current
    if (!section) return

    let raf = 0
    const handlePointerMove = (event: PointerEvent) => {
      if (raf) return
      raf = window.requestAnimationFrame(() => {
        raf = 0
        const rect = section.getBoundingClientRect()
        const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2
        const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2
        section.style.setProperty("--hero-px", x.toFixed(3))
        section.style.setProperty("--hero-py", y.toFixed(3))
      })
    }

    section.addEventListener("pointermove", handlePointerMove)
    return () => {
      section.removeEventListener("pointermove", handlePointerMove)
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [reduceMotion])

  // Respect reduced motion for the video itself
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (reduceMotion) {
      video.pause()
    } else {
      video.play().catch(() => setVideoOk(true))
    }
  }, [reduceMotion])

  return (
    <section ref={sectionRef} className="relative isolate min-h-[92svh] overflow-hidden md:min-h-[100svh]">
      {/* Cinematic city footage */}
      <div ref={videoWrapRef} className="absolute inset-0 -z-20 will-change-transform">
        {videoOk ? (
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            poster="/vestblock-city-hero-poster.png"
            autoPlay={!reduceMotion}
            muted
            loop
            playsInline
            preload="metadata"
            onError={() => setVideoOk(false)}
          >
            <source src="/vestblock-city-hero.mp4" type="video/mp4" />
          </video>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/vestblock-city-hero-poster.png" alt="" className="h-full w-full object-cover" />
        )}
      </div>

      {/* Luxury grade + scrims for readability */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,6,15,0.84)_0%,rgba(3,6,15,0.58)_36%,rgba(3,6,15,0.80)_70%,rgba(3,6,15,0.98)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(246,200,96,0.12),transparent_30%,rgba(79,207,159,0.08)_70%,transparent)] mix-blend-screen" />
        <div className="vb-scan-grid absolute inset-0 opacity-30" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
      </div>

      {/* Floating glass data cards with pointer depth */}
      {!reduceMotion &&
        floatingCards.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.title}
              className={`pointer-events-none absolute z-10 ${card.className}`}
              style={{
                transform: `translate3d(calc(var(--hero-px, 0) * ${card.depth}px), calc(var(--hero-py, 0) * ${card.depth * 0.7}px), 0)`,
                transition: "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: [0, -10, 0] }}
                transition={{
                  opacity: { duration: 0.8, delay: 0.6 + card.delay },
                  y: { duration: 6, repeat: Infinity, ease: "easeInOut", delay: card.delay },
                }}
              >
                <div className="flex items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 shadow-[0_20px_60px_rgba(2,6,23,0.5)] backdrop-blur-2xl">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/12 bg-white/[0.06] text-cyan-200">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold leading-4 text-white">{card.title}</span>
                    <span className="mt-0.5 block font-mono text-[0.65rem] uppercase tracking-[0.14em] text-slate-400">
                      {card.meta}
                    </span>
                  </span>
                </div>
              </motion.div>
            </div>
          )
        })}

      {/* Hero content */}
      <div
        ref={contentRef}
        className="relative z-20 mx-auto flex min-h-[92svh] max-w-5xl flex-col items-center justify-center px-4 pb-24 pt-28 text-center will-change-transform md:min-h-[100svh]"
      >
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-200 backdrop-blur-xl"
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-200" />
          Analyze · Route · Package · Close
        </motion.div>

        <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.02] tracking-tight text-white sm:text-6xl md:text-7xl xl:text-[5.35rem]">
          {HEADLINE_WORDS.map((word, index) => (
            <span key={`${word.text}-${index}`}>
              <span className="vb-word-mask">
                <span
                  className={
                    word.gradient
                      ? "vb-word vb-text-glow bg-gradient-to-r from-cyan-200 via-sky-100 to-amber-200 bg-clip-text text-transparent"
                      : "vb-word"
                  }
                  style={{ ["--vb-word-delay" as string]: `${140 + index * 75}ms` }}
                >
                  {word.text}
                </span>
              </span>
              {word.break ? (
                <>
                  <br className="hidden sm:block" />
                  <span className="sm:hidden"> </span>
                </>
              ) : (
                " "
              )}
            </span>
          ))}
        </h1>

        <motion.p
          initial={false}
          className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-7 text-slate-200 md:text-lg md:leading-8"
        >
          Analyze seller leads, package real opportunities, and route them to the right buyers, lenders, builders, and capital partners.
          Start with a property review, then VestBlock helps organize the buyer packet, funding path, outreach lane, and deal record.
        </motion.p>

        <motion.div
          initial={false}
          className="mt-8 flex w-full max-w-2xl flex-col items-center gap-3 sm:flex-row sm:justify-center"
        >
          <Link href="/sell" className="vb-primary-action group w-full sm:w-auto">
            Start a Deal Review
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link href="/get-started" className="vb-secondary-action w-full sm:w-auto">
            Join Buyer / Partner Network
          </Link>
        </motion.div>

        <motion.div initial={false} className="mt-3">
          <Link
            href="/property-analyzer"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-[#f8e6b0] underline-offset-4 transition-colors hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f6c860]"
          >
            <Calculator className="h-4 w-4" />
            Run a property analysis first
          </Link>
        </motion.div>

        {/* Scroll cue */}
        {!reduceMotion ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.4 }}
            className="pointer-events-none absolute bottom-20 left-1/2 hidden -translate-x-1/2 md:block"
          >
            <div className="flex h-12 w-7 items-start justify-center rounded-full border border-white/20 bg-white/[0.03] p-1.5 backdrop-blur">
              <span className="animate-vb-scroll-cue block h-2 w-1 rounded-full bg-cyan-200/90" />
            </div>
          </motion.div>
        ) : null}
      </div>

      {/* Bloomberg-style ticker */}
      <div className="absolute inset-x-0 bottom-0 z-20 border-t border-white/10 bg-slate-950/55 backdrop-blur-xl">
        <div className="group flex overflow-hidden py-3">
          <div className={`flex shrink-0 items-center gap-8 whitespace-nowrap px-4 ${reduceMotion ? "" : "animate-vb-ticker"}`}>
            {[...tickerItems, ...tickerItems, ...tickerItems].map((item, i) => (
              <span key={i} className="flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-slate-300/80">
                <span className={`h-1.5 w-1.5 rounded-full ${item.dot}`} />
                {item.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
