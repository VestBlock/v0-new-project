"use client"

import { motion, useReducedMotion } from "framer-motion"
import { Activity, Database, Layers, MapPin, ShieldCheck } from "lucide-react"

const partnerView = [
  { stage: "Shared", status: "Received", tint: "text-cyan-200", bar: "78%" },
  { stage: "Reviewed", status: "Partner fit", tint: "text-sky-200", bar: "61%" },
  { stage: "Introduced", status: "In motion", tint: "text-amber-200", bar: "44%" },
  { stage: "Recorded", status: "DealVault", tint: "text-emerald-200", bar: "29%" },
]

const coverage = ["Sun Belt", "Midwest", "Southeast", "Mountain West", "Texas Triangle", "Carolinas"]

export function IntelligenceSection() {
  const reduce = useReducedMotion()

  return (
    <section className="relative px-4 py-24 md:py-32">
      <div className="container mx-auto max-w-7xl">
        <div className="grid items-center gap-12 lg:grid-cols-[0.92fr_1.08fr]">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 20 }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
          >
            <p className="vb-mono text-xs uppercase tracking-[0.28em] text-cyan-200/80">A clearer partner view</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-5xl">
              See who should be in the conversation.
            </h2>
            <p className="mt-4 max-w-xl text-lg leading-8 text-slate-300/85">
              VestBlock organizes scattered real estate conversations so the right people can understand the opportunity,
              review the fit, document important records, and move the deal forward with cleaner next steps.
            </p>
            <ul className="mt-8 space-y-4">
              {[
                { icon: Layers, text: "One clear entry path for sellers, buyers, lenders, developers, contractors, and operators" },
                { icon: Activity, text: "Warm partner introductions based on market, asset type, capital needs, and capacity" },
                { icon: ShieldCheck, text: "DealVault records for proof, accountability, and follow-through" },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.text} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.05] text-cyan-200">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-sm leading-7 text-slate-300/85">{item.text}</span>
                  </li>
                )
              })}
            </ul>
          </motion.div>

          {/* Glass partner panel */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 28, scale: 0.98 }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="vb-glass rounded-[1.75rem] p-4 md:p-5"
          >
            {/* panel chrome */}
            <div className="flex items-center justify-between border-b border-white/10 px-2 pb-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
              </div>
              <span className="vb-mono text-[0.65rem] uppercase tracking-[0.22em] text-slate-500">
                vestblock · partner view
              </span>
              <Database className="h-3.5 w-3.5 text-slate-500" />
            </div>

            <div className="grid gap-4 p-2 pt-4 sm:grid-cols-2">
              {/* opportunity panel */}
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 sm:col-span-2">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">Opportunity path</span>
                  <span className="vb-mono text-[0.6rem] uppercase tracking-[0.2em] text-slate-500">active</span>
                </div>
                <div className="space-y-3">
                  {partnerView.map((row, i) => (
                    <div key={row.stage} className="flex items-center gap-3">
                      <span className="w-20 vb-mono text-[0.7rem] uppercase tracking-[0.12em] text-slate-400">{row.stage}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <motion.div
                          initial={reduce ? false : { width: 0 }}
                          whileInView={reduce ? undefined : { width: row.bar }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.9, delay: 0.2 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                          className="h-full rounded-full bg-gradient-to-r from-cyan-400/70 to-amber-300/70"
                          style={reduce ? { width: row.bar } : undefined}
                        />
                      </div>
                      <span className={`w-20 text-right vb-mono text-[0.62rem] uppercase tracking-[0.12em] ${row.tint}`}>{row.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* coverage panel */}
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-cyan-200" />
                  <span className="text-sm font-semibold text-white">Markets + coverage</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {coverage.map((region) => (
                    <span key={region} className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 vb-mono text-[0.6rem] uppercase tracking-[0.1em] text-slate-300/80">
                      {region}
                    </span>
                  ))}
                </div>
              </div>

              {/* integrity panel with decorative sparkline */}
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-200" />
                  <span className="text-sm font-semibold text-white">Proof profile</span>
                </div>
                <svg viewBox="0 0 200 56" className="h-14 w-full" aria-hidden="true">
                  <defs>
                    <linearGradient id="vbspark" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#22d3ee" />
                      <stop offset="100%" stopColor="#f59e0b" />
                    </linearGradient>
                  </defs>
                  <polyline
                    fill="none"
                    stroke="url(#vbspark)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points="0,44 24,40 48,42 72,30 96,34 120,20 144,24 168,12 200,16"
                  />
                </svg>
                <p className="mt-1 vb-mono text-[0.58rem] uppercase tracking-[0.14em] text-slate-500">
                  deal record view
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
