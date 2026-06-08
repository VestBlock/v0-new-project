"use client"

import { motion } from "framer-motion"
import {
  Building2,
  HandCoins,
  Hammer,
  Home,
  KeyRound,
  Landmark,
  MapPinned,
  Users,
} from "lucide-react"

const businessTypes = [
  { name: "Investor teams", icon: Building2 },
  { name: "Cash buyers", icon: HandCoins },
  { name: "Private lenders", icon: Landmark },
  { name: "Developers", icon: Building2 },
  { name: "Construction companies", icon: Hammer },
  { name: "Rehab operators", icon: Hammer },
  { name: "Rental buyers", icon: KeyRound },
  { name: "Property managers", icon: Home },
  { name: "Referral partners", icon: Users },
  { name: "Disposition teams", icon: MapPinned },
] as const

export function BusinessTypesGrid() {
  return (
    <section className="px-4 py-14 md:py-20">
      <div className="container mx-auto">
        <div className="mx-auto mb-8 max-w-3xl text-center md:mb-12">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">Network fit</p>
          <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl md:text-5xl">Built for real estate teams that need cleaner deal movement.</h2>
          <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base md:text-lg md:leading-8">
            VestBlock is strongest when sellers, buyers, lenders, developers, contractors, and operators need a clearer way to share criteria, route opportunities, and keep proof around the deal path.
          </p>
        </div>

        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {businessTypes.map((business) => (
            <motion.div
              key={business.name}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.25 }}
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
