"use client"

import dynamic from "next/dynamic"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, MoveDown } from "lucide-react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { useEffect, useRef, useState } from "react"

import { captureClientEvent } from "@/lib/analytics/client"
import { analyticsEvents } from "@/lib/analytics/events"

const HeroFilm = dynamic(
  () => import("@/components/hero-film").then((module) => module.HeroFilm),
  {
    ssr: false,
    loading: () => <div className="vb-hero-film-loading" aria-hidden="true" />,
  },
)

type LaneKey = "capital" | "deals" | "opportunity"

type SceneBeat = {
  number: string
  label: string
  statement: string
  detail: string
}

const lanes: Array<{ key: LaneKey; label: string; descriptor: string; index: string }> = [
  { key: "capital", label: "Capital", descriptor: "Funding paths", index: "01" },
  { key: "deals", label: "Deals", descriptor: "Property intelligence", index: "02" },
  { key: "opportunity", label: "Opportunity", descriptor: "Growth resources", index: "03" },
]

const sceneBeats: SceneBeat[] = [
  {
    number: "01",
    label: "Property signal",
    statement: "Find the move before it becomes obvious.",
    detail: "A property, a capital question, or an opportunity begins with a signal worth keeping.",
  },
  {
    number: "02",
    label: "Discovery",
    statement: "A property is more than a listing.",
    detail: "Bring the parcel, the facts, and the people around it into the same field of view.",
  },
  {
    number: "03",
    label: "Analysis",
    statement: "See the evidence before the call.",
    detail: "The useful facts surface before the next conversation asks for them.",
  },
  {
    number: "04",
    label: "Capital route",
    statement: "Route capital around real conditions.",
    detail: "Capital, deals, and opportunity stay connected to the decision that gave them meaning.",
  },
  {
    number: "05",
    label: "Connected network",
    statement: "Keep the facts with the move.",
    detail: "The right partners, funding path, and property context stay connected as the decision changes shape.",
  },
  {
    number: "06",
    label: "DealVault",
    statement: "Protect the record. Move the deal.",
    detail: "Evidence, milestones, and private context compress into an actionable system of record.",
  },
  {
    number: "07",
    label: "Platform entry",
    statement: "Enter with the next move visible.",
    detail: "Choose the direction that fits your situation. VestBlock keeps the context with the move.",
  },
]

const laneEvents = {
  capital: analyticsEvents.capitalFlowStarted,
  deals: analyticsEvents.dealFlowStarted,
  opportunity: analyticsEvents.opportunityFlowStarted,
} as const

function sceneForProgress(progress: number) {
  return Math.min(sceneBeats.length - 1, Math.floor(progress * sceneBeats.length))
}

