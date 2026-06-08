import { ClipboardCheck, Route, ShieldCheck } from "lucide-react"
import { MarketingReveal } from "@/components/marketing/reveal"

const steps = [
  {
    step: "01",
    title: "Intake",
    body: "Sellers submit properties. Buyers and lenders share criteria. Operators show where they can help.",
    icon: ClipboardCheck,
    tint: "text-cyan-300",
    ring: "border-cyan-300/25",
  },
  {
    step: "02",
    title: "Route",
    body: "We compare the opportunity against market, price, asset type, capital needs, and partner criteria before making introductions.",
    icon: Route,
    tint: "text-blue-300",
    ring: "border-blue-300/25",
  },
  {
    step: "03",
    title: "Verify",
    body: "When a deal moves forward, DealVault can record agreements, payouts, and milestones so the relationship has a clean trail.",
    icon: ShieldCheck,
    tint: "text-violet-300",
    ring: "border-violet-300/25",
  },
]

export function HowRoutingWorksSection() {
  return (
    <section className="relative px-4 py-20 md:py-28">
      <div className="container mx-auto max-w-6xl">
        <MarketingReveal className="mx-auto mb-14 max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300/80">How VestBlock routes deals</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-5xl">
            From intake to the next serious conversation.
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-300/90">
            A clearer path for sellers, buyers, lenders, and operators to understand whether the opportunity is worth pursuing.
          </p>
        </MarketingReveal>

        <div className="relative grid gap-5 md:grid-cols-3">
          {/* connecting line on desktop */}
          <div className="pointer-events-none absolute left-0 right-0 top-[3.25rem] hidden h-px bg-gradient-to-r from-cyan-400/30 via-blue-400/30 to-violet-400/30 md:block" />
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <MarketingReveal key={step.step} delay={index * 0.08}>
                <div className="relative h-full rounded-[1.6rem] border border-white/10 bg-white/[0.025] p-7 backdrop-blur-xl">
                  <div className="mb-6 flex items-center justify-between">
                    <span className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${step.ring} bg-slate-950/60 ${step.tint}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-semibold tracking-[0.2em] text-slate-500">{step.step}</span>
                  </div>
                  <h3 className="text-xl font-semibold text-white">{step.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-300/85">{step.body}</p>
                </div>
              </MarketingReveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
