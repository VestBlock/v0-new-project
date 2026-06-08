"use client"

import { motion, useReducedMotion } from "framer-motion"
import { Building2, CircleDollarSign, Handshake, ShieldCheck } from "lucide-react"

const stages = [
  { label: "Share", title: "Sellers & opportunities", body: "Property details, timing, motivation, and deal context enter through a simple review path.", icon: Building2, tint: "text-cyan-200", ring: "border-cyan-300/30" },
  { label: "Meet", title: "Buyers & operators", body: "Buyers and operators see opportunities that fit their markets, asset appetite, and capacity.", icon: Handshake, tint: "text-sky-200", ring: "border-sky-300/30" },
  { label: "Fund", title: "Lenders & capital", body: "Lenders and capital partners receive opportunities aligned with their programs and risk appetite.", icon: CircleDollarSign, tint: "text-amber-200", ring: "border-amber-300/30" },
  { label: "Verify", title: "Proof & records", body: "DealVault helps members keep agreements, milestones, payouts, and proof organized beyond one transaction.", icon: ShieldCheck, tint: "text-emerald-200", ring: "border-emerald-300/30" },
]

export function CapitalFlowSection() {
  const reduce = useReducedMotion()

  return (
    <section className="relative px-4 py-24 md:py-32">
      <div className="container mx-auto max-w-7xl">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="mx-auto mb-16 max-w-2xl text-center"
        >
          <p className="vb-mono text-xs uppercase tracking-[0.28em] text-amber-200/80">How the network moves</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-5xl">
            Start with the role. Move toward the right partner.
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-300/85">
            VestBlock is built for the moments when seller needs, buyer demand, lender programs, operator capacity, and partner trust all need to line up.
          </p>
        </motion.div>

        <div className="relative grid gap-5 lg:grid-cols-4">
          {/* animated flow line (desktop) */}
          <div className="pointer-events-none absolute left-0 right-0 top-1/2 hidden h-[2px] -translate-y-1/2 overflow-hidden rounded-full lg:block">
            <div
              className="h-full w-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(34,211,238,0.6), rgba(56,189,248,0.6), rgba(245,158,11,0.6), rgba(16,185,129,0.6), transparent)",
                backgroundSize: "200% 100%",
                animation: reduce ? "none" : "vb-ticker 6s linear infinite",
              }}
            />
          </div>

          {stages.map((stage, index) => {
            const Icon = stage.icon
            return (
              <motion.div
                key={stage.label}
                initial={reduce ? false : { opacity: 0, y: 24 }}
                whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: index * 0.12 }}
                className="relative"
              >
                <div className="vb-glass relative h-full rounded-[1.6rem] p-6">
                  <div className="mb-5 flex items-center justify-between">
                    <span className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${stage.ring} bg-slate-950/60 ${stage.tint}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="vb-mono text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">
                      0{index + 1} · {stage.label}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-white">{stage.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300/80">{stage.body}</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
