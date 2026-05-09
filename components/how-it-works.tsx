"use client"

import { motion } from "framer-motion"
import { Bot, Search, ShieldCheck } from "lucide-react"

const steps = [
  {
    step: "01",
    title: "Choose the right outcome",
    description:
      "Start with DealVault when records and accountability matter. Choose Visibility when people need to find you. Choose AI Receptionist when leads arrive but response is slow.",
    icon: ShieldCheck,
  },
  {
    step: "02",
    title: "Start with one clear service",
    description:
      "Each offer solves one business problem, so customers can understand what they are buying without sorting through a crowded menu.",
    icon: Search,
  },
  {
    step: "03",
    title: "Add support when the work gets deeper",
    description:
      "Funding, setup, credit, and seller help stay available when the situation needs more preparation or a human review.",
    icon: Bot,
  },
] as const

export function HowItWorks() {
  return (
    <section id="how-it-works" className="px-4 py-20">
      <div className="container mx-auto">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">How to start</p>
          <h2 className="mt-3 text-3xl font-semibold text-white md:text-5xl">Pick the service that solves today&apos;s problem.</h2>
          <p className="mt-4 text-lg leading-8 text-slate-300">
            VestBlock is easier to buy when the next step is obvious: better records, better visibility, better response, or deeper support.
          </p>
        </div>

        <div className="relative mx-auto grid max-w-6xl gap-6 lg:grid-cols-3">
          {steps.map((step, index) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{ y: -6 }}
              transition={{ duration: 0.35, delay: index * 0.06 }}
              viewport={{ once: true }}
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
