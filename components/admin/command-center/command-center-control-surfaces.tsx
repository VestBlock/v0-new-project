"use client"

import {
  AlertTriangle,
  ArrowUpRight,
  BellRing,
  BrainCircuit,
  Database,
  FileClock,
  Gauge,
  GitBranch,
  Home,
  Loader2,
  Mail,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"

import { cn } from "@/lib/utils"
import type {
  AgentKpi,
  CommandCenterDealMachineFreshness,
  CommandCenterInboxSection,
  CommandCenterInlineAction,
  CommandCenterOutboundControl,
  CommandCenterQueueCard,
  CommandCenterStrategyLab,
  CommandCenterStreamItem,
  CommandCenterSuppressionCenter,
  CommandCenterData,
} from "@/lib/admin/commandCenter"

type OperatingLoops = CommandCenterData["operatingLoops"]
type OperatingArchitecture = CommandCenterData["operatingArchitecture"]

function timeAgo(value: string | null) {
  if (!value) return ""
  const ms = Date.now() - Date.parse(value)
  if (!Number.isFinite(ms) || ms < 0) return ""
  const minutes = Math.floor(ms / 60000)
  if (minutes < 1) return "now"
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function kpiTone(status?: AgentKpi["status"]) {
  if (status === "green") return "text-emerald-300"
  if (status === "yellow") return "text-amber-300"
  if (status === "red") return "text-rose-300"
  return "text-white"
}

function money(value: number | null | undefined) {
  if (!Number.isFinite(value)) return "--"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value))
}

function itemTone(priority: CommandCenterStreamItem["priority"]) {
  if (priority === "critical") return "border-rose-400/20 bg-rose-400/[0.06]"
  if (priority === "warning") return "border-amber-300/20 bg-amber-300/[0.05]"
  return "border-white/[0.06] bg-white/[0.02]"
}

function actionTone(tone?: CommandCenterInlineAction["tone"]) {
  if (tone === "primary") return "border-cyan-300/30 bg-cyan-300/[0.08] text-cyan-100 hover:border-cyan-200/50"
  if (tone === "success") return "border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-100 hover:border-emerald-300/45"
  if (tone === "warning") return "border-amber-300/25 bg-amber-300/[0.08] text-amber-100 hover:border-amber-200/45"
  return "border-white/10 bg-white/[0.03] text-slate-200 hover:border-cyan-300/35 hover:text-white"
}

function StreamActionButton({
  action,
  runningActionId,
  onAction,
}: {
  action: CommandCenterInlineAction
  runningActionId: string | null
  onAction: (action: CommandCenterInlineAction) => void
}) {
  const isRunning = runningActionId === action.id
  const isSendAction =
    ("sendNow" in action && action.sendNow) ||
    action.type === "lead_send_batch" ||
    action.type === "buyer_send_batch" ||
    action.type === "lender_send_batch"

  return (
    <button
      type="button"
      onClick={() => onAction(action)}
      disabled={isRunning}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[0.65rem] font-medium transition-colors disabled:opacity-50",
        actionTone(action.tone)
      )}
    >
      {isRunning ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : action.type === "navigate" ? (
        <ArrowUpRight className="h-3 w-3 opacity-70" />
      ) : isSendAction ? (
        <Send className="h-3 w-3 opacity-70" />
      ) : (
        <Sparkles className="h-3 w-3 opacity-70" />
      )}
      {action.label}
    </button>
  )
}

