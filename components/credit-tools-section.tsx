"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { BriefcaseBusiness, CreditCard, FileText, TrendingUp } from "lucide-react"
import { motion } from "framer-motion"
import Link from "next/link"

const supportModules = [
  {
    label: "Funding preparation",
    description: "Document review, lender context, and clear next steps when a business is moving toward capital conversations.",
    icon: BriefcaseBusiness,
  },
  {
    label: "Credit support",
    description: "Analysis, cleanup planning, and practical next steps when credit is still blocking progress.",
    icon: CreditCard,
  },
  {
    label: "Preparation tools",
    description: "Business setup, document organization, and planning that support the main service you are already using.",
    icon: FileText,
  },
] as const

export function CreditToolsSection() {
  return (
    <section className="px-4 py-16">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          viewport={{ once: true }}
        >
          <Card className="mx-auto max-w-5xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
            <CardContent className="p-8">
              <div className="grid gap-8 lg:grid-cols-[.85fr_1.15fr] lg:items-start">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-cyan-300/80">Extra help</p>
                  <h3 className="mt-3 text-3xl font-semibold text-white">Support services are still here when the work calls for them.</h3>
                  <p className="mt-4 text-sm leading-7 text-slate-400">
                    When a business needs more preparation, VestBlock can still help with funding, credit, and setup. These services support the main job instead of competing with it.
                  </p>
                  <Button variant="outline" asChild className="mt-6 border-white/10 bg-transparent hover:bg-white/[0.04]">
                    <Link href="/services">
                      Compare support services
                      <TrendingUp className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {supportModules.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.05]">
                        <item.icon className="h-5 w-5 text-cyan-300" />
                      </div>
                      <p className="font-medium text-white">{item.label}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  )
}
