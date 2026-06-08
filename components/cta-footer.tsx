"use client"

import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

export function CTAFooter() {
  return (
    <section className="px-4 py-14 md:py-20">
      <div className="container mx-auto">
        <div className="premium-section premium-gold-edge relative overflow-hidden px-5 py-10 text-center md:px-8 md:py-14">
          <div className="pointer-events-none absolute -left-24 top-10 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 bottom-0 h-56 w-56 rounded-full bg-amber-300/10 blur-3xl" />
          <div className="relative">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">Final step</p>
          <h2 className="mx-auto mt-4 max-w-4xl text-3xl font-semibold leading-tight text-white md:text-5xl">
            Bring the next real estate opportunity into the right lane.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-slate-300 md:text-lg md:leading-8">
            Start with a seller, buyer, lender, project partner, or DealVault path, then add more support only when the deal calls for it.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
              <Link href="/get-started">
                Choose My Path
                <ArrowRight className="ml-2 h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/10 bg-white/[0.03] hover:bg-white/[0.06]">
              <Link href="/sell">Submit Property</Link>
            </Button>
          </div>
          </div>
        </div>

        <footer className="mt-16 border-t border-border pt-8">
          <div className="container mx-auto text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} VestBlock. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </section>
  )
}
