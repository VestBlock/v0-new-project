"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import {
  ArrowUpRight,
  BrainCircuit,
  CheckCheck,
  ChevronDown,
  ClipboardCopy,
  Crosshair,
  Loader2,
  Send,
  TerminalSquare,
} from "lucide-react"

import { cn } from "@/lib/utils"
import type { BossBriefing, BossPlay } from "@/lib/admin/bossAgent"
import type { AgentKey } from "@/lib/admin/commandCenter"

const AGENT_BADGES: Record<AgentKey, { label: string; className: string }> = {
  acquisition: { label: "Acquisition", className: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200" },
  outreach: { label: "Outreach", className: "border-blue-400/30 bg-blue-400/10 text-blue-200" },
  routing: { label: "Routing", className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" },
  underwriting: { label: "Capital", className: "border-amber-300/30 bg-amber-300/10 text-amber-200" },
  authority: { label: "Authority", className: "border-violet-400/30 bg-violet-400/10 text-violet-200" },
  qa: { label: "QA", className: "border-rose-400/30 bg-rose-400/10 text-rose-200" },
  operator: { label: "Operator", className: "border-slate-300/30 bg-slate-300/10 text-slate-200" },
}

const CATEGORY_LABELS: Record<BossPlay["category"], string> = {
  acquisition: "Acquisition",
  conversion: "Conversion",
  capital: "Capital",
  visibility: "Visibility",
  hygiene: "Hygiene",
}

function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      // clipboard unavailable
    }
  }, [command])

  return (
    <button
      type="button"
      onClick={copy}
      className="group inline-flex max-w-full items-center gap-1.5 rounded-lg border border-white/10 bg-slate-950/70 px-2.5 py-1.5 text-left transition-colors hover:border-cyan-300/40"
      title={command}
    >
      {copied ? (
        <CheckCheck className="h-3 w-3 shrink-0 text-emerald-400" />
      ) : (
        <TerminalSquare className="h-3 w-3 shrink-0 text-slate-500 group-hover:text-cyan-300" />
      )}
      <span className="vb-mono truncate text-[0.62rem] text-slate-400 group-hover:text-slate-200">
        {copied ? "Copied to clipboard" : command}
      </span>
      {!copied ? <ClipboardCopy className="h-3 w-3 shrink-0 text-slate-600" /> : null}
    </button>
  )
}

function DispatchButton({
  playKey,
  onResult,
}: {
  playKey: string
  onResult: (message: string, ok: boolean) => void
}) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const dispatch = useCallback(async () => {
    setBusy(true)
    try {
      const response = await fetch("/api/admin/boss-agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playKey }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok && (data.dispatched > 0 || data.skipped > 0)) {
        setDone(true)
        onResult(data.message || `Dispatched ${data.dispatched} directives.`, true)
      } else {
        onResult(data.error || data.message || "Dispatch failed.", false)
      }
    } catch {
      onResult("Dispatch failed — network error.", false)
    } finally {
      setBusy(false)
    }
  }, [playKey, onResult])

  return (
    <button
      type="button"
      onClick={dispatch}
      disabled={busy || done}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
        done
          ? "border border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
          : "bg-gradient-to-r from-cyan-300 to-sky-400 text-slate-950 hover:from-cyan-200 hover:to-sky-300 disabled:opacity-60"
      )}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : done ? <CheckCheck className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
      {done ? "Dispatched" : busy ? "Dispatching" : "Dispatch to agents"}
    </button>
  )
}

