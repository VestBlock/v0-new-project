import { Banknote, Building2, HardHat, Handshake, Home, Users } from "lucide-react"
import { MarketingReveal } from "@/components/marketing/reveal"

const members = [
  { label: "Cash & investor buyers", icon: Users },
  { label: "Private & hard money lenders", icon: Banknote },
  { label: "Developers & builders", icon: Building2 },
  { label: "Contractors & rehab teams", icon: HardHat },
  { label: "Property sellers", icon: Home },
  { label: "Referral & service partners", icon: Handshake },
]

export function NetworkMembersSection() {
  return (
    <section className="relative px-4 py-20 md:py-28">
      <div className="container mx-auto max-w-6xl">
        <MarketingReveal className="mx-auto mb-12 max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300/80">Network members</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-5xl">
            Built for everyone in the deal.
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-300/90">
            VestBlock brings the whole transaction onto one network, so the right people meet the right deals.
          </p>
        </MarketingReveal>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
          {members.map((member, index) => {
            const Icon = member.icon
            return (
              <MarketingReveal key={member.label} delay={index * 0.05}>
                <div className="flex h-full items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5 backdrop-blur-xl transition-colors duration-300 hover:border-cyan-300/30">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/[0.05] text-cyan-200">
                    <Icon className="h-5 w-5" />
                  </span>
                  <p className="text-sm font-medium leading-5 text-white sm:text-base">{member.label}</p>
                </div>
              </MarketingReveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
