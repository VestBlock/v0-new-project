"use client"

import { VestBlockCommandScene, type CommandRole } from "@/components/vestblock-command-scene"
import { ArrowRight, Hammer, Home, Landmark, Users, type LucideIcon } from "lucide-react"
import { motion } from "framer-motion"
import Link from "next/link"
import { useState } from "react"

const rolePaths = [
  {
    key: "seller",
    label: "Sellers",
    title: "Submit a Property",
    href: "/sell",
    icon: Home,
    ring: "group-hover:border-cyan-300/50",
    glow: "hover:shadow-[0_24px_70px_rgba(8,145,178,0.22)]",
    dot: "bg-cyan-300",
  },
  {
    key: "buyer",
    label: "Buyers",
    title: "Share Buy Box",
    href: "/buyers",
    icon: Users,
    ring: "group-hover:border-blue-300/50",
    glow: "hover:shadow-[0_24px_70px_rgba(59,130,246,0.22)]",
    dot: "bg-blue-300",
  },
  {
    key: "lender",
    label: "Lenders",
    title: "Join Lender Network",
    href: "/lenders",
    icon: Landmark,
    ring: "group-hover:border-amber-200/50",
    glow: "hover:shadow-[0_24px_70px_rgba(250,204,21,0.18)]",
    dot: "bg-amber-200",
  },
  {
    key: "builder",
    label: "Operators",
    title: "Join Partner Network",
    href: "/get-started",
    icon: Hammer,
    ring: "group-hover:border-violet-300/50",
    glow: "hover:shadow-[0_24px_70px_rgba(168,85,247,0.2)]",
    dot: "bg-violet-300",
  },
] satisfies Array<{
  key: CommandRole
  label: string
  title: string
  href: string
  icon: LucideIcon
  ring: string
  glow: string
  dot: string
}>

export function HeroSection() {
  const [activeRole, setActiveRole] = useState<CommandRole>("seller")

  return (
    <section className="relative isolate flex min-h-[100svh] flex-col justify-center overflow-hidden px-4 pb-20 pt-24 sm:pt-28">
      {/* Full-bleed cinematic 3D background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <VestBlockCommandScene activeRole={activeRole} />
      </div>

      {/* Readability scrims + atmosphere over the scene */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_42%,rgba(3,7,18,0.30),rgba(3,7,18,0.62)_60%,rgba(3,7,18,0.86)_100%)]" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#03060f] via-[#03060f]/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[#03060f] via-[#03060f]/80 to-transparent" />
        <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(rgba(148,163,184,0.10)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.10)_1px,transparent_1px)] [background-size:72px_72px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
      </div>

      <div className="container relative z-10 mx-auto flex max-w-5xl flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 py-1.5 text-xs font-medium tracking-[0.18em] text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.9)]" />
          SELL · BUY · FUND · BUILD
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05 }}
          className="text-balance text-5xl font-semibold leading-[0.95] tracking-tight text-white sm:text-6xl md:text-7xl xl:text-[5.25rem]"
        >
          Real estate opportunities,
          <br className="hidden sm:block" />{" "}
          <span className="bg-gradient-to-r from-cyan-200 via-sky-200 to-violet-200 bg-clip-text text-transparent">
            connected right.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.12 }}
          className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-7 text-slate-300/90 md:text-lg md:leading-8"
        >
          VestBlock connects sellers, buyers, lenders, developers, contractors, and operators through clearer next steps,
          DealVault records, and visibility support.
        </motion.p>

        {/* Four role CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-10 grid w-full grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
        >
          {rolePaths.map((path) => {
            const Icon = path.icon
            const isActive = activeRole === path.key

            return (
              <Link
                key={path.key}
                href={path.href}
                onFocus={() => setActiveRole(path.key)}
                onMouseEnter={() => setActiveRole(path.key)}
                className={`group relative flex flex-col items-start gap-4 overflow-hidden rounded-2xl border bg-slate-950/55 p-4 text-left backdrop-blur-2xl transition-[transform,border-color,box-shadow,background-color] duration-300 hover:-translate-y-1.5 hover:bg-slate-900/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:p-5 ${path.ring} ${path.glow} ${
                  isActive ? "border-white/25 bg-slate-900/55" : "border-white/10"
                }`}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/12 bg-white/[0.06] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="w-full">
                  <span className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    <span className={`h-1.5 w-1.5 rounded-full ${path.dot}`} />
                    {path.label}
                  </span>
                  <span className="mt-1.5 flex items-center justify-between gap-2 text-base font-semibold text-white sm:text-lg">
                    {path.title}
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-cyan-200" />
                  </span>
                </span>
              </Link>
            )
          })}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.34 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400"
        >
          <span className="text-cyan-200/90">Connect</span>
          <span className="h-1 w-1 rounded-full bg-slate-600" />
          <span className="text-blue-200/90">Route</span>
          <span className="h-1 w-1 rounded-full bg-slate-600" />
          <span className="text-amber-100/90">Fund</span>
          <span className="h-1 w-1 rounded-full bg-slate-600" />
          <span className="text-violet-200/90">Build</span>
          <span className="h-1 w-1 rounded-full bg-slate-600" />
          <span className="text-slate-300/90">Verify with DealVault</span>
        </motion.div>
      </div>
    </section>
  )
}
