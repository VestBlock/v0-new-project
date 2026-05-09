"use client"

import { Button } from "@/components/ui/button"
import { ArrowRight, Bot, Search, ShieldCheck, Sparkles } from "lucide-react"
import { motion } from "framer-motion"
import Link from "next/link"

const statusBadges = [
  "Live proof contracts",
  "Demo funnel now open",
  "Private files stay off-chain",
]

const proofCards = [
  {
    label: "DealVault",
    title: "Proof, payout, and milestone records",
    description:
      "Clearer agreement records and partner accountability for real estate teams first, with room for other deal-driven businesses.",
    accent: "from-cyan-500/25 to-blue-500/10",
    border: "border-cyan-500/30",
    href: "/dealvault",
  },
  {
    label: "Visibility Expansion",
    title: "Authority, search, and local visibility",
    description:
      "A premium visibility service for businesses that want to show up stronger in search and answer-driven discovery.",
    accent: "from-blue-500/20 to-violet-500/10",
    border: "border-blue-500/20",
    href: "/visibility-expansion",
  },
  {
    label: "AI Receptionist",
    title: "Lead capture and booking systems",
    description:
      "A cleaner front-desk layer for teams losing calls, forms, or bookings after hours.",
    accent: "from-violet-500/20 to-cyan-500/10",
    border: "border-violet-500/20",
    href: "/ai-assistant",
  },
] as const

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-4 pb-24 pt-28">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_32%),radial-gradient(circle_at_80%_18%,rgba(59,130,246,0.16),transparent_24%),radial-gradient(circle_at_20%_78%,rgba(99,102,241,0.12),transparent_26%),linear-gradient(180deg,rgba(5,10,20,0.94),rgba(5,10,20,0.76),rgba(5,10,20,0))]" />
        <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:42px_42px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
      </div>

      <div className="container relative z-10 mx-auto">
        <div className="grid items-center gap-14 lg:grid-cols-[1.1fr_.9fr]">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="max-w-3xl"
          >
            <div className="mb-5 flex flex-wrap gap-2">
              {statusBadges.map((badge) => (
                <div
                  key={badge}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-200 backdrop-blur"
                >
                  <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                  {badge}
                </div>
              ))}
            </div>

            <h1 className="max-w-4xl text-4xl font-semibold leading-[0.98] tracking-tight text-balance md:text-6xl lg:text-7xl">
              Premium systems for trust, visibility, and lead capture.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 md:text-xl">
              VestBlock helps growing businesses prove important records, show up stronger in search,
              and capture better leads without making the customer experience harder.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Button asChild size="lg" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
                <Link href="/dealvault/demo">
                  See DealVault Demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/15 bg-white/[0.03] hover:bg-white/[0.06]">
                <Link href="/pricing">Compare Pricing</Link>
              </Button>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/10">
                  <ShieldCheck className="h-5 w-5 text-cyan-400" />
                </div>
                <p className="text-sm font-medium text-white">Deal confidence</p>
                <p className="mt-1 text-sm text-slate-400">Proof records, payout visibility, and milestone history backed by live contracts.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
                  <Search className="h-5 w-5 text-blue-300" />
                </div>
                <p className="text-sm font-medium text-white">Search presence</p>
                <p className="mt-1 text-sm text-slate-400">Stronger authority, clearer service pages, and better answer-engine visibility.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/10">
                  <Bot className="h-5 w-5 text-violet-300" />
                </div>
                <p className="text-sm font-medium text-white">Response speed</p>
                <p className="mt-1 text-sm text-slate-400">AI receptionist support that helps teams respond faster and book better conversations.</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="relative"
          >
            <div className="absolute left-8 top-10 h-48 w-48 rounded-full bg-cyan-500/15 blur-3xl" />
            <div className="absolute bottom-6 right-8 h-44 w-44 rounded-full bg-violet-500/12 blur-3xl" />

            <div className="relative space-y-4 rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5 shadow-[0_30px_80px_rgba(2,6,23,0.55)] backdrop-blur-xl">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">VestBlock Core</p>
                  <p className="mt-1 text-sm font-medium text-white">Premium business tools</p>
                </div>
                <div className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200">
                  Live on Polygon
                </div>
              </div>

              {proofCards.map((card, index) => (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.45, delay: 0.16 + index * 0.08 }}
                  whileHover={{ y: -6, scale: 1.01 }}
                  className="group"
                >
                  <Link
                    href={card.href}
                    className={`block rounded-[1.35rem] border ${card.border} bg-gradient-to-br ${card.accent} p-5 transition-[border-color,box-shadow] duration-200 hover:border-white/25 hover:shadow-[0_20px_50px_rgba(6,182,212,0.12)]`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-300/80">{card.label}</p>
                        <h2 className="mt-2 text-lg font-semibold text-white">{card.title}</h2>
                      </div>
                      <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] font-medium text-slate-200 transition-colors duration-200 group-hover:border-cyan-300/30 group-hover:text-white">
                        Featured
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-300">{card.description}</p>
                    <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-white/90">
                      Open
                      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
