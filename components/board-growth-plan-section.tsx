"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  Handshake,
  Network,
  ShieldCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"

const trustLayerItems = [
  {
    title: "Deal Trust Snapshot",
    body: "Summarize property details, document status, missing items, and next steps so each deal is easier to review.",
    icon: ShieldCheck,
  },
  {
    title: "Verified Buyer Criteria",
    body: "Keep buyer and lender criteria organized around markets, asset appetite, proof of funds, close speed, and relationship fit.",
    icon: Network,
  },
  {
    title: "Payout And Milestone Trail",
    body: "Give partners a clear record of referral, JV, milestone, and payout expectations before confusion becomes expensive.",
    icon: Handshake,
  },
  {
    title: "Human Review Before Outreach",
    body: "Keep relationship messages reviewed by a person until criteria, relationship quality, and deliverability are ready to expand.",
    icon: ClipboardCheck,
  },
] as const

const focusItems = [
  "Lead the website with real estate deal flow.",
  "Use trust records to support the deal, not distract from it.",
  "Keep support services visible but secondary.",
  "Let DealVault remain the accountability product.",
] as const

export function BoardGrowthPlanSection() {
  return (
    <section className="px-4 py-14 md:py-20">
      <div className="container mx-auto">
        <div className="premium-section overflow-hidden p-5 md:p-8">
          <div className="grid gap-8 lg:grid-cols-[.92fr_1.08fr] lg:items-start">
            <motion.div
              whileHover={{ y: -4 }}
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-sm text-cyan-100">
                <Building2 className="h-4 w-4 text-cyan-300" />
                Partner-ready records
              </div>
              <div>
                <h2 className="text-2xl font-semibold leading-tight text-white sm:text-3xl md:text-5xl">
                  Better records make every seller, buyer, and lender conversation easier.
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-300 md:text-base md:leading-8">
                  VestBlock keeps the focus on seller review, buyer criteria, lender fit, and DealVault records. Trust snapshots, verified criteria, and payout trails sit underneath each deal so serious partners can review the opportunity with more confidence.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
                  <Link href="/dealflow-growth-system">
                    View DealFlow Support
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-white/10 bg-white/[0.03] hover:bg-white/[0.06]">
                  <Link href="/proof">Open Record Library</Link>
                </Button>
              </div>
            </motion.div>

            <div className="grid gap-4 md:grid-cols-2">
              {trustLayerItems.map((motionItem) => {
                const Icon = motionItem.icon

                return (
                  <motion.div
                    key={motionItem.title}
                    whileHover={{ y: -4 }}
                    transition={{ duration: 0.25 }}
                    className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"
                  >
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10">
                      <Icon className="h-5 w-5 text-cyan-300" />
                    </div>
                    <h3 className="text-base font-semibold text-white">{motionItem.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{motionItem.body}</p>
                  </motion.div>
                )
              })}
            </div>
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-4">
            {focusItems.map((decision) => (
              <div key={decision} className="rounded-xl border border-cyan-500/15 bg-cyan-500/[0.04] p-4">
                <p className="text-sm leading-6 text-slate-300">{decision}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
