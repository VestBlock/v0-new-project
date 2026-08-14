"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowRight, Check, Clipboard, RefreshCw, ShieldCheck, Sparkles, Target, X, Zap } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type StrategyDirective = {
  agent: string
  action: string
  detail: string
  priority: "urgent" | "high" | "normal"
}

type StrategyStep = {
  label: string
  command?: string
  href?: string
}

type StrategyPlay = {
  key: string
  name: string
  category: "acquisition" | "conversion" | "capital" | "visibility" | "hygiene"
  thesis: string
  whyNow: string[]
  score: number
  appliedWeight?: number
  effort: "low" | "medium" | "high"
  expectedOutcome: string
  directives: StrategyDirective[]
  steps: StrategyStep[]
  complianceNote?: string
}

type StrategyLesson = {
  playKey: string
  playName: string
  summary: string
  adjustment: number
  completedAt: string
}

type StrategyBriefing = {
  generatedAt: string
  headline: string
  focusKey: string
  plays: StrategyPlay[]
  lessons: StrategyLesson[]
}

type GovernanceSnapshot = {
  lanes: Array<{ id: string; lane_key: string; version: number; title: string; contract_json: { objective?: string; primaryConversionEvent?: string } }>
  proposals: Array<{ id: string; target_key: string; title: string; rationale: string; risk_level: string; approval_status: string; created_at: string }>
  evidence: Array<{ id: string; brief_title: string; source_type: string; created_at: string }>
  outcomes: Array<{ id: string; decision: string | null }>
  generatedAt: string
}

function effortTone(value: StrategyPlay["effort"]) {
  if (value === "low") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
  if (value === "medium") return "border-amber-300/20 bg-amber-300/10 text-amber-100"
  return "border-rose-400/20 bg-rose-400/10 text-rose-100"
}

function priorityTone(value: StrategyDirective["priority"]) {
  if (value === "urgent") return "text-rose-200"
  if (value === "high") return "text-amber-200"
  return "text-slate-300"
}

