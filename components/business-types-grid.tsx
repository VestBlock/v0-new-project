"use client"

import { motion } from "framer-motion"
import {
  Building2,
  Car,
  Droplets,
  HandCoins,
  Hammer,
  Home,
  Sparkles,
  Thermometer,
} from "lucide-react"

const businessTypes = [
  { name: "Investor teams", icon: Building2 },
  { name: "Rehab operators", icon: Hammer },
  { name: "Property managers", icon: Home },
  { name: "Referral partners", icon: HandCoins },
  { name: "HVAC teams", icon: Thermometer },
  { name: "Plumbing teams", icon: Droplets },
  { name: "Auto repair shops", icon: Car },
  { name: "Med spas", icon: Sparkles },
] as const

export function BusinessTypesGrid() {
  return (
    <section className="px-4 py-20">
      <div className="container mx-auto">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">Best customer matches</p>
          <h2 className="mt-3 text-3xl font-semibold text-white md:text-5xl">Built for businesses that need more clarity, not more noise.</h2>
          <p className="mt-4 text-lg leading-8 text-slate-300">
            VestBlock helps most when a business has weak visibility, slow response, unclear records, or too much friction between interest and follow-up.
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-8">
          {businessTypes.map((business, index) => (
            <motion.div
              key={business.name}
              initial={{ opacity: 0, scale: 0.94 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.28, delay: index * 0.04 }}
              viewport={{ once: true }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center backdrop-blur transition-colors hover:border-cyan-500/30 hover:bg-white/[0.05]"
            >
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04]">
                <business.icon className="h-5 w-5 text-cyan-300" />
              </div>
              <span className="text-sm font-medium text-white">{business.name}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
