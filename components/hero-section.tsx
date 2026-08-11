"use client"

import dynamic from "next/dynamic"
import Image from "next/image"
import Link from "next/link"
import { ArrowDown, ArrowRight } from "lucide-react"
import { useState } from "react"

import { captureClientEvent } from "@/lib/analytics/client"
import { analyticsEvents } from "@/lib/analytics/events"

import type { CommandRole } from "@/components/vestblock-command-scene"

const VestBlockCommandScene = dynamic(
  () => import("@/components/vestblock-command-scene").then((module) => module.VestBlockCommandScene),
  {
    ssr: false,
    loading: () => <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_45%,rgba(183,255,60,0.08),transparent_34%)]" />,
  },
)

const lanes: Array<{ key: CommandRole; label: string }> = [
  { key: "capital", label: "Capital" },
  { key: "deals", label: "Deals" },
  { key: "opportunity", label: "Opportunity" },
]

export function HeroSection() {
  const [activeLane, setActiveLane] = useState<CommandRole>("deals")

  const track = (event: (typeof analyticsEvents)[keyof typeof analyticsEvents], destination: string, placement: string) => {
    captureClientEvent(event, { destination, placement })
  }

  return (
    <section className="vb-hero relative isolate min-h-[calc(100svh-4rem)] overflow-hidden border-b border-white/10">
      <div className="pointer-events-none absolute inset-0 -z-20">
        <VestBlockCommandScene activeRole={activeLane} />
      </div>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(90deg,#090a08_0%,rgba(9,10,8,0.97)_34%,rgba(9,10,8,0.62)_62%,rgba(9,10,8,0.86)_100%)] lg:bg-[linear-gradient(90deg,#090a08_0%,rgba(9,10,8,0.96)_28%,rgba(9,10,8,0.34)_67%,rgba(9,10,8,0.72)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-t from-[#090a08] to-transparent" />

      <div className="mx-auto grid min-h-[calc(100svh-4rem)] w-full max-w-[1440px] items-center px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(28rem,1.1fr)] lg:px-12 lg:py-20">
        <div className="relative z-10 max-w-3xl">
          <div className="vb-enter flex items-center gap-3.5">
            <Image
              src="/brand/vestblock-monogram.png"
              alt=""
              aria-hidden="true"
              width={72}
              height={72}
              priority
              className="h-14 w-14 object-contain sm:h-16 sm:w-16"
            />
            <div>
              <p className="vb-eyebrow">VestBlock</p>
              <p className="mt-1 text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-[#8f9189]">
                Capital · Deals · Opportunity
              </p>
            </div>
          </div>
          <h1 className="vb-display vb-enter vb-enter-delay-1 mt-5 max-w-[11ch] text-[clamp(3.75rem,8vw,8.25rem)] font-semibold leading-[0.86] tracking-[-0.065em] text-[#f3efe6]">
            Find your next move.
          </h1>
          <p className="vb-enter vb-enter-delay-2 mt-8 max-w-xl text-lg leading-8 text-[#c7c5bd] sm:text-xl sm:leading-9">
            Capital, deals, and opportunities brought together in one network.
          </p>

          <div className="vb-enter vb-enter-delay-3 mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="#paths"
              onMouseEnter={() => setActiveLane("opportunity")}
              onFocus={() => setActiveLane("opportunity")}
              onClick={() => track(analyticsEvents.homepageCtaClicked, "#paths", "hero_primary")}
              className="vb-button vb-button-primary"
            >
              Explore VestBlock
              <ArrowDown className="h-4 w-4" />
            </a>
            <Link
              href="/capital"
              onMouseEnter={() => setActiveLane("capital")}
              onFocus={() => setActiveLane("capital")}
              onClick={() => track(analyticsEvents.capitalFlowStarted, "/capital", "hero_secondary")}
              className="vb-button vb-button-secondary"
            >
              Find capital
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/deals"
              onMouseEnter={() => setActiveLane("deals")}
              onFocus={() => setActiveLane("deals")}
              onClick={() => track(analyticsEvents.dealFlowStarted, "/deals", "hero_text")}
              className="vb-text-link sm:ml-2"
            >
              Find deals
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div
            role="group"
            aria-label="VestBlock network lanes"
            className="vb-enter vb-enter-delay-4 mt-12 flex flex-wrap gap-x-6 gap-y-3 border-t border-white/10 pt-5"
          >
            {lanes.map((lane) => (
              <button
                key={lane.key}
                type="button"
                onMouseEnter={() => setActiveLane(lane.key)}
                onFocus={() => setActiveLane(lane.key)}
                onClick={() => setActiveLane(lane.key)}
                aria-pressed={activeLane === lane.key}
                className="group inline-flex min-h-11 items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#8f9189] transition-colors hover:text-[#f3efe6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b7ff3c] focus-visible:ring-offset-4 focus-visible:ring-offset-[#090a08]"
              >
                <span className={`h-1.5 w-1.5 rounded-full transition-all ${activeLane === lane.key ? "scale-125 bg-[#b7ff3c]" : "bg-[#555850] group-hover:bg-[#8f9189]"}`} />
                {lane.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pointer-events-none min-h-[20rem] lg:min-h-[42rem]" aria-hidden="true" />
      </div>
    </section>
  )
}
