import Link from "next/link"
import { ArrowRight, Home } from "lucide-react"
import { MarketingReveal } from "@/components/marketing/reveal"

export function FinalCtaSection() {
  return (
    <section className="relative px-4 pb-28 pt-10 md:pb-36">
      <div className="container mx-auto max-w-5xl">
        <MarketingReveal>
          <div className="relative overflow-hidden rounded-[2rem] border border-white/12 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.18),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] px-6 py-14 text-center backdrop-blur-xl md:px-12 md:py-20">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent" />
            <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight text-white md:text-5xl">
              Find your place in the deal network.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-slate-300/90">
              Tell us who you are and we will route you to the right intake in seconds.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/get-started"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-6 py-3.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto"
              >
                Choose My Path
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/sell"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:w-auto"
              >
                <Home className="h-4 w-4" />
                Submit a Property
              </Link>
            </div>
          </div>
        </MarketingReveal>
      </div>
    </section>
  )
}
