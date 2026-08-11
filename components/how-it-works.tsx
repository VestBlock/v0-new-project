"use client"

import { motion } from "framer-motion"
import { Building2, Network, ShieldCheck } from "lucide-react"

const steps = [
  {
    step: "01",
    title: "Capture the opportunity",
    description:
      "Start with a seller property review, buyer criteria, lender fit, project partner profile, or active deal funding request so the team knows what is actually in front of them.",
    icon: Building2,
  },
  {
    step: "02",
    title: "Route the right relationship",
    description:
      "Use buy boxes, capital criteria, project roles, markets, proof status, and partner notes to decide whether the next step is buyer routing, lender routing, operator routing, or paid review.",
    icon: Network,
  },
  {
    step: "03",
    title: "Prove the deal path",
    description:
      "Use DealVault when agreements, referral payouts, proof submissions, or milestones need a cleaner record before the relationship scales.",
    icon: ShieldCheck,
  },
] as const

export function HowItWorks() {
  return (
    <section id="how-it-works" className="px-4 py-14 md:py-20">
      <div className="container mx-auto">
        <div className="mx-auto mb-8 max-w-3xl text-center md:mb-12">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">How to start</p>
          <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl md:text-5xl">Turn each real estate request into a clearer deal path.</h2>
          <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base md:text-lg md:leading-8">
            The path is simple: capture the opportunity, connect the right buyer, lender, developer, contractor, or operator, then use DealVault when the deal needs a cleaner record.
          </p>
        </div>

        <div className="relative mx-auto grid max-w-6xl gap-6 lg:grid-cols-3">
          {steps.map((step) => (
            <motion.div
              key={step.step}
              whileHover={{ y: -6 }}
              transition={{ duration: 0.25 }}
              className="relative rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl transition-[border-color,box-shadow] duration-200 hover:border-white/15 hover:shadow-[0_24px_54px_rgba(2,6,23,0.28)]"
            >
              <div className="mb-5 flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10">
                  <step.icon className="h-5 w-5 text-cyan-300" />
                </div>
                <span className="text-sm font-medium tracking-[0.2em] text-slate-400">{step.step}</span>
              </div>
              <h3 className="text-xl font-semibold text-white">{step.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-400">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
