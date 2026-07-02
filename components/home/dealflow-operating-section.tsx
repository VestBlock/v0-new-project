import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Calculator,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  Handshake,
  Home,
  MapPinned,
  ShieldCheck,
  Users,
} from "lucide-react";

const actionCards = [
  {
    label: "Sellers",
    title: "I have a property to review",
    body: "Start with the address, condition, timeline, and price conversation. VestBlock turns it into a cleaner deal file before outreach begins.",
    href: "/sell",
    cta: "Submit property",
    icon: Home,
    accent: "text-amber-200",
  },
  {
    label: "Buyers",
    title: "Send me deals that fit",
    body: "Share your buy box so we can match you to packets with numbers, photos, risks, rent ranges, and next-step context.",
    href: "/buyers",
    cta: "Join buyer network",
    icon: Users,
    accent: "text-emerald-200",
  },
  {
    label: "Analysis",
    title: "Run the numbers first",
    body: "Use the property analyzer before making an offer, pitching a buyer, or shaping creative terms around a lead.",
    href: "/property-analyzer",
    cta: "Analyze property",
    icon: Calculator,
    accent: "text-cyan-200",
  },
] as const;

const operatingLanes = [
  {
    label: "Seller Intake",
    title: "Capture the real situation",
    body: "Property details, owner timing, repair context, debt pressure, rent support, and missing documents get organized before a weak offer goes out.",
    icon: Home,
    tone: "text-emerald-200",
  },
  {
    label: "Underwriting",
    title: "Turn the file into a decision",
    body: "VestBlock packages comps, rent ranges, repair risk, DSCR paths, creative terms, and buyer-ready numbers into a cleaner review file.",
    icon: ClipboardCheck,
    tone: "text-amber-200",
  },
  {
    label: "Routing",
    title: "Send it to the right lane",
    body: "Wholesale, creative finance, DSCR, builder, landlord, lender, or buyer-network paths stay separated so outreach matches the deal.",
    icon: MapPinned,
    tone: "text-cyan-200",
  },
  {
    label: "Deal Record",
    title: "Keep proof around the deal",
    body: "Buyer packets, partner notes, milestones, assignment records, and payout context stay attached so serious partners can move with confidence.",
    icon: ShieldCheck,
    tone: "text-violet-200",
  },
] as const;

const routes = [
  { from: "Motivated seller", to: "As-is offer or creative terms", status: "seller lane", icon: Home, href: "/sell", cta: "Open intake" },
  { from: "Duplex / small multifamily", to: "Buyer packet + DSCR review", status: "buyer lane", icon: Building2, href: "/property-analyzer", cta: "Run analysis" },
  { from: "Land or teardown", to: "Builder and developer match", status: "builder lane", icon: Users, href: "/get-started", cta: "Join network" },
  { from: "Cash-flow deal", to: "Lender and capital fit", status: "capital lane", icon: CircleDollarSign, href: "/funding", cta: "Review funding" },
] as const;

const proofPoints = [
  "Buyer packets with numbers, ranges, photos, risks, and next steps",
  "Lead source lanes separated by strategy instead of one generic blast",
  "DealVault records for agreements, milestones, and partner accountability",
] as const;

export function DealflowOperatingSection() {
  return (
    <section className="relative overflow-hidden border-y border-white/10 bg-[#07110f] px-4 py-16 text-slate-100 md:py-24">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(21,128,61,0.18),transparent_34%,rgba(245,158,11,0.12)_68%,transparent)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/50 to-transparent" />

      <div className="relative mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
            <BadgeCheck className="h-3.5 w-3.5" />
            Choose your lane
          </div>
          <h2 className="mt-5 text-balance text-3xl font-semibold tracking-tight text-white md:text-5xl">
            Start with the action that matches the deal.
          </h2>
          <p className="mt-5 text-base leading-8 text-slate-300 md:text-lg">
            VestBlock should move visitors fast: sellers submit properties, buyers share criteria, and active leads get analyzed before anyone wastes a conversation.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {actionCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.title}
                href={card.href}
                className="group flex min-h-[17rem] flex-col justify-between border border-white/10 bg-white/[0.035] p-6 transition-colors hover:border-amber-200/45 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
              >
                <span>
                  <span className="mb-5 flex items-center justify-between gap-4">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{card.label}</span>
                    <Icon className={`h-5 w-5 ${card.accent}`} />
                  </span>
                  <span className="block text-xl font-semibold text-white">{card.title}</span>
                  <span className="mt-3 block text-sm leading-6 text-slate-400">{card.body}</span>
                </span>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-amber-200 transition-colors group-hover:text-amber-100">
                  {card.cta}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            );
          })}
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="max-w-2xl">
            <h3 className="text-2xl font-semibold tracking-tight text-white md:text-4xl">
              Every opportunity moves through a clear operating path.
            </h3>
            <p className="mt-5 text-base leading-8 text-slate-300">
              Capture the file, underwrite the numbers, route the strategy, package the opportunity, and keep the record clean enough for buyers, lenders, builders, and partners to act.
            </p>

            <div className="mt-8 space-y-3">
              {proofPoints.map((point) => (
                <div key={point} className="flex items-start gap-3 text-sm leading-6 text-slate-300">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-white/10 bg-black/20 p-4 shadow-[0_30px_100px_rgba(0,0,0,0.28)] md:p-5">
            <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-sm font-semibold text-white">Deal routing board</p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">click a path to move forward</p>
              </div>
              <Handshake className="h-5 w-5 text-emerald-200" />
            </div>

            <div className="space-y-3">
              {routes.map((route) => {
                const Icon = route.icon;
                return (
                  <Link
                    key={`${route.from}-${route.to}`}
                    href={route.href}
                    className="group grid gap-3 border border-white/10 bg-white/[0.035] p-4 transition-colors hover:border-emerald-200/35 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 md:grid-cols-[auto_1fr_auto] md:items-center"
                  >
                    <span className="flex h-10 w-10 items-center justify-center bg-white/[0.06] text-emerald-200">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-white">{route.from}</span>
                      <span className="mt-1 block text-sm text-slate-400">{route.to}</span>
                    </span>
                    <span className="flex w-fit items-center gap-2 bg-amber-300/10 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-amber-100">
                      {route.cta}
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {operatingLanes.map((lane) => {
            const Icon = lane.icon;
            return (
              <div key={lane.label} className="border border-white/10 bg-white/[0.025] p-5">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{lane.label}</p>
                  <Icon className={`h-5 w-5 ${lane.tone}`} />
                </div>
                <h3 className="text-lg font-semibold text-white">{lane.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">{lane.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
