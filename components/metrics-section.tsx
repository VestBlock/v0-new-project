"use client"

import { motion } from "framer-motion"
import { Bot, Landmark, Search, ShieldCheck } from "lucide-react"

const signals = [
  {
    icon: ShieldCheck,
    label: "Live proof contracts",
    note: "Proof, payout, and milestone records are backed by live Polygon contracts.",
  },
  {
    icon: Search,
    label: "Monthly visibility work",
    note: "Search pages, AI-answer coverage, PR, and credibility work without vague retainers.",
  },
  {
    icon: Bot,
    label: "AI lead capture layer",
    note: "Better response, qualification, and booking flow for service teams.",
  },
  {
    icon: Landmark,
    label: "Extra help when needed",
    note: "Funding, setup, and credit services stay available without crowding the main offer.",
  },
] as const

export function MetricsSection() {
  return (
    <section className="px-4 pb-10">
      <div className="container mx-auto">
        <div className="premium-section p-5 md:p-7">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">Why clients trust it</p>
              <h2 className="mt-2 text-2xl font-semibold text-white md:text-3xl">Credibility should show up before the sales call.</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-slate-400">
              VestBlock works better when visitors see real proof, clear offers, and one obvious next step instead of a long list of disconnected services.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {signals.map((signal, index) => (
            <motion.div
              key={signal.label}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: index * 0.05 }}
              className="premium-card p-4"
            >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.05]">
                  <signal.icon className="h-5 w-5 text-cyan-300" />
                </div>
                <p className="text-sm font-medium text-white">{signal.label}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{signal.note}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
