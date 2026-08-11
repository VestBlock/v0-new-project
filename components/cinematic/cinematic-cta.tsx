"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowRight, Home } from "lucide-react"

export function CinematicCta() {
  const reduce = useReducedMotion()

  return (
    <section className="relative isolate overflow-hidden px-4 py-28 md:py-40">
      {/* city footage echo */}
      <div className="absolute inset-0 -z-20">
        {reduce ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/vestblock-city-hero-poster.png" alt="" className="h-full w-full object-cover" />
        ) : (
          <video className="h-full w-full object-cover" poster="/vestblock-city-hero-poster.png" autoPlay muted loop playsInline preload="none">
            <source src="/vestblock-city-hero.mp4" type="video/mp4" />
          </video>
        )}
      </div>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(3,6,15,0.97),rgba(3,6,15,0.8)_45%,rgba(3,6,15,0.97))]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_50%,rgba(34,211,238,0.12),transparent_70%)]" />

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 24 }}
        whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        className="relative z-10 mx-auto max-w-3xl text-center"
      >
        <p className="vb-mono text-xs uppercase tracking-[0.28em] text-amber-200/80">Start here</p>
        <h2 className="mx-auto mt-5 max-w-2xl text-balance text-4xl font-semibold tracking-tight text-white md:text-6xl">
          Bring the next opportunity to the right partners.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-slate-300/85">
          Start as a seller, buyer, lender, developer, contractor, operator, or capital partner. VestBlock helps organize
          the next conversation, then adds DealVault records and cleaner follow-through when the relationship calls for it.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/get-started"
            className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 to-sky-400 px-7 py-4 text-sm font-semibold text-slate-950 shadow-[0_18px_50px_rgba(34,211,238,0.35)] transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto"
          >
            Choose My Path
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/sell"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-7 py-4 text-sm font-semibold text-white backdrop-blur-xl transition-colors hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:w-auto"
          >
            <Home className="h-4 w-4" />
            Submit a Property
          </Link>
        </div>
      </motion.div>
    </section>
  )
}
