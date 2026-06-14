"use client"

import { useRef } from "react"
import Link from "next/link"
import { ArrowRight, Command, Crosshair, Radar, Sparkles, Zap } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type CommandCenterModeKey = "acquire" | "analyze" | "route" | "outreach" | "capital" | "authority"

export type CommandCenterModeOption = {
  key: CommandCenterModeKey
  label: string
  description: string
  accentClassName: string
  glowClassName: string
}

export type CommandCenterIntentPreview = {
  title: string
  detail: string
  actionLabel: string
}

export type CommandCenterSuggestion = {
  id: string
  label: string
  detail: string
}

export type CommandCenterNeedsItem = {
  title: string
  detail: string
  href?: string
  tone: "critical" | "warning" | "info"
}

export type CommandCenterFocusPlayCard = {
  name: string
  thesis: string
  whyNow: string
  score: number
}

const toneClassName: Record<CommandCenterNeedsItem["tone"], string> = {
  critical: "border-rose-400/25 bg-rose-400/[0.08] text-rose-100",
  warning: "border-amber-300/20 bg-amber-300/[0.08] text-amber-100",
  info: "border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-100",
}

export function CommandCenterCommandDeck({
  modes,
  activeMode,
  onModeChange,
  commandInput,
  onCommandInputChange,
  onCommandSubmit,
  preview,
  suggestions,
  onSuggestionSelect,
  needsNow,
  focusPlay,
}: {
  modes: readonly CommandCenterModeOption[]
  activeMode: CommandCenterModeKey
  onModeChange: (mode: CommandCenterModeKey) => void
  commandInput: string
  onCommandInputChange: (value: string) => void
  onCommandSubmit: (command: string) => void
  preview: CommandCenterIntentPreview | null
  suggestions: CommandCenterSuggestion[]
  onSuggestionSelect: (suggestionId: string) => void
  needsNow: CommandCenterNeedsItem[]
  focusPlay: CommandCenterFocusPlayCard | null
}) {
  const activeModeConfig = modes.find((mode) => mode.key === activeMode) || modes[0]
  const primaryPressure = needsNow[0]
  const commandInputRef = useRef<HTMLInputElement>(null)
  const submitCurrentCommand = () => onCommandSubmit(commandInputRef.current?.value ?? commandInput)

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/80 px-5 py-5 backdrop-blur-xl md:px-6">
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent blur-2xl",
          activeModeConfig?.glowClassName
        )}
      />

      <div className="relative grid gap-5 2xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1 text-[0.65rem] uppercase tracking-[0.18em] text-cyan-100">
              <Radar className="h-3.5 w-3.5" />
              Command deck
            </span>
            <span className="vb-mono text-[0.62rem] uppercase tracking-[0.18em] text-slate-500">
              single-surface operator control
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {modes.map((mode) => (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => onModeChange(mode.key)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    activeMode === mode.key
                      ? cn("text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)]", mode.accentClassName)
                      : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:text-white"
                  )}
                >
                  <span className="vb-mono text-[0.58rem] uppercase tracking-[0.18em]">{mode.label}</span>
                </button>
              ))}
            </div>
            <p className="max-w-2xl text-sm leading-6 text-slate-400">{activeModeConfig?.description}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Command className="h-4 w-4 text-cyan-200" />
                <p className="text-sm font-semibold text-white">Run a command</p>
              </div>
              <p className="vb-mono text-[0.62rem] uppercase tracking-[0.18em] text-slate-500">natural shortcuts</p>
            </div>

            <div className="mt-3 flex flex-col gap-3 lg:flex-row">
              <div className="flex-1">
                <Input
                  ref={commandInputRef}
                  value={commandInput}
                  onChange={(event) => onCommandInputChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      submitCurrentCommand()
                    }
                  }}
                  placeholder="analyze 3425 n 11th st · launch seller outreach in Milwaukee · find builders in Columbus"
                  className="h-12 border-white/10 bg-slate-950/70 text-sm text-white placeholder:text-slate-500"
                />
              </div>
              <Button
                type="button"
                onClick={submitCurrentCommand}
                className="h-12 min-w-[132px] bg-cyan-400 text-slate-950 hover:bg-cyan-300"
              >
                <Crosshair className="mr-2 h-4 w-4" />
                Run
              </Button>
            </div>

            {preview ? (
              <div className="mt-3 rounded-2xl border border-white/[0.06] bg-slate-950/60 px-4 py-3">
                <p className="vb-mono text-[0.58rem] uppercase tracking-[0.16em] text-slate-500">Command preview</p>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">{preview.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{preview.detail}</p>
                  </div>
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.08] px-2.5 py-1 text-[0.65rem] font-medium text-cyan-100">
                    {preview.actionLabel}
                  </span>
                </div>
              </div>
            ) : null}

            <div className="mt-4 grid gap-2 md:grid-cols-3">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  onClick={() => onSuggestionSelect(suggestion.id)}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-left transition-colors hover:border-cyan-300/30 hover:bg-white/[0.05]"
                >
                  <p className="text-sm font-medium text-white">{suggestion.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{suggestion.detail}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">What needs me now</p>
              <p className="vb-mono text-[0.62rem] uppercase tracking-[0.18em] text-slate-500">live operator pressure</p>
            </div>
            <div className="grid gap-2 2xl:grid-cols-3">
              {needsNow.map((item) => {
                const body = (
                  <div
                    className={cn(
                      "h-full rounded-2xl border px-3 py-3 text-left transition-colors hover:border-white/20",
                      toneClassName[item.tone]
                    )}
                  >
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 opacity-85">{item.detail}</p>
                  </div>
                )

                return item.href ? (
                  <Link key={item.title} href={item.href} className="block">
                    {body}
                  </Link>
                ) : (
                  <div key={item.title}>{body}</div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-200" />
              <p className="text-sm font-semibold text-white">Boss play in focus</p>
            </div>

            {focusPlay ? (
              <>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-white">{focusPlay.name}</h3>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.65rem] font-medium text-slate-200">
                    score {focusPlay.score}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-300">{focusPlay.thesis}</p>
                <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06] px-3 py-3 text-xs leading-5 text-cyan-100">
                  {focusPlay.whyNow}
                </div>
                <Link
                  href="#strategy-engine"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-cyan-200 hover:text-white"
                >
                  Open full strategy engine
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-400">
                No focus play loaded yet. Dispatch a strategy once the Boss ranking stabilizes.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-cyan-200" />
              <p className="text-sm font-semibold text-white">Operator posture</p>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
                <p className="vb-mono text-[0.55rem] uppercase tracking-[0.14em] text-slate-500">Lens</p>
                <p className="mt-1 truncate text-sm font-semibold text-white">{activeModeConfig.label}</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
                <p className="vb-mono text-[0.55rem] uppercase tracking-[0.14em] text-slate-500">Boss score</p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-cyan-200">
                  {focusPlay ? focusPlay.score : "idle"}
                </p>
              </div>
            </div>

            <div className={cn("mt-3 rounded-2xl border px-3 py-3", primaryPressure ? toneClassName[primaryPressure.tone] : "border-white/[0.06] bg-white/[0.02] text-slate-300")}>
              <p className="vb-mono text-[0.55rem] uppercase tracking-[0.14em] opacity-70">Primary pressure</p>
              {primaryPressure ? (
                <>
                  <p className="mt-1 text-sm font-semibold">{primaryPressure.title}</p>
                  <p className="mt-1 text-xs leading-5 opacity-80">{primaryPressure.detail}</p>
                </>
              ) : (
                <p className="mt-1 text-sm leading-5">No urgent pressure is visible from the command feed.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