export function CommandCenterStrategyPanel({
  initialBriefing,
}: {
  initialBriefing: StrategyBriefing
}) {
  const [briefing, setBriefing] = useState(initialBriefing)
  const [workingPlayKey, setWorkingPlayKey] = useState<string | null>(null)
  const [isLearning, setIsLearning] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string>("")
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null)
  const [governance, setGovernance] = useState<GovernanceSnapshot | null>(null)
  const [governanceWorking, setGovernanceWorking] = useState<string | null>(null)

  const focusPlay = useMemo(
    () => briefing.plays.find((play) => play.key === briefing.focusKey) || briefing.plays[0] || null,
    [briefing]
  )
  const challengerPlays = briefing.plays.filter((play) => play.key !== focusPlay?.key).slice(0, 3)

  const loadGovernance = useCallback(async () => {
    const response = await fetch("/api/admin/strategy-governance", { cache: "no-store" })
    const payload = (await response.json()) as GovernanceSnapshot & { error?: string }
    if (!response.ok) throw new Error(payload.error || "Unable to load strategy governance.")
    setGovernance(payload)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadGovernance().catch((error) => setStatusMessage(error instanceof Error ? error.message : "Unable to load strategy governance."))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadGovernance])

  const decideProposal = async (id: string, action: "approve" | "reject" | "apply") => {
    setGovernanceWorking(id)
    setStatusMessage("")
    try {
      const response = await fetch(`/api/admin/strategy-governance/${id}`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Unable to record the strategy decision.")
      setStatusMessage(action === "apply" ? "A new strategy version is active; the prior version remains in history." : `Strategy proposal ${action}d.`)
      await loadGovernance()
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to record the strategy decision.")
    } finally {
      setGovernanceWorking(null)
    }
  }

  const runN8nContractTest = async () => {
    setGovernanceWorking("n8n-test")
    setStatusMessage("")
    try {
      const response = await fetch("/api/admin/orchestration/n8n", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventType: "workflow_contract_test",
          idempotencyKey: `command-center-contract-${new Date().toISOString().slice(0, 16)}`,
          mode: "no_send",
          channel: "no_outreach",
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "n8n no-send test failed safely.")
      setStatusMessage(payload.replayed ? "The existing n8n no-send test was reused; no duplicate run was created." : "Signed n8n no-send test dispatched and recorded.")
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "n8n no-send test failed safely.")
    } finally {
      setGovernanceWorking(null)
    }
  }

  const refreshBriefing = async () => {
    const response = await fetch("/api/admin/boss-agent", { cache: "no-store" })
    const payload = (await response.json()) as StrategyBriefing & { error?: string }
    if (!response.ok) throw new Error(payload.error || "Unable to refresh strategy engine.")
    setBriefing(payload)
    return payload
  }

  const dispatchPlay = async (playKey: string) => {
    setWorkingPlayKey(playKey)
    setStatusMessage("")
    try {
      const response = await fetch("/api/admin/boss-agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playKey }),
      })
      const payload = (await response.json()) as { message?: string; error?: string }
      if (!response.ok) throw new Error(payload.error || "Unable to dispatch this play.")
      setStatusMessage(payload.message || "Strategy dispatched.")
      await refreshBriefing()
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to dispatch this play.")
    } finally {
      setWorkingPlayKey(null)
    }
  }

  const runLearningPass = async () => {
    setIsLearning(true)
    setStatusMessage("")
    try {
      const response = await fetch("/api/admin/boss-agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "retrospective" }),
      })
      const payload = (await response.json()) as { message?: string; error?: string }
      if (!response.ok) throw new Error(payload.error || "Unable to run strategy learning.")
      setStatusMessage(payload.message || "Strategy learning pass completed.")
      await refreshBriefing()
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to run strategy learning.")
    } finally {
      setIsLearning(false)
    }
  }

  const copyCommand = async (command: string) => {
    try {
      await navigator.clipboard.writeText(command)
      setCopiedCommand(command)
      window.setTimeout(() => setCopiedCommand(null), 1400)
    } catch {
      setStatusMessage("Could not copy that command from this browser.")
    }
  }

  if (!focusPlay) return null

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-cyan-200">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <h2 className="text-sm font-semibold text-white">Boss strategy engine</h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{briefing.headline}</p>
          <p className="mt-1 text-xs text-slate-500">
            The Boss ranks multiple lead and outreach plays, dispatches the best one into the operator task board, and learns from completed runs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void runLearningPass()}
            disabled={isLearning}
            className="border-white/10 bg-white/[0.03] text-slate-200 hover:border-cyan-300/35 hover:text-white"
          >
            {isLearning ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
            Learn from completed plays
          </Button>
          <Link
            href="/admin/command-center"
            className="inline-flex items-center rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-200 transition-colors hover:border-cyan-300/35 hover:text-white"
          >
            Stay in command center
          </Link>
        </div>
      </div>

      {statusMessage ? (
        <div className="mt-4 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.08] px-3 py-2 text-xs text-cyan-100">
          {statusMessage}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-2xl border border-white/[0.08] bg-slate-950/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[0.65rem] uppercase tracking-[0.14em] text-cyan-100">
                Focus play
              </span>
              <span className={cn("rounded-full border px-2 py-1 text-[0.65rem] uppercase tracking-[0.14em]", effortTone(focusPlay.effort))}>
                {focusPlay.effort} effort
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[0.65rem] uppercase tracking-[0.14em] text-slate-300">
                score {focusPlay.score}
              </span>
            </div>
            <Button
              type="button"
              onClick={() => void dispatchPlay(focusPlay.key)}
              disabled={workingPlayKey === focusPlay.key}
              className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"
            >
              {workingPlayKey === focusPlay.key ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Target className="mr-2 h-4 w-4" />}
              Dispatch play
            </Button>
          </div>

          <h3 className="mt-4 text-xl font-semibold text-white">{focusPlay.name}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">{focusPlay.thesis}</p>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="vb-mono text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">Why now</p>
              <ul className="mt-2 space-y-2 text-sm text-slate-300">
                {focusPlay.whyNow.slice(0, 4).map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="vb-mono text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">Expected outcome</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{focusPlay.expectedOutcome}</p>
              {focusPlay.complianceNote ? (
                <>
                  <p className="mt-4 vb-mono text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">Guardrail</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{focusPlay.complianceNote}</p>
                </>
              ) : null}
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="vb-mono text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">Directives</p>
              <div className="mt-2 space-y-2">
                {focusPlay.directives.slice(0, 4).map((directive) => (
                  <div key={`${directive.agent}-${directive.action}`} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-white">{directive.action}</p>
                      <span className={cn("text-[0.65rem] uppercase tracking-[0.14em]", priorityTone(directive.priority))}>
                        {directive.priority}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      {directive.agent} · {directive.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="vb-mono text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">Start from here</p>
              <div className="mt-2 space-y-2">
                {focusPlay.steps.map((step) => (
                  <div key={step.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-white">{step.label}</p>
                      {step.href ? (
                        <Link
                          href={step.href}
                          className="inline-flex items-center gap-1 text-xs font-medium text-cyan-200 hover:text-white"
                        >
                          Open <ArrowRight className="h-3 w-3" />
                        </Link>
                      ) : step.command ? (
                        <button
                          type="button"
                          onClick={() => void copyCommand(step.command!)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-cyan-200 hover:text-white"
                        >
                          <Clipboard className="h-3 w-3" />
                          {copiedCommand === step.command ? "Copied" : "Copy command"}
                        </button>
                      ) : null}
                    </div>
                    {step.command ? <p className="mt-1 font-mono text-[0.7rem] text-slate-500">{step.command}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/[0.08] bg-slate-950/60 p-4">
            <p className="vb-mono text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">Challenger plays</p>
            <div className="mt-3 space-y-3">
              {challengerPlays.map((play) => (
                <div key={play.key} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white">{play.name}</p>
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[0.65rem] text-slate-300">
                      {play.score}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{play.whyNow[0] || play.expectedOutcome}</p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className={cn("rounded-full border px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.14em]", effortTone(play.effort))}>
                      {play.effort}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void dispatchPlay(play.key)}
                      disabled={workingPlayKey === play.key}
                      className="border-white/10 bg-white/[0.03] text-slate-200 hover:border-cyan-300/35 hover:text-white"
                    >
                      {workingPlayKey === play.key ? <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                      Dispatch
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-slate-950/60 p-4">
            <p className="vb-mono text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">Learning loop</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Completed plays feed back into ranking. The Boss raises plays that move replies, leads, partner depth, or revenue and decays the ones that burn time without moving the board.
            </p>
            <div className="mt-3 space-y-2">
              {briefing.lessons.length ? (
                briefing.lessons.slice(0, 3).map((lesson) => (
                  <div key={`${lesson.playKey}-${lesson.completedAt}`} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-white">{lesson.playName}</p>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[0.65rem]",
                          lesson.adjustment >= 0
                            ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                            : "border-rose-400/20 bg-rose-400/10 text-rose-100"
                        )}
                      >
                        {lesson.adjustment >= 0 ? "+" : ""}
                        {lesson.adjustment}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{lesson.summary}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 px-3 py-3 text-xs text-slate-500">
                  No completed-play lessons yet. Dispatch plays from here, complete the directives, then run the learning pass.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/[0.08] bg-slate-950/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-cyan-200" />
              <h3 className="text-sm font-semibold text-white">Strategy governance</h3>
            </div>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-400">
              Sourced observations can propose a change, but they cannot rewrite an active strategy or trigger external action. Material changes require approval and create a preserved new version.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void runN8nContractTest()} disabled={governanceWorking === "n8n-test"}>
              {governanceWorking === "n8n-test" ? <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
              Test n8n · no send
            </Button>
            <Link href="/admin/opportunity-matches" className="inline-flex min-h-9 items-center rounded-md border border-white/10 bg-white/[0.03] px-3 text-xs text-slate-200 hover:border-cyan-300/35 hover:text-white">
              Review matches <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><p className="text-2xl font-semibold text-white">{governance?.lanes.length ?? "—"}</p><p className="mt-1 text-xs text-slate-500">Active versioned lanes</p></div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><p className="text-2xl font-semibold text-white">{governance?.proposals.length ?? "—"}</p><p className="mt-1 text-xs text-slate-500">Changes awaiting decision</p></div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><p className="text-2xl font-semibold text-white">{governance?.evidence.length ?? "—"}</p><p className="mt-1 text-xs text-slate-500">Recent sourced briefs</p></div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><p className="text-2xl font-semibold text-white">{governance?.outcomes.length ?? "—"}</p><p className="mt-1 text-xs text-slate-500">Measured learning records</p></div>
        </div>
        {governance?.lanes.length ? (
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {governance.lanes.map((lane) => (
              <div key={lane.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium text-white">{lane.title}</p><span className="text-[0.65rem] text-cyan-200">v{lane.version}</span></div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{lane.contract_json.objective}</p>
              </div>
            ))}
          </div>
        ) : null}
        {governance?.proposals.length ? (
          <div className="mt-4 space-y-2">
            <p className="vb-mono text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">Material change queue</p>
            {governance.proposals.map((proposal) => (
              <div key={proposal.id} className="flex flex-col gap-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-3 lg:flex-row lg:items-center lg:justify-between">
                <div><p className="text-sm font-medium text-white">{proposal.title}</p><p className="mt-1 text-xs leading-5 text-slate-400">{proposal.rationale}</p><p className="mt-1 text-[0.65rem] uppercase tracking-[0.12em] text-slate-500">{proposal.target_key.replaceAll("_", " ")} · {proposal.risk_level} risk · {proposal.approval_status}</p></div>
                <div className="flex shrink-0 gap-2">
                  {proposal.approval_status === "queued" ? <Button size="sm" onClick={() => void decideProposal(proposal.id, "approve")} disabled={governanceWorking === proposal.id}><Check className="mr-1 h-3.5 w-3.5" />Approve</Button> : null}
                  {proposal.approval_status === "approved" ? <Button size="sm" onClick={() => void decideProposal(proposal.id, "apply")} disabled={governanceWorking === proposal.id}>Create next version</Button> : null}
                  <Button size="sm" variant="outline" onClick={() => void decideProposal(proposal.id, "reject")} disabled={governanceWorking === proposal.id}><X className="mr-1 h-3.5 w-3.5" />Reject</Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