function StreamItemCard({
  item,
  runningActionId,
  onAction,
}: {
  item: CommandCenterStreamItem
  runningActionId: string | null
  onAction: (action: CommandCenterInlineAction) => void
}) {
  return (
    <div className={cn("rounded-2xl border px-3 py-3", itemTone(item.priority))}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-white">{item.title}</p>
            {item.statusLabel ? (
              <span className="vb-mono rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[0.55rem] uppercase tracking-[0.14em] text-slate-300">
                {item.statusLabel}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-300">{item.detail}</p>
          {item.hint ? <p className="mt-1 text-[0.68rem] text-slate-500">{item.hint}</p> : null}
        </div>
        <span className="vb-mono shrink-0 text-[0.58rem] uppercase tracking-[0.14em] text-slate-500">
          {timeAgo(item.at) || "queued"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {item.actions.map((action) => (
          <StreamActionButton
            key={action.id}
            action={action}
            runningActionId={runningActionId}
            onAction={onAction}
          />
        ))}
      </div>
    </div>
  )
}

export function CommandCenterStrategyOpsPanel({
  strategyLab,
  operatingLoops,
  operatingArchitecture,
  dealMemory,
  sourceGovernor,
  suppressionCenter,
  dealMachineFreshness,
  outcomeLearning,
  outboundGovernance,
  buyBoxGraph,
  runningActionId,
  onAction,
  sectionId = "strategy-lab-command",
}: {
  strategyLab: CommandCenterStrategyLab
  operatingLoops: OperatingLoops
  operatingArchitecture: OperatingArchitecture
  dealMemory: CommandCenterData["dealMemory"]
  sourceGovernor: CommandCenterData["sourceGovernor"]
  suppressionCenter: CommandCenterSuppressionCenter
  dealMachineFreshness: CommandCenterDealMachineFreshness
  outcomeLearning: CommandCenterData["outcomeLearning"]
  outboundGovernance: CommandCenterData["outboundGovernance"]
  buyBoxGraph: CommandCenterData["buyBoxGraph"]
  runningActionId: string | null
  onAction: (action: CommandCenterInlineAction) => void
  sectionId?: string
}) {
  const onMarketSweep = strategyLab.onMarketSweep

  return (
    <section
      id={sectionId}
      className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.035] p-5 backdrop-blur-xl"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-100">
              <BrainCircuit className="h-3.5 w-3.5" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-white">Daily strategy lab</h2>
              <p className="text-xs text-slate-500">self-improving outbound, public listing sweeps, DealMachine freshness, and opt-out safety</p>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-300">{strategyLab.nextMove}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {strategyLab.actions.map((action) => (
            <StreamActionButton
              key={action.id}
              action={action}
              runningActionId={runningActionId}
              onAction={onAction}
            />
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2 2xl:grid-cols-[1.05fr_0.9fr_0.9fr_0.9fr]">
        <div className="rounded-2xl border border-white/[0.07] bg-slate-950/55 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="vb-mono text-[0.58rem] uppercase tracking-[0.14em] text-cyan-200/80">Active experiment</p>
              <h3 className="mt-1 text-base font-semibold text-white">{strategyLab.focus}</h3>
            </div>
            <span className={cn("rounded-full border px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.14em]", kpiTone(strategyLab.status), "border-white/10 bg-white/[0.04]")}>
              {strategyLab.status}
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Challenger: <span className="text-slate-200">{strategyLab.challenger}</span>
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              { label: "Sent today", value: strategyLab.sentToday, status: strategyLab.sentToday ? "green" : "yellow" },
              { label: "Remaining", value: strategyLab.remainingToday, status: strategyLab.remainingToday ? "green" : "yellow" },
              { label: "Email ready", value: strategyLab.emailReady, status: strategyLab.emailReady ? "green" : "red" },
              { label: "Replies 7d", value: strategyLab.replySignals7d, status: strategyLab.replySignals7d ? "yellow" : "green" },
            ].map((metric) => (
              <div key={metric.label} className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
                <p className="vb-mono text-[0.55rem] uppercase tracking-[0.14em] text-slate-500">{metric.label}</p>
                <p className={cn("mt-1 text-lg font-semibold tabular-nums", kpiTone(metric.status as AgentKpi["status"]))}>
                  {metric.value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5 text-xs leading-5 text-slate-400">
            {strategyLab.activeDirectiveCount > 0
              ? `${strategyLab.activeDirectiveCount} lab directive${strategyLab.activeDirectiveCount === 1 ? "" : "s"} open${strategyLab.lastDirectiveAt ? ` · ${timeAgo(strategyLab.lastDirectiveAt)} ago` : ""}.`
              : "No open lab directives. Dispatch from the strategy engine when you want a fresh operating batch."}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-slate-950/55 p-4 xl:col-span-2 2xl:col-span-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <BrainCircuit className="h-4 w-4 text-cyan-200" />
                <h3 className="text-sm font-semibold text-white">Operating architecture</h3>
              </div>
              <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-400">{operatingArchitecture.summary}</p>
            </div>
            <span className={cn("vb-mono rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[0.62rem] uppercase tracking-[0.14em]", kpiTone(operatingArchitecture.status))}>
              {operatingArchitecture.status}
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {operatingArchitecture.pillars.map((pillar) => (
              <div key={pillar.key} className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{pillar.title}</p>
                    <p className="mt-1 vb-mono text-[0.6rem] uppercase tracking-[0.14em] text-slate-500">{pillar.metric}</p>
                  </div>
                  <span className={cn("vb-mono text-[0.6rem] uppercase tracking-[0.14em]", kpiTone(pillar.status))}>
                    {pillar.status}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">{pillar.summary}</p>
                <p className="mt-2 text-xs leading-5 text-cyan-100/80">{pillar.nextAction}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.05] px-3 py-3">
            <p className="vb-mono text-[0.58rem] uppercase tracking-[0.16em] text-cyan-200/80">Next build sequence</p>
            <div className="mt-2 grid gap-2 lg:grid-cols-3">
              {operatingArchitecture.nextBuildSteps.slice(0, 3).map((step) => (
                <p key={step} className="text-xs leading-5 text-slate-300">
                  {step}
                </p>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-slate-950/55 p-4 xl:col-span-2 2xl:col-span-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-cyan-200" />
                <h3 className="text-sm font-semibold text-white">Operating loops</h3>
              </div>
              <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-400">
                {operatingLoops.ledgerEventCount} ledger event{operatingLoops.ledgerEventCount === 1 ? "" : "s"} normalized across live outreach, source blockers, and campaign artifacts.
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-xs text-slate-400">
              <span className="vb-mono text-slate-500">Ledger</span>{" "}
              <span className="text-slate-300">{operatingLoops.ledgerPath.split("/").slice(-3).join("/")}</span>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {operatingLoops.loops.map((loop) => (
              <div key={loop.key} className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{loop.title}</p>
                    <p className="mt-1 text-[0.65rem] uppercase tracking-[0.12em] text-slate-500">{loop.cadence}</p>
                  </div>
                  <span className={cn("vb-mono text-[0.62rem] uppercase tracking-[0.14em]", kpiTone(loop.status))}>
                    {loop.status}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">{loop.summary}</p>
                <p className="mt-2 text-xs leading-5 text-cyan-100/80">{loop.nextAction}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {operatingLoops.campaigns.slice(0, 4).map((campaign) => (
              <div key={campaign.key} className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{campaign.label}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{campaign.nextMove}</p>
                  </div>
                  <span className={cn("vb-mono text-[0.62rem] uppercase tracking-[0.14em]", kpiTone(campaign.status))}>
                    {campaign.status}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {[
                    { label: "Sent", value: campaign.sent, tone: "green" },
                    { label: "Failed", value: campaign.failed, tone: campaign.failed ? "red" : undefined },
                    { label: "Blocked", value: campaign.blocked, tone: campaign.blocked ? "yellow" : undefined },
                    { label: "Replies", value: campaign.replies, tone: campaign.replies ? "green" : undefined },
                  ].map((metric) => (
                    <div key={metric.label} className="rounded-lg border border-white/[0.05] bg-slate-950/40 px-2 py-2">
                      <p className="vb-mono text-[0.52rem] uppercase tracking-[0.12em] text-slate-600">{metric.label}</p>
                      <p className={cn("mt-1 text-sm font-semibold tabular-nums", kpiTone(metric.tone as AgentKpi["status"]))}>{metric.value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {campaign.markets.slice(0, 3).map((market) => (
                    <span key={market.market} className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[0.62rem] text-slate-400">
                      {market.market} · {market.count}
                    </span>
                  ))}
                  {campaign.latestArtifact ? (
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[0.62rem] text-slate-500">
                      {timeAgo(campaign.lastEventAt) || "saved"}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-slate-950/55 p-4">
          <div className="flex items-center gap-2">
            <Home className="h-4 w-4 text-cyan-200" />
            <h3 className="text-sm font-semibold text-white">Deal twin memory</h3>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            {dealMemory.totalAnalyses
              ? `${dealMemory.totalAnalyses} saved analyzer outcome${dealMemory.totalAnalyses === 1 ? "" : "s"} · avg strength ${dealMemory.averageDealStrength ?? "--"}/100.`
              : "No saved property analyses yet. The next command-center analyzer run will create the first deal twin."}
          </p>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { label: "Saved", value: dealMemory.totalAnalyses, tone: dealMemory.totalAnalyses ? "green" : "yellow" },
              { label: "Risky", value: dealMemory.riskyCount, tone: dealMemory.riskyCount ? "yellow" : "green" },
              { label: "Good", value: dealMemory.goodCount, tone: dealMemory.goodCount ? "green" : undefined },
            ].map((metric) => (
              <div key={metric.label} className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
                <p className="vb-mono text-[0.55rem] uppercase tracking-[0.14em] text-slate-500">{metric.label}</p>
                <p className={cn("mt-1 text-lg font-semibold tabular-nums", kpiTone(metric.tone as AgentKpi["status"]))}>
                  {metric.value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-3 space-y-2">
            {dealMemory.recentAnalyses.length ? (
              dealMemory.recentAnalyses.slice(0, 3).map((analysis) => (
                <div key={analysis.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-100">{analysis.propertyAddress}</p>
                      <p className="mt-1 text-[0.65rem] text-slate-500">
                        {analysis.grade || "Needs details"} · {analysis.dealStrengthLabel || "ungraded"} · {analysis.primaryRouteLabel || "route pending"}
                      </p>
                    </div>
                    <span className={cn("vb-mono shrink-0 text-[0.62rem]", Number(analysis.spread || 0) >= 0 ? "text-emerald-300" : "text-rose-300")}>
                      {money(analysis.spread)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs leading-5 text-slate-500">
                Run Property Command to start storing ARV, MAO, spread, route fit, and next moves.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-slate-950/55 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-cyan-200" />
              <h3 className="text-sm font-semibold text-white">Reply learning loop</h3>
            </div>
            <span className={cn("vb-mono text-[0.62rem] uppercase tracking-[0.14em]", kpiTone(outcomeLearning.status))}>
              {outcomeLearning.status}
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-400">{outcomeLearning.summary}</p>
          <p className="mt-2 text-xs leading-5 text-cyan-100/80">{outcomeLearning.nextMove}</p>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { label: "Events", value: outcomeLearning.totalEvents, tone: outcomeLearning.totalEvents ? "green" : "yellow" },
              { label: "Interested", value: outcomeLearning.interested, tone: outcomeLearning.interested ? "green" : undefined },
              { label: "Qualified", value: outcomeLearning.qualified, tone: outcomeLearning.qualified ? "green" : "yellow" },
            ].map((metric) => (
              <div key={metric.label} className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
                <p className="vb-mono text-[0.55rem] uppercase tracking-[0.14em] text-slate-500">{metric.label}</p>
                <p className={cn("mt-1 text-lg font-semibold tabular-nums", kpiTone(metric.tone as AgentKpi["status"]))}>
                  {metric.value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-3 space-y-2">
            {outcomeLearning.lessons.slice(0, 3).map((lesson) => (
              <div key={lesson.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-slate-100">{lesson.label}</p>
                  <span className={cn("vb-mono shrink-0 text-[0.58rem] uppercase tracking-[0.14em]", kpiTone(lesson.status))}>
                    {lesson.status}
                  </span>
                </div>
                <p className="mt-1 leading-5 text-slate-500">{lesson.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-slate-950/55 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-cyan-200" />
              <h3 className="text-sm font-semibold text-white">Buy-box routing graph</h3>
            </div>
            <span className={cn("vb-mono text-[0.62rem] uppercase tracking-[0.14em]", kpiTone(buyBoxGraph.status))}>
              {buyBoxGraph.status}
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-400">{buyBoxGraph.summary}</p>
          <p className="mt-2 text-xs leading-5 text-cyan-100/80">{buyBoxGraph.nextMove}</p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {buyBoxGraph.lanes.map((lane) => (
              <div key={lane.key} className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium text-slate-200">{lane.label}</p>
                  <span className={cn("vb-mono text-xs font-semibold tabular-nums", kpiTone(lane.status))}>{lane.count}</span>
                </div>
                <p className="mt-1 text-[0.62rem] leading-4 text-slate-500">{lane.detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 space-y-2">
            {buyBoxGraph.recentProperties.length ? (
              buyBoxGraph.recentProperties.slice(0, 3).map((property) => (
                <div key={property.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-100">{property.propertyAddress}</p>
                      <p className="mt-1 text-[0.65rem] text-slate-500">
                        {property.market} · {property.grade} · {property.route}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-cyan-300/20 bg-cyan-300/[0.08] px-2 py-0.5 text-[0.58rem] text-cyan-100">
                      {property.suggestedLane}
                    </span>
                  </div>
                  <p className="mt-1 text-[0.62rem] leading-4 text-slate-600">{property.routeReason}</p>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs leading-5 text-slate-500">
                Run and save an analyzer result to create the first routing object.
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {buyBoxGraph.actions.map((action) => (
              <StreamActionButton
                key={action.id}
                action={action}
                runningActionId={runningActionId}
                onAction={onAction}
              />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-slate-950/55 p-4">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-cyan-200" />
            <h3 className="text-sm font-semibold text-white">Source cost governor</h3>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-400">{sourceGovernor.summary}</p>

          <div className="mt-3 space-y-2">
            {sourceGovernor.lanes.slice(0, 6).map((lane) => (
              <div key={lane.provider} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-100">{lane.label}</p>
                    <p className="mt-1 truncate text-[0.65rem] text-slate-500">{lane.reason}</p>
                  </div>
                  <span className={cn("vb-mono shrink-0 text-[0.58rem] uppercase tracking-[0.14em]", lane.status === "allowed" ? "text-emerald-300" : lane.status === "blocked" ? "text-rose-300" : "text-amber-300")}>
                    {lane.status}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[0.6rem] text-slate-500">
                    {lane.costTier}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[0.6rem] text-slate-500">
                    {lane.usedToday}/{lane.dailyLimit || "--"} today
                  </span>
                  {lane.nextAllowedAt ? (
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[0.6rem] text-slate-500">
                      next {timeAgo(lane.nextAllowedAt) ? `in ${timeAgo(lane.nextAllowedAt)}` : "soon"}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-slate-950/55 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              <h3 className="text-sm font-semibold text-white">Outbound governance</h3>
            </div>
            <span className={cn("vb-mono text-[0.62rem] uppercase tracking-[0.14em]", kpiTone(outboundGovernance.status))}>
              {outboundGovernance.status}
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-cyan-100/80">{outboundGovernance.nextGate}</p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {outboundGovernance.checks.map((metric) => (
              <div key={metric.label} className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
                <p className="vb-mono text-[0.55rem] uppercase tracking-[0.14em] text-slate-500">{metric.label}</p>
                <p className={cn("mt-1 truncate text-sm font-semibold tabular-nums", kpiTone(metric.status))}>{metric.value}</p>
                {metric.helper ? <p className="mt-0.5 text-[0.62rem] text-slate-500">{metric.helper}</p> : null}
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-slate-200">Active suppressions</p>
              <span className="vb-mono text-xs font-semibold tabular-nums text-cyan-200">{suppressionCenter.activeCount}</span>
            </div>
            <p className="mt-1 text-[0.65rem] leading-5 text-slate-500">
              DB {suppressionCenter.dbCount} · local {suppressionCenter.localCount}
              {suppressionCenter.missingDb ? " · database unavailable" : ""}
            </p>
          </div>

          <div className="mt-3 space-y-2">
            {suppressionCenter.recent.length ? (
              suppressionCenter.recent.slice(0, 3).map((item) => (
                <div key={`${item.email}-${item.createdAt || item.reason}`} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-slate-200">{item.email}</p>
                    <span className="vb-mono shrink-0 text-[0.58rem] uppercase tracking-[0.12em] text-slate-600">
                      {timeAgo(item.createdAt) || "saved"}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[0.65rem] text-slate-500">{item.reason}</p>
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs leading-5 text-slate-500">
                No active opt-out records are visible.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-slate-950/55 p-4">
          <div className="flex items-center gap-2">
            <Home className="h-4 w-4 text-cyan-200" />
            <h3 className="text-sm font-semibold text-white">Fresh listing sweep</h3>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-400">{onMarketSweep.summary}</p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
              <p className="vb-mono text-[0.55rem] uppercase tracking-[0.14em] text-slate-500">Sent</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-300">{onMarketSweep.sent}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
              <p className="vb-mono text-[0.55rem] uppercase tracking-[0.14em] text-slate-500">Failed</p>
              <p className={cn("mt-1 text-lg font-semibold tabular-nums", onMarketSweep.failed ? "text-rose-300" : "text-slate-300")}>
                {onMarketSweep.failed}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
              <p className="vb-mono text-[0.55rem] uppercase tracking-[0.14em] text-slate-500">Drafts</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-cyan-200">{onMarketSweep.draftCount}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
              <p className="vb-mono text-[0.55rem] uppercase tracking-[0.14em] text-slate-500">Agents</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-white">{onMarketSweep.uniqueEmails}</p>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-slate-200">Latest public batch</p>
              <span className="vb-mono shrink-0 text-[0.6rem] uppercase tracking-[0.12em] text-slate-500">
                {timeAgo(onMarketSweep.latestRunAt || onMarketSweep.latestDraftAt) || "not run"}
              </span>
            </div>
            <p className="mt-1 truncate text-[0.62rem] text-slate-600">
              {onMarketSweep.latestResultFile || onMarketSweep.latestDraftFile || "No local sweep artifact yet"}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {onMarketSweep.markets.length ? (
              onMarketSweep.markets.slice(0, 4).map((market) => (
                <span key={market.market} className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[0.65rem] text-slate-300">
                  {market.market} · {market.count}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-500">No public listing market mix yet.</span>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-slate-950/55 p-4">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-cyan-200" />
            <h3 className="text-sm font-semibold text-white">DealMachine freshness</h3>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-400">{dealMachineFreshness.summary}</p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
              <p className="vb-mono text-[0.55rem] uppercase tracking-[0.14em] text-slate-500">Fresh</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-300">{dealMachineFreshness.freshCount}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
              <p className="vb-mono text-[0.55rem] uppercase tracking-[0.14em] text-slate-500">Stale</p>
              <p className={cn("mt-1 text-lg font-semibold tabular-nums", dealMachineFreshness.staleCount ? "text-amber-300" : "text-slate-300")}>
                {dealMachineFreshness.staleCount}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <GitBranch className="h-3.5 w-3.5 text-cyan-200" />
              <p className="text-xs font-medium text-slate-200">Next refresh markets</p>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {dealMachineFreshness.nextRefreshMarkets.length ? (
                dealMachineFreshness.nextRefreshMarkets.map((market) => (
                  <span key={market} className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[0.65rem] text-slate-300">
                    {market}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-500">No saved export markets yet.</span>
              )}
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {dealMachineFreshness.topStale.length ? (
              dealMachineFreshness.topStale.map((file) => (
                <div key={file.file} className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs">
                  <div className="min-w-0">
                    <p className="truncate text-slate-200">{file.market}</p>
                    <p className="truncate text-[0.62rem] text-slate-600">{file.file}</p>
                  </div>
                  <span className="vb-mono shrink-0 text-[0.65rem] text-amber-300">{file.ageDays}d</span>
                </div>
              ))
            ) : (
              <div className="flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs leading-5 text-slate-500">
                <FileClock className="mt-0.5 h-3.5 w-3.5 text-emerald-300" />
                <p>Nothing stale is pressuring the export lane.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export function CommandCenterInboxPanel({
  summary,
  sections,
  runningActionId,
  onAction,
}: {
  summary: AgentKpi[]
  sections: CommandCenterInboxSection[]
  runningActionId: string | null
  onAction: (action: CommandCenterInlineAction) => void
}) {
  const reduce = useReducedMotion()

  return (
    <section
      id="inbox-command"
      className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 backdrop-blur-xl"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-cyan-200">
            <BellRing className="h-3.5 w-3.5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-white">Inbox command</h2>
            <p className="text-xs text-slate-500">hot replies, stale threads, and automation pressure on one rail</p>
          </div>
        </div>
        <span className="vb-mono text-[0.6rem] uppercase tracking-[0.18em] text-slate-500">live command</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {summary.map((metric) => (
          <div key={metric.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
            <p className="vb-mono text-[0.55rem] uppercase tracking-[0.14em] text-slate-500">{metric.label}</p>
            <p className={cn("mt-1 text-lg font-semibold tabular-nums", kpiTone(metric.status))}>{metric.value}</p>
            {metric.helper ? <p className="mt-0.5 text-[0.62rem] text-slate-500">{metric.helper}</p> : null}
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-4">
        {sections.map((section, index) => (
          <motion.div
            key={section.key}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-20px" }}
            transition={{ duration: 0.35, delay: index * 0.04 }}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{section.title}</p>
              <p className="vb-mono text-[0.58rem] uppercase tracking-[0.16em] text-slate-600">{section.hint}</p>
            </div>

            {section.items.length ? (
              <div className="space-y-2">
                {section.items.map((item) => (
                  <StreamItemCard
                    key={item.id}
                    item={item}
                    runningActionId={runningActionId}
                    onAction={onAction}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-xs leading-5 text-slate-500">
                No live items in this lane right now.
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </section>
  )
}

export function CommandCenterOutreachPanel({
  queues,
  outboundControl,
  runningActionId,
  onAction,
}: {
  queues: CommandCenterQueueCard[]
  outboundControl: CommandCenterOutboundControl
  runningActionId: string | null
  onAction: (action: CommandCenterInlineAction) => void
}) {
  const reduce = useReducedMotion()
  const liveSprintAction = outboundControl.recommendedSprintTarget
    ? ({
        id: "outbound-governor-live",
        type: "lead_throughput_sprint",
        label: `Push ${outboundControl.recommendedSprintTarget}`,
        target: outboundControl.recommendedSprintTarget,
        tone: "success",
      } satisfies CommandCenterInlineAction)
    : null
  const previewSprintAction = {
    id: "outbound-governor-preview",
    type: "lead_throughput_sprint",
    label: "Preview",
    target: Math.max(1, outboundControl.recommendedSprintTarget || Math.min(outboundControl.dailyLimit, outboundControl.maxSprintTarget)),
    dryRun: true,
  } satisfies CommandCenterInlineAction

  return (
    <section id="outreach-command" className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-cyan-200">
            <Mail className="h-3.5 w-3.5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-white">Outreach command</h2>
            <p className="text-xs text-slate-500">launch seller, buyer, lender, and builder work from the cockpit</p>
          </div>
        </div>
        <span className="vb-mono text-[0.6rem] uppercase tracking-[0.18em] text-slate-500">actionable lanes</span>
      </div>

      <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.045] p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-cyan-200" />
              <p className="text-sm font-semibold text-white">Daily outbound governor</p>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              {outboundControl.sender} · {outboundControl.provider} · SMS {outboundControl.smsMode.replace("_", " ")}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {liveSprintAction ? (
              <StreamActionButton
                action={liveSprintAction}
                runningActionId={runningActionId}
                onAction={onAction}
              />
            ) : null}
            <StreamActionButton
              action={previewSprintAction}
              runningActionId={runningActionId}
              onAction={onAction}
            />
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Daily cap", value: outboundControl.dailyLimit, status: "text-white" },
            { label: "Sent 24h", value: outboundControl.sent24h, status: outboundControl.sent24h ? "text-emerald-300" : "text-amber-300" },
            { label: "Remaining", value: outboundControl.remainingToday, status: outboundControl.remainingToday ? "text-cyan-200" : "text-emerald-300" },
            { label: "Email ready", value: outboundControl.emailReady, status: outboundControl.emailReady ? "text-emerald-300" : "text-rose-300" },
            { label: "Needs review", value: outboundControl.needsReview, status: outboundControl.needsReview ? "text-amber-300" : "text-slate-300" },
          ].map((metric) => (
            <div key={metric.label} className="rounded-xl border border-white/[0.06] bg-slate-950/50 px-3 py-2.5">
              <p className="vb-mono text-[0.55rem] uppercase tracking-[0.14em] text-slate-500">{metric.label}</p>
              <p className={cn("mt-1 text-lg font-semibold tabular-nums", metric.status)}>{metric.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-400 xl:grid-cols-2">
          <div className="flex items-start gap-2 rounded-xl border border-white/[0.06] bg-slate-950/45 px-3 py-2">
            <ShieldCheck className={cn("mt-0.5 h-4 w-4", outboundControl.mailingAddressConfigured && outboundControl.autoSendEnabled ? "text-emerald-300" : "text-amber-300")} />
            <p>
              Auto-send {outboundControl.autoSendEnabled ? "on" : "off"} · mailing address {outboundControl.mailingAddressConfigured ? "set" : "missing"}
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/45 px-3 py-2">
            {outboundControl.smsReason}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {queues.map((queue, index) => (
          <motion.div
            key={queue.key}
            initial={reduce ? false : { opacity: 0, y: 16 }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-20px" }}
            transition={{ duration: 0.35, delay: index * 0.05 }}
            className="rounded-2xl border border-white/[0.06] bg-slate-950/55 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{queue.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{queue.detail}</p>
              </div>
              <button
                type="button"
                onClick={() => onAction({ id: `${queue.key}-open-link`, type: "navigate", label: "Open", href: queue.href })}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[0.65rem] font-medium text-slate-200 transition-colors hover:border-cyan-300/35 hover:text-white"
              >
                Open
                <ArrowUpRight className="h-3 w-3 opacity-60" />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {queue.kpis.map((metric) => (
                <div key={metric.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                  <p className="vb-mono text-[0.55rem] uppercase tracking-[0.14em] text-slate-500">{metric.label}</p>
                  <p className={cn("mt-1 text-base font-semibold tabular-nums", kpiTone(metric.status))}>{metric.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {queue.actions.map((action) => (
                <StreamActionButton
                  key={action.id}
                  action={action}
                  runningActionId={runningActionId}
                  onAction={onAction}
                />
              ))}
            </div>

            <div className="mt-4 space-y-2">
              {queue.items.length ? (
                queue.items.map((item) => (
                  <StreamItemCard
                    key={item.id}
                    item={item}
                    runningActionId={runningActionId}
                    onAction={onAction}
                  />
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 px-3 py-3 text-xs leading-5 text-slate-500">
                  No live items here right now. This lane is clear or waiting on the next batch.
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-white/[0.06] bg-slate-950/55 px-4 py-3 text-xs leading-5 text-slate-400">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-cyan-200" />
          <p>
            Use the inline buttons for quick approvals and sends. For deeper review, the lane links still open the full queue without losing command-center context.
          </p>
        </div>
      </div>
    </section>
  )
}
