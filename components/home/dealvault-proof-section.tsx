import Link from "next/link"
import { ArrowRight, FileCheck, GitBranch, ReceiptText, ShieldCheck } from "lucide-react"
import { MarketingReveal } from "@/components/marketing/reveal"

const features = [
  {
    title: "Agreement records",
    body: "Tamper-evident proof of terms, timestamps, and partner commitments without exposing private documents.",
    icon: FileCheck,
  },
  {
    title: "Payout & split tracking",
    body: "A cleaner ledger for referral, partner, JV, disposition, and operator splits before money becomes a dispute.",
    icon: ReceiptText,
  },
  {
    title: "Milestone trail",
    body: "Seller submissions, funding checkpoints, approvals, and project milestones captured in one verifiable history.",
    icon: GitBranch,
  },
]

export function DealVaultProofSection() {
  return (
    <section className="relative px-4 py-20 md:py-28">
      <div className="container mx-auto max-w-6xl">
        <div className="overflow-hidden rounded-[2rem] border border-violet-300/15 bg-[radial-gradient(circle_at_15%_15%,rgba(139,92,246,0.14),transparent_45%),radial-gradient(circle_at_85%_30%,rgba(34,211,238,0.12),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-7 backdrop-blur-xl md:p-12">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <MarketingReveal>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/25 bg-violet-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-violet-100">
                <ShieldCheck className="h-3.5 w-3.5" />
                DealVault records
              </div>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white md:text-5xl">
                Make every partnership easier to trust.
              </h2>
              <p className="mt-4 max-w-xl text-lg leading-8 text-slate-300/90">
                When a deal moves through sellers, buyers, lenders, operators, or capital partners, DealVault creates
                proof records around agreements, payouts, and milestones so the relationship can scale with less confusion.
                Sensitive documents stay private.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/dealvault/demo"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  See the DealVault Demo
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/dealvault"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                >
                  How it works
                </Link>
              </div>
            </MarketingReveal>

            <MarketingReveal delay={0.1} className="grid gap-3">
              {features.map((feature) => {
                const Icon = feature.icon
                return (
                  <div
                    key={feature.title}
                    className="flex items-start gap-4 rounded-2xl border border-white/10 bg-slate-950/40 p-5 backdrop-blur-xl"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/[0.05] text-cyan-200">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-semibold text-white">{feature.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-300/85">{feature.body}</p>
                    </div>
                  </div>
                )
              })}
            </MarketingReveal>
          </div>
        </div>
      </div>
    </section>
  )
}
