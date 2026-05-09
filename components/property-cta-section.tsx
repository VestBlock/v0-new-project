"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight, ReceiptText, ShieldCheck, Waypoints } from "lucide-react"
import { motion } from "framer-motion"
import Link from "next/link"

export function PropertyCTASection() {
  return (
    <section className="px-4 py-12">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          viewport={{ once: true }}
        >
          <Card className="mx-auto max-w-5xl overflow-hidden border border-cyan-500/20 bg-[linear-gradient(135deg,rgba(6,24,36,0.96),rgba(8,13,22,0.94))] shadow-[0_30px_80px_rgba(3,7,18,0.55)]">
            <CardContent className="p-0">
              <div className="grid gap-0 lg:grid-cols-[1.15fr_.85fr]">
                <div className="space-y-6 p-8 md:p-10">
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/8 px-3 py-1 text-sm text-cyan-100">
                    <ShieldCheck className="h-4 w-4 text-cyan-400" />
                    Live on Polygon
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-3xl font-semibold text-white md:text-4xl">
                      DealVault gives deal-driven businesses a more credible operating layer.
                    </h3>
                    <p className="max-w-2xl text-base leading-8 text-slate-300">
                      Use DealVault for agreement tracking, proof records, referral payout visibility, and milestone accountability while keeping private documents off-chain.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-cyan-500/10">
                        <ReceiptText className="h-5 w-5 text-cyan-300" />
                      </div>
                      <p className="font-medium text-white">Proof and payout records</p>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        Clean agreement history, payout logic, and partner visibility without exposing raw deal files on-chain.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-cyan-500/10">
                        <Waypoints className="h-5 w-5 text-cyan-300" />
                      </div>
                      <p className="font-medium text-white">Milestones and audit trails</p>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        Track project milestones, proof submissions, and status changes with dashboard-ready activity and certificate output.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/10 bg-black/20 p-8 md:p-10 lg:border-l lg:border-t-0">
                  <p className="text-sm font-medium uppercase tracking-[0.22em] text-slate-400">Start here</p>
                  <div className="mt-5 space-y-3">
                    <Button size="lg" asChild className="w-full bg-cyan-500 text-slate-950 hover:bg-cyan-400">
                      <Link href="/dealvault/demo">
                        See DealVault Demo
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                    <Button variant="outline" size="lg" asChild className="w-full border-white/10 bg-white/[0.03] hover:bg-white/[0.06]">
                      <Link href="/pricing">
                        Review Pricing
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="lg" asChild className="w-full justify-start px-0 text-slate-300 hover:bg-transparent hover:text-white">
                      <Link href="/real-estate-funding">Need a funding conversation instead?</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  )
}
