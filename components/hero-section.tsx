"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowDown, ArrowRight } from "lucide-react"
import { useState } from "react"

import { captureClientEvent } from "@/lib/analytics/client"
import { analyticsEvents } from "@/lib/analytics/events"

type LaneKey = "capital" | "deals" | "opportunity"

const lanes: Array<{ key: LaneKey; label: string; detail: string }> = [
  { key: "capital", label: "Capital", detail: "Funding paths and capital partners" },
  { key: "deals", label: "Deals", detail: "Property discovery, analysis, and records" },
  { key: "opportunity", label: "Opportunity", detail: "Grants, resources, and growth support" },
]

export function HeroSection() {
  const [activeLane, setActiveLane] = useState<LaneKey>("deals")
  const selectedLane = lanes.find((lane) => lane.key === activeLane) || lanes[1]

  const track = (event: (typeof analyticsEvents)[keyof typeof analyticsEvents], destination: string, placement: string) => {
    captureClientEvent(event, { destination, placement })
  }

  return (
    <section className="vb-hero relative isolate overflow-hidden border-b border-white/10 bg-[#090a08]">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_78%_38%,rgba(183,255,60,0.12),transparent_25%),linear-gradient(135deg,rgba(255,255,255,0.025),transparent_42%)]" />

      <div className="mx-auto grid min-h-[calc(100svh-4rem)] w-full max-w-[1440px] items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(26rem,0.8fr)] lg:gap-16 lg:px-12 lg:py-20">
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

        <div className="relative mx-auto flex w-full max-w-[34rem] flex-col items-center lg:justify-self-end" aria-label={`VestBlock ${selectedLane.label} lane: ${selectedLane.detail}`}>
          <div className="relative flex aspect-square w-full max-w-[27rem] items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[radial-gradient(circle,rgba(183,255,60,0.12),rgba(14,17,13,0.72)_52%,rgba(9,10,8,0)_72%)]">
            <div className="absolute inset-[12%] rounded-full border border-[#b7ff3c]/15" />
            <div className="absolute inset-[23%] rounded-full border border-white/10" />
            <Image
              src="/brand/vestblock-monogram.png"
              alt="VestBlock VB monogram"
              width={720}
              height={720}
              priority
              className="relative z-10 h-auto w-[68%] object-contain drop-shadow-[0_22px_42px_rgba(0,0,0,0.65)]"
            />
          </div>

          <div className="-mt-[9%] w-[78%]" aria-hidden="true">
            <div className="h-2 rounded-[50%] border border-[#b7ff3c]/40 bg-[#b7ff3c]/15 shadow-[0_0_34px_rgba(183,255,60,0.28)]" />
            <div className="mx-auto h-10 w-[68%] bg-gradient-to-b from-[#11140f] to-transparent [clip-path:polygon(8%_0,92%_0,100%_100%,0_100%)]" />
          </div>

          <div className="mt-2 grid w-full min-w-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-y border-white/10 py-4 text-center">
            <span className="h-px bg-gradient-to-r from-transparent to-[#b7ff3c]/60" />
            <div className="min-w-0 px-2">
              <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[#b7ff3c]">{selectedLane.label}</p>
              <p className="mt-1 text-xs text-[#aaa9a2]">{selectedLane.detail}</p>
            </div>
            <span className="h-px bg-gradient-to-l from-transparent to-[#b7ff3c]/60" />
          </div>
        </div>
      </div>
    </section>
  )
}