export function HeroSection() {
  const stageRef = useRef<HTMLElement>(null)
  const progressRef = useRef(0)
  const pointerRef = useRef({ x: 0, y: 0 })
  const [activeLane, setActiveLane] = useState<LaneKey>("deals")
  const [sceneIndex, setSceneIndex] = useState(0)

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    gsap.registerPlugin(ScrollTrigger)
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const updateProgress = (progress: number) => {
      const clampedProgress = Math.min(1, Math.max(0, progress))
      progressRef.current = clampedProgress
      stage.style.setProperty("--hero-progress", clampedProgress.toFixed(4))
      stage.style.setProperty("--hero-tilt", `${(clampedProgress * 7 - 2).toFixed(2)}deg`)
      stage.style.setProperty("--hero-depth", `${(clampedProgress * -20).toFixed(2)}px`)
      const nextScene = sceneForProgress(clampedProgress)
      setSceneIndex((currentScene) => (currentScene === nextScene ? currentScene : nextScene))
    }

    if (reducedMotion.matches) {
      updateProgress(0)
      return
    }

    const trigger = ScrollTrigger.create({
      trigger: stage,
      start: "top top+=64",
      end: "bottom bottom",
      invalidateOnRefresh: true,
      onUpdate: (self) => updateProgress(self.progress),
      onRefresh: (self) => updateProgress(self.progress),
    })

    return () => trigger.kill()
  }, [])

  const currentScene = sceneBeats[sceneIndex]
  const selectedLane = lanes.find((lane) => lane.key === activeLane) || lanes[1]
  const track = (event: (typeof analyticsEvents)[keyof typeof analyticsEvents], destination: string, placement: string) => {
    captureClientEvent(event, { destination, placement })
  }

  const selectLane = (lane: LaneKey) => {
    setActiveLane(lane)
    track(laneEvents[lane], `/${lane === "opportunity" ? "opportunities" : lane}`, "hero_lane_selector")
  }

  return (
    <section
      ref={stageRef}
      className="vb-hero-stage relative isolate overflow-clip border-b border-white/10"
      aria-labelledby="hero-title"
      onPointerMove={(event) => {
        pointerRef.current = {
          x: event.clientX / Math.max(window.innerWidth, 1) - 0.5,
          y: event.clientY / Math.max(window.innerHeight, 1) - 0.5,
        }
      }}
      onPointerLeave={() => {
        pointerRef.current = { x: 0, y: 0 }
      }}
    >
      <div className="vb-hero-film-field" aria-hidden="true" />
      <HeroFilm progressRef={progressRef} pointerRef={pointerRef} activeLane={activeLane} />
      <div className="vb-hero-mark-mask" aria-hidden="true">
        <Image src="/brand/vestblock-monogram.png" alt="" fill priority sizes="(min-width: 1024px) 42vw, 0px" />
      </div>

      <div className="vb-hero-pin">
        <div className="vb-hero-inner mx-auto w-full max-w-[1520px] px-5 sm:px-8 lg:px-14">
          <div className="vb-hero-copy relative z-10 max-w-2xl">
            <div className="vb-hero-kicker flex items-center gap-3">
              <span className="vb-kicker-mark"><span /></span>
              <span>VestBlock / decision infrastructure</span>
              <span className="hidden text-[#60645a] sm:inline">LLC</span>
            </div>

            <div className="vb-hero-scene-heading mt-8" aria-live="polite">
              <p className="vb-hero-scene-label"><span>{currentScene.number}</span><i />{currentScene.label}</p>
              <h1 id="hero-title" className="vb-hero-title">
                <span key={currentScene.number} className="vb-hero-title-mask">{currentScene.statement}</span>
              </h1>
              <p key={`${currentScene.number}-detail`} className="vb-hero-lede vb-hero-scene-detail mt-7 max-w-xl">
                {currentScene.detail}
              </p>
            </div>

            <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
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

            <div className="mt-10 border-t border-white/10 pt-5">
              <div className="flex items-center justify-between gap-4">
                <p className="vb-hero-microcopy">One decision system / three operating lanes</p>
                <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-[#666b60]">Scroll to direct</span>
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

          <aside className="vb-hero-spatial-readout" aria-label={`Scene ${currentScene.number}: ${currentScene.label}`}>
            <div className="vb-spatial-readout-top"><span>Scene direction</span><span>{currentScene.number} / {sceneBeats.length.toString().padStart(2, "0")}</span></div>
            <div className="vb-spatial-readout-core">
              <span className="vb-spatial-readout-pulse" aria-hidden="true" />
              <div><strong>{selectedLane.label}</strong><span>{selectedLane.descriptor}</span></div>
            </div>
            <div className="vb-spatial-readout-bottom"><span>Property → evidence → route</span><span>Live</span></div>
          </aside>

          <ol className="vb-hero-scene-meter" aria-label="Homepage scene progress">
            {sceneBeats.map((scene, index) => (
              <li key={scene.number} className={index === sceneIndex ? "is-active" : index < sceneIndex ? "is-complete" : ""}>
                <span>{scene.number}</span><i aria-hidden="true" /><strong>{scene.label}</strong>
              </li>
            ))}
          </ol>

          <a href="#paths" className="vb-hero-scroll-cue" aria-label="Scroll to enter VestBlock">
            <span className="vb-scroll-cue-ring"><i /></span>
            <span>Scroll to direct the scene</span>
            <MoveDown className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </section>
  )
}