function PlayDirectives({ play }: { play: BossPlay }) {
  return (
    <div className="space-y-1.5">
      {play.directives.map((directive) => {
        const badge = AGENT_BADGES[directive.agent]
        return (
          <div
            key={`${directive.agent}-${directive.action}`}
            className="flex items-start gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2"
          >
            <span className={cn("vb-mono mt-0.5 shrink-0 rounded-md border px-1.5 py-0.5 text-[0.55rem] uppercase tracking-[0.12em]", badge.className)}>
              {badge.label}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-100">{directive.action}</p>
              <p className="mt-0.5 text-[0.7rem] leading-4 text-slate-400">{directive.detail}</p>
            </div>
            {directive.priority !== "normal" ? (
              <span
                className={cn(
                  "vb-mono ml-auto shrink-0 text-[0.55rem] uppercase tracking-[0.14em]",
                  directive.priority === "urgent" ? "text-rose-300" : "text-amber-300"
                )}
              >
                {directive.priority}
              </span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function PlaySteps({ play }: { play: BossPlay }) {
  if (!play.steps.length) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {play.steps.map((step) =>
        step.command ? (
          <CopyCommand key={step.command} command={step.command} />
        ) : step.href ? (
          <Link
            key={step.href + step.label}
            href={step.href}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[0.65rem] font-medium text-slate-300 transition-colors hover:border-cyan-300/40 hover:text-white"
          >
            {step.label}
            <ArrowUpRight className="h-3 w-3 opacity-60" />
          </Link>
        ) : null
      )}
    </div>
  )
}

export function BossAgentPanel({
  briefing,
  onDispatched,
}: {
  briefing: BossBriefing
  onDispatched?: () => void | Promise<void>
}) {
  const reduce = useReducedMotion()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(null)

  const handleResult = useCallback((message: string, ok: boolean) => {
    setToast({ message, ok })
    window.setTimeout(() => setToast(null), 6000)
  }, [])

  const handleDispatchResult = useCallback(
    async (message: string, ok: boolean) => {
      handleResult(message, ok)
      if (ok) {
        await onDispatched?.()
      }
    },
    [handleResult, onDispatched]
  )

  const focus = briefing.plays.find((play) => play.key === briefing.focusKey) || briefing.plays[0]
  const rest = briefing.plays.filter((play) => play.key !== focus?.key)

  if (!focus) return null

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45 }}
      className="vb-border-beam relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-400/10 text-cyan-200">
            <BrainCircuit className="h-4.5 w-4.5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-white">Boss Agent</h2>
            <p className="text-xs text-slate-400">Strategy layer — ranks the plays, directs the seven lanes.</p>
          </div>
        </div>
        <p className="vb-mono max-w-xl truncate text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">
          {briefing.plays.length} plays evaluated · {new Date(briefing.generatedAt).toLocaleTimeString()}
        </p>
      </div>

      {toast ? (
        <div
          className={cn(
            "mx-5 mt-4 rounded-xl border px-3 py-2.5 text-xs",
            toast.ok ? "border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-100" : "border-rose-400/25 bg-rose-400/[0.07] text-rose-100"
          )}
        >
          {toast.message}
        </div>
      ) : null}

      <div className="grid gap-5 p-5 xl:grid-cols-[1.35fr_1fr]">
        {/* Focus play */}
        <div className="rounded-2xl border border-cyan-300/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_50%)] p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-cyan-200">
              <Crosshair className="h-3 w-3" />
              Today’s focus
            </span>
            <span className="vb-mono text-[0.6rem] uppercase tracking-[0.14em] text-slate-500">
              {CATEGORY_LABELS[focus.category]} · effort {focus.effort} · score {focus.score}
            </span>
          </div>
          <h3 className="mt-3 text-xl font-semibold tracking-tight text-white">{focus.name}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300/90">{focus.thesis}</p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {focus.whyNow.map((reason) => (
              <span key={reason} className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[0.65rem] leading-4 text-slate-300">
                {reason}
              </span>
            ))}
          </div>

          <div className="mt-4">
            <PlayDirectives play={focus} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <DispatchButton playKey={focus.key} onResult={handleDispatchResult} />
            <PlaySteps play={focus} />
          </div>

          {focus.complianceNote ? (
            <p className="mt-3 text-[0.65rem] leading-4 text-slate-500">{focus.complianceNote}</p>
          ) : null}
        </div>

        {/* Ranked stack */}
        <div className="space-y-2">
          {rest.map((play) => {
            const isOpen = expanded === play.key
            return (
              <div key={play.key} className="rounded-xl border border-white/[0.07] bg-white/[0.015] transition-colors hover:border-white/[0.14]">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : play.key)}
                  className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left"
                >
                  <span className="relative h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-white/[0.06]">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-400/80 to-sky-300/80"
                      style={{ width: `${play.score}%` }}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-100">{play.name}</span>
                    <span className="vb-mono block text-[0.58rem] uppercase tracking-[0.14em] text-slate-500">
                      {CATEGORY_LABELS[play.category]} · effort {play.effort} · score {play.score}
                    </span>
                  </span>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-500 transition-transform", isOpen && "rotate-180")} />
                </button>
                {isOpen ? (
                  <div className="space-y-3 border-t border-white/[0.06] px-3.5 py-3">
                    <p className="text-xs leading-5 text-slate-300/90">{play.thesis}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {play.whyNow.map((reason) => (
                        <span key={reason} className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[0.62rem] leading-4 text-slate-400">
                          {reason}
                        </span>
                      ))}
                    </div>
                    <PlayDirectives play={play} />
                    <div className="flex flex-wrap items-center gap-2">
                        <DispatchButton playKey={play.key} onResult={handleDispatchResult} />
                      <PlaySteps play={play} />
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </motion.section>
  )
}
