"use client"

import { motion } from "framer-motion"
import { Building2, HandCoins, Home, ShieldCheck } from "lucide-react"

const signals = [
  {
    icon: Home,
    label: "Seller intake",
    note: "Property details, owner timing, and follow-up context move into one clearer review path.",
  },
  {
    icon: Building2,
    label: "Buyer and lender fit",
    note: "Buy boxes, deal type, funding needs, and partner criteria are easier to compare before outreach.",
  },
  {
    icon: ShieldCheck,
    label: "DealVault records",
    note: "Agreement records, proof certificates, payout visibility, and milestones stay organized for deal teams.",
  },
  {
    icon: HandCoins,
    label: "Member visibility support",
    note: "Visibility, lead intake, funding prep, and credit help stay available when they support a real estate relationship.",
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
              <h2 className="mt-2 text-2xl font-semibold text-white md:text-3xl">Real estate deals need clearer intake before anyone wastes a call.</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-slate-400">
              VestBlock works better when sellers, buyers, lenders, developers, contractors, and operators can see the right path immediately instead of sorting through disconnected services.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {signals.map((signal) => (
              <motion.div
                key={signal.label}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.25 }}
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
