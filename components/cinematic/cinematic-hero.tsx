"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowRight, Building2, ShieldCheck, Sparkles, TrendingUp } from "lucide-react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

const tickerItems = [
  { label: "SELLERS", dot: "bg-cyan-300" },
  { label: "BUYERS", dot: "bg-sky-300" },
  { label: "LENDERS", dot: "bg-amber-300" },
  { label: "DEVELOPERS", dot: "bg-violet-300" },
  { label: "CONTRACTORS", dot: "bg-cyan-200" },
  { label: "DEAL REVIEW", dot: "bg-emerald-300" },
  { label: "DEALVAULT RECORDS", dot: "bg-amber-200" },
]

const floatingCards = [
  {
    title: "Start with your role",
    meta: "Seller · Buyer · Lender · Builder",
    icon: Building2,
    className: "hidden md:block md:left-8 md:top-[22%] lg:left-16",
    delay: 0,
  },
  {
    title: "Meet the right partners",
    meta: "Buyers · Capital · Operators",
    icon: TrendingUp,
    className: "hidden md:block md:right-8 md:top-[26%] lg:right-20",
    delay: 0.6,
  },
  {
    title: "Keep the deal moving",
    meta: "Review · records · next steps",
    icon: ShieldCheck,
    className: "hidden md:block md:bottom-[24%] md:right-16 lg:right-40",
    delay: 1.1,
  },
]

export function CinematicHero() {
  const sectionRef = useRef<HTMLDivElement | null>(null)
  const videoWrapRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const reduceMotion = useReducedMotion()
  const [videoOk, setVideoOk] = useState(true)

  // GSAP scroll-scrub parallax on the city footage
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
    }, sectionRef)

    return () => ctx.revert()
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
    <section ref={sectionRef} className="relative isolate min-h-[100svh] overflow-hidden">
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
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,6,15,0.72)_0%,rgba(3,6,15,0.45)_38%,rgba(3,6,15,0.72)_72%,rgba(3,6,15,0.97)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,transparent_40%,rgba(3,6,15,0.6)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(70%_50%_at_50%_46%,rgba(34,211,238,0.10),transparent_60%),radial-gradient(50%_40%_at_85%_75%,rgba(245,158,11,0.10),transparent_60%)] mix-blend-screen" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
      </div>

      {/* Floating glass data cards */}
      {!reduceMotion &&
        floatingCards.map((card) => {
          const Icon = card.icon
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: [0, -10, 0] }}
              transition={{
                opacity: { duration: 0.8, delay: 0.6 + card.delay },
                y: { duration: 6, repeat: Infinity, ease: "easeInOut", delay: card.delay },
              }}
              className={`pointer-events-none absolute z-10 ${card.className}`}
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
          )
        })}

      {/* Hero content */}
      <div className="relative z-20 mx-auto flex min-h-[100svh] max-w-5xl flex-col items-center justify-center px-4 pb-24 pt-28 text-center">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-200 backdrop-blur-xl"
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-200" />
          Sell · Buy · Fund · Build
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.06 }}
          className="mt-6 text-balance text-5xl font-semibold leading-[0.95] tracking-tight text-white sm:text-6xl md:text-7xl xl:text-[5.5rem]"
        >
          Connect real estate
          <br className="hidden sm:block" />{" "}
          opportunities with{" "}
          <span className="bg-gradient-to-r from-cyan-200 via-sky-100 to-amber-200 bg-clip-text text-transparent">
            the right partners.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.14 }}
          className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-7 text-slate-300/90 md:text-lg md:leading-8"
        >
          VestBlock helps property owners, buyers, lenders, developers, contractors, operators, and capital partners find
          the next serious conversation. Share what you want to sell, buy, fund, or build, then we organize the path, keep
          important records in DealVault, and help the right partners review the opportunity clearly.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.22 }}
          className="mt-10 flex flex-col items-center gap-3 sm:flex-row"
        >
          <Link
            href="/get-started"
            className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 to-sky-400 px-7 py-3.5 text-sm font-semibold text-slate-950 shadow-[0_18px_50px_rgba(34,211,238,0.35)] transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto"
          >
            Choose Your Path
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/sell"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-7 py-3.5 text-sm font-semibold text-white backdrop-blur-xl transition-colors hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:w-auto"
          >
            Submit a Property
          </Link>
        </motion.div>
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
