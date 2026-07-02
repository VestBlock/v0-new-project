"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowRight, Calculator, Home, Users } from "lucide-react"

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
        <p className="vb-mono text-xs uppercase tracking-[0.28em] text-amber-200/80">Pick the next move</p>
        <h2 className="mx-auto mt-5 max-w-2xl text-balance text-4xl font-semibold tracking-tight text-white md:text-6xl">
          Turn interest into a real deal path.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-slate-300/85">
          Sellers can submit a property. Buyers can share their criteria. Operators can run the numbers before the next call.
        </p>
        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          <Link
            href="/sell"
            className="vb-primary-action group w-full"
          >
            <Home className="h-4 w-4" />
            Submit Property
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/buyers"
            className="vb-secondary-action w-full"
          >
            <Users className="h-4 w-4" />
            Join Buyers
          </Link>
          <Link
            href="/property-analyzer"
            className="vb-secondary-action w-full"
          >
            <Calculator className="h-4 w-4" />
            Run Numbers
          </Link>
        </div>
      </motion.div>
    </section>
  )
}
