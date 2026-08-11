"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight, MoveDown, Orbit } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { captureClientEvent } from "@/lib/analytics/client"
import { analyticsEvents } from "@/lib/analytics/events"

type LaneKey = "capital" | "deals" | "opportunity"

const lanes: Array<{ key: LaneKey; label: string; descriptor: string; index: string }> = [
  { key: "capital", label: "Capital", descriptor: "Funding paths", index: "01" },
  { key: "deals", label: "Deals", descriptor: "Property intelligence", index: "02" },
  { key: "opportunity", label: "Opportunity", descriptor: "Growth resources", index: "03" },
]

const laneEvents = {
  capital: analyticsEvents.capitalFlowStarted,
  deals: analyticsEvents.dealFlowStarted,
  opportunity: analyticsEvents.opportunityFlowStarted,
} as const

export function HeroSection() {
  const stageRef = useRef<HTMLElement>(null)
  const [activeLane, setActiveLane] = useState<LaneKey>("deals")

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    let frame = 0
    const updateProgress = () => {
      frame = 0
      const bounds = stage.getBoundingClientRect()
      const travel = Math.max(1, bounds.height - window.innerHeight)
      const progress = Math.min(1, Math.max(0, -bounds.top / travel))
      stage.style.setProperty("--hero-progress", progress.toFixed(4))
      stage.style.setProperty("--hero-tilt", `${(progress * 8 - 2).toFixed(2)}deg`)
      stage.style.setProperty("--hero-depth", `${(progress * -34).toFixed(2)}px`)
    }
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(updateProgress)
    }
    updateProgress()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  const selectedLane = lanes.find((lane) => lane.key === activeLane) || lanes[1]
  const track = (event: (typeof analyticsEvents)[keyof typeof analyticsEvents], destination: string, placement: string) => {
    captureClientEvent(event, { destination, placement })
  }

  const selectLane = (lane: LaneKey) => {
    setActiveLane(lane)
    track(laneEvents[lane], `/${lane === "opportunity" ? "opportunities" : lane}`, "hero_lane_selector")
  }

  return (
    <section ref={stageRef} className="vb-hero-stage relative isolate overflow-hidden border-b border-white/10" aria-labelledby="hero-title">
      <div className="vb-hero-aurora" aria-hidden="true" />
      <div className="vb-hero-grid" aria-hidden="true" />

      <div className="vb-hero-inner mx-auto grid w-full max-w-[1520px] items-center gap-12 px-5 pb-14 pt-12 sm:px-8 sm:pb-16 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[minmax(0,0.86fr)_minmax(32rem,1.14fr)] lg:gap-8 lg:px-14 lg:py-16">
        <div className="relative z-10 max-w-2xl">
          <div className="vb-hero-kicker vb-reveal flex items-center gap-3">
            <span className="vb-kicker-mark"><span /></span>
            <span>VestBlock / operating network</span>
            <span className="hidden text-[#60645a] sm:inline">2026</span>
          </div>

          <h1 id="hero-title" className="vb-hero-title vb-reveal vb-reveal-1 mt-8 max-w-[8.5ch]">
            Find the move before it becomes obvious.
          </h1>
          <p className="vb-hero-lede vb-reveal vb-reveal-2 mt-7 max-w-xl">
            Capital, property intelligence, and practical opportunity paths connected around the decision in front of you.
          </p>

          <div className="vb-reveal vb-reveal-3 mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
            <a
              href="#paths"
              onClick={() => track(analyticsEvents.homepageCtaClicked, "#paths", "hero_primary")}
              className="vb-button vb-button-primary vb-button-command"
            >
              Choose a direction
              <ArrowRight className="h-4 w-4" />
            </a>
            <Link href="/get-started" className="vb-text-link">
              Start with your situation
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="vb-reveal vb-reveal-4 mt-12 border-t border-white/10 pt-5">
            <div className="flex items-center justify-between gap-4">
              <p className="vb-hero-microcopy">Three lanes / one connected decision system</p>
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-[#666b60]">Scroll to inspect</span>
            </div>
            <div role="group" aria-label="VestBlock lanes" className="mt-4 grid grid-cols-3 gap-2">
              {lanes.map((lane) => (
                <button
                  key={lane.key}
                  type="button"
                  onMouseEnter={() => setActiveLane(lane.key)}
                  onFocus={() => setActiveLane(lane.key)}
                  onClick={() => selectLane(lane.key)}
                  aria-pressed={activeLane === lane.key}
                  className={`vb-lane-tab ${activeLane === lane.key ? "is-active" : ""}`}
                >
                  <span>{lane.index}</span>
                  <strong>{lane.label}</strong>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="vb-hero-object-wrap relative mx-auto w-full max-w-[44rem]" data-active-lane={activeLane}>
          <div className="vb-hero-object-meta vb-hero-object-meta-top" aria-hidden="true">
            <span>VB / SYSTEM CORE</span>
            <span>01 — 03</span>
          </div>

          <div className="vb-hero-object-stage" aria-label={`VestBlock ${selectedLane.label}: ${selectedLane.descriptor}`} role="img">
            <div className="vb-object-backdrop" aria-hidden="true" />
            <div className="vb-object-grid" aria-hidden="true" />
            <div className="vb-object-rings" aria-hidden="true">
              <span /><span /><span /><span />
            </div>
            <div className="vb-object-axis vb-object-axis-x" aria-hidden="true" />
            <div className="vb-object-axis vb-object-axis-y" aria-hidden="true" />

            <div className="vb-monogram-object" aria-hidden="true">
              <div className="vb-monogram-depth vb-monogram-depth-3"><Image src="/brand/vestblock-monogram.png" alt="" fill sizes="28rem" /></div>
              <div className="vb-monogram-depth vb-monogram-depth-2"><Image src="/brand/vestblock-monogram.png" alt="" fill sizes="28rem" /></div>
              <div className="vb-monogram-depth vb-monogram-depth-1"><Image src="/brand/vestblock-monogram.png" alt="" fill sizes="28rem" /></div>
              <div className="vb-monogram-face"><Image src="/brand/vestblock-monogram.png" alt="VestBlock VB monogram" fill sizes="28rem" priority /></div>
              <div className="vb-monogram-sheen" />
            </div>

            <div className="vb-object-callout vb-object-callout-capital"><span className="vb-callout-line" /><span>01 / CAPITAL</span><small>Access</small></div>
            <div className="vb-object-callout vb-object-callout-deals"><span className="vb-callout-line" /><span>02 / DEALS</span><small>Analyze</small></div>
            <div className="vb-object-callout vb-object-callout-opportunity"><span className="vb-callout-line" /><span>03 / OPPORTUNITY</span><small>Advance</small></div>

            <div className="vb-object-readout" aria-hidden="true">
              <Orbit className="h-3.5 w-3.5 text-[#b7ff3c]" />
              <span>{selectedLane.label} lane active</span>
              <i />
            </div>
          </div>

          <div className="vb-hero-object-caption">
            <div>
              <span className="vb-hero-caption-index">{selectedLane.index}</span>
              <strong>{selectedLane.label}</strong>
            </div>
            <p>{selectedLane.descriptor} / selected</p>
            <MoveDown className="h-4 w-4 text-[#b7ff3c]" />
          </div>
          <div className="vb-hero-object-meta vb-hero-object-meta-bottom" aria-hidden="true">
            <span>Depth / material / signal</span>
            <span>VestBlock LLC</span>
          </div>
        </div>

        <a href="#paths" className="vb-hero-scroll-cue" aria-label="Scroll to choose a VestBlock direction">
          <span className="vb-scroll-cue-ring"><i /></span>
          <span>Scroll to enter</span>
        </a>
      </div>
    </section>
  )
}
