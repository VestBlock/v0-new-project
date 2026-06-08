import Link from "next/link"
import { ArrowRight, Hammer, Home, Landmark, Users } from "lucide-react"
import { MarketingReveal } from "@/components/marketing/reveal"

const paths = [
  {
    label: "Sellers",
    title: "Submit a property",
    body: "Share the address, condition, timeline, and price. We review the situation and route the strongest sale path.",
    href: "/sell",
    cta: "Submit a Property",
    icon: Home,
    accent: "from-cyan-400/15",
    edge: "hover:border-cyan-300/40",
    dot: "bg-cyan-300",
  },
  {
    label: "Buyers",
    title: "Share your buy box",
    body: "Tell us your markets, asset types, price range, and proof. Matching seller opportunities come to you.",
    href: "/buyers",
    cta: "Share Buy Box",
    icon: Users,
    accent: "from-blue-400/15",
    edge: "hover:border-blue-300/40",
    dot: "bg-blue-300",
  },
  {
    label: "Lenders",
    title: "Join the lender network",
    body: "Share your states, loan range, and criteria. Receive routed deals that match what you actually fund.",
    href: "/lenders",
    cta: "Join Lender Network",
    icon: Landmark,
    accent: "from-amber-300/12",
    edge: "hover:border-amber-200/40",
    dot: "bg-amber-200",
  },
  {
    label: "Operators",
    title: "Join the partner network",
    body: "Developers, contractors, and operators share where they fit so the right projects route their way.",
    href: "/get-started",
    cta: "Join Partner Network",
    icon: Hammer,
    accent: "from-violet-400/12",
    edge: "hover:border-violet-300/40",
    dot: "bg-violet-300",
  },
]

export function ChoosePathSection() {
  return (
    <section className="relative px-4 py-20 md:py-28">
      <div className="container mx-auto max-w-7xl">
        <MarketingReveal className="mx-auto mb-12 max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300/80">Choose your path</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-5xl">
            One network. Four ways in.
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-300/90">
            Tell us who you are and you are one click from the right intake — no hunting through menus.
          </p>
        </MarketingReveal>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {paths.map((path, index) => {
            const Icon = path.icon
            return (
              <MarketingReveal key={path.label} delay={index * 0.06}>
                <Link
                  href={path.href}
                  className={`group flex h-full flex-col rounded-[1.6rem] border border-white/10 bg-gradient-to-b ${path.accent} to-white/[0.015] p-6 backdrop-blur-xl transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-1.5 ${path.edge} hover:shadow-[0_28px_70px_rgba(2,6,23,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.05] text-white">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className={`h-2 w-2 rounded-full ${path.dot}`} />
                  </div>
                  <p className="mt-5 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-400">{path.label}</p>
                  <h3 className="mt-1 text-xl font-semibold text-white">{path.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-6 text-slate-300/85">{path.body}</p>
                  <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-cyan-100">
                    {path.cta}
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </Link>
              </MarketingReveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
