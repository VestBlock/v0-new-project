import Link from "next/link"
import { ArrowUpRight, Bot, Building, CreditCard, Network } from "lucide-react"
import { MarketingReveal } from "@/components/marketing/reveal"

const services = [
  {
    title: "Partner intake support",
    body: "Strengthen intake, routing, and partner-ready materials when your deal flow needs more structure.",
    href: "/dealflow-growth-system",
    icon: Network,
  },
  {
    title: "AI intake & reception",
    body: "Capture and qualify inbound leads around the clock so none slip through.",
    href: "/ai-assistant",
    icon: Bot,
  },
  {
    title: "Funding & credit prep",
    body: "Organize documents, credit factors, and next steps before you apply.",
    href: "/funding",
    icon: CreditCard,
  },
  {
    title: "Business setup",
    body: "Stand up the entity and foundation behind a serious operation.",
    href: "/business-setup",
    icon: Building,
  },
]

export function SupportServicesSection() {
  return (
    <section className="relative px-4 py-20 md:py-28">
      <div className="container mx-auto max-w-6xl">
        <MarketingReveal className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300/80">Support services</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Support services that strengthen the deal.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-7 text-slate-400">
            Optional services that back up the core network — available when they help a deal move, never in the way of it.
          </p>
        </MarketingReveal>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {services.map((service, index) => {
            const Icon = service.icon
            return (
              <MarketingReveal key={service.title} delay={index * 0.06}>
                <Link
                  href={service.href}
                  className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-xl transition-[transform,border-color] duration-300 hover:-translate-y-1 hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/12 bg-white/[0.05] text-slate-200">
                      <Icon className="h-5 w-5" />
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-slate-500 transition-colors group-hover:text-cyan-200" />
                  </div>
                  <h3 className="mt-5 text-base font-semibold text-white">{service.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{service.body}</p>
                </Link>
              </MarketingReveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
