"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import {
  ArrowRight,
  Briefcase,
  Building2,
  CircleDollarSign,
  Home,
  Landmark,
  Repeat,
  Users,
} from "lucide-react"

const roles = [
  { label: "Sellers", body: "Submit a property and review possible paths without guessing who to call first.", href: "/sell", icon: Home },
  { label: "Buyers", body: "Share your buy box and review opportunities aligned with your acquisition criteria.", href: "/buyers", icon: Users },
  { label: "Wholesalers", body: "Move inventory toward qualified buyers, lenders, and clearer partner conversations.", href: "/get-started", icon: Repeat },
  { label: "Investors", body: "Source on-criteria opportunities and stay close to the markets, assets, and partners that fit your lane.", href: "/buyers", icon: Building2 },
  { label: "Acquisition teams", body: "Keep criteria, partner introductions, and deal records easier to manage.", href: "/get-started", icon: Briefcase },
  { label: "Lenders", body: "Join the lender network and receive opportunities that fit your lending box.", href: "/lenders", icon: Landmark },
  { label: "Developers & contractors", body: "Share capacity, markets, project fit, and partnership criteria.", href: "/get-started", icon: CircleDollarSign },
]

export function NetworkSection() {
  const reduce = useReducedMotion()

  return (
    <section className="relative px-4 py-24 md:py-32">
      <div className="container mx-auto max-w-7xl">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="mx-auto mb-14 max-w-2xl text-center"
        >
          <p className="vb-mono text-xs uppercase tracking-[0.28em] text-amber-200/80">The partner ecosystem</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-5xl">
            One place for the people who move real estate.
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-300/85">
            Sellers, buyers, lenders, capital partners, developers, contractors, and operators get clearer paths to the
            right conversations without digging through unrelated services.
          </p>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {roles.map((role, index) => {
            const Icon = role.icon
            return (
              <motion.div
                key={role.label}
                initial={reduce ? false : { opacity: 0, y: 20 }}
                whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.45, delay: (index % 4) * 0.06 }}
              >
                <Link
                  href={role.href}
                  className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] p-6 backdrop-blur-xl transition-[transform,border-color] duration-300 hover:-translate-y-1.5 hover:border-cyan-300/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                >
                  <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-cyan-400/10 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/12 bg-white/[0.05] text-cyan-200">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold text-white">{role.label}</h3>
                  <p className="mt-2 flex-1 text-sm leading-6 text-slate-300/80">{role.body}</p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-cyan-100">
                    Start
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </Link>
              </motion.div>
            )
          })}

          {/* CTA tile to balance the 7-role grid to 8 cells */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 20 }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.45, delay: 0.18 }}
          >
            <Link
              href="/get-started"
              className="group flex h-full flex-col justify-between rounded-2xl border border-cyan-300/25 bg-gradient-to-br from-cyan-400/15 to-amber-300/10 p-6 backdrop-blur-xl transition-transform duration-300 hover:-translate-y-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              <span className="vb-mono text-[0.65rem] uppercase tracking-[0.2em] text-cyan-100/90">Start with your role</span>
              <span className="mt-6 text-xl font-semibold leading-6 text-white">
                Join the partner network.
              </span>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white">
                Share your role
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
