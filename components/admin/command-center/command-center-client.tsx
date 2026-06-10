"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CircleDollarSign,
  Crosshair,
  Flame,
  ListChecks,
  RefreshCw,
  Radar,
  ShieldAlert,
  Signal,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { MissionCore } from "./mission-core"
import { BossAgentPanel } from "./boss-agent-panel"
import type { AgentKey, AgentPanelData, CommandCenterData, CommandStatus } from "@/lib/admin/commandCenter"
import type { BossBriefing } from "@/lib/admin/bossAgent"

const AGENT_ACCENTS: Record<AgentKey, { dot: string; ring: string; text: string }> = {
  acquisition: { dot: "bg-cyan-400", ring: "ring-cyan-400/40", text: "text-cyan-300" },
  outreach: { dot: "bg-blue-400", ring: "ring-blue-400/40", text: "text-blue-300" },
  routing: { dot: "bg-emerald-400", ring: "ring-emerald-400/40", text: "text-emerald-300" },
  underwriting: { dot: "bg-amber-300", ring: "ring-amber-300/40", text: "text-amber-200" },
  authority: { dot: "bg-violet-400", ring: "ring-violet-400/40", text: "text-violet-300" },
  qa: { dot: "bg-rose-400", ring: "ring-rose-400/40", text: "text-rose-300" },
  operator: { dot: "bg-slate-200", ring: "ring-slate-300/40", text: "text-slate-200" },
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
}

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

function kpiTone(status?: CommandStatus) {
  if (status === "green") return "text-emerald-300"
  if (status === "yellow") return "text-amber-300"
  if (status === "red") return "text-rose-400"
  return "text-white"
}

function statusLabel(status: AgentPanelData["status"]) {
  if (status === "active") return "Active"
  if (status === "attention") return "Needs attention"
  return "Idle"
}

// ── Panels ─────────────────────────────────────────────────────────────────

function PanelShell({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const reduce = useReducedMotion()
  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay }}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] p-5 backdrop-blur-xl",
        className
      )}
    >
      {children}
    </motion.section>
  )
}

function PanelTitle({ icon: Icon, title, hint }: { icon: React.ElementType; title: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-cyan-200">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>
      {hint ? <p className="vb-mono text-[0.6rem] uppercase tracking-[0.18em] text-slate-500">{hint}</p> : null}
    </div>
  )
}

function AgentPanel({
  agent,
  focused,
  onFocus,
}: {
  agent: AgentPanelData
  focused: boolean
  onFocus: (key: AgentKey | null) => void
}) {
  const accent = AGENT_ACCENTS[agent.key]
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (focused && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }, [focused])

  return (
    <div
      ref={ref}
      onMouseEnter={() => onFocus(agent.key)}
      onMouseLeave={() => onFocus(null)}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] p-5 backdrop-blur-xl transition-all duration-300",
        focused && `ring-2 ${accent.ring} border-transparent`
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              {agent.status !== "idle" ? (
                <span
                  className={cn(
                    "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
                    agent.status === "attention" ? "bg-amber-400" : accent.dot
                  )}
                />
              ) : null}
              <span
                className={cn(
                  "relative inline-flex h-2 w-2 rounded-full",
                  agent.status === "attention" ? "bg-amber-400" : agent.status === "idle" ? "bg-slate-600" : accent.dot
                )}
              />
            </span>
            <h3 className="text-base font-semibold text-white">{agent.name}</h3>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-400">{agent.role}</p>
        </div>
        <span
          className={cn(
            "vb-mono shrink-0 rounded-full border px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.14em]",
            agent.status === "attention"
              ? "border-amber-300/30 bg-amber-300/10 text-amber-200"
              : agent.status === "active"
                ? "border-white/10 bg-white/[0.04] text-slate-300"
                : "border-white/5 bg-white/[0.02] text-slate-500"
          )}
        >
          {statusLabel(agent.status)}
        </span>
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-300/90">{agent.statusReason}</p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {agent.kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
            <p className="vb-mono text-[0.58rem] uppercase tracking-[0.14em] text-slate-500">{kpi.label}</p>
            <p className={cn("mt-1 text-lg font-semibold tabular-nums", kpiTone(kpi.status))}>{kpi.value}</p>
            {kpi.helper ? <p className="mt-0.5 text-[0.65rem] leading-4 text-slate-500">{kpi.helper}</p> : null}
          </div>
        ))}
      </div>

      {agent.feed.length ? (
        <div className="mt-4 space-y-1.5 border-t border-white/[0.06] pt-3">
          {agent.feed.slice(0, 3).map((item, index) => (
            <div key={`${item.label}-${index}`} className="flex items-baseline justify-between gap-2 text-xs">
              <p className="truncate text-slate-300">
                {item.label} <span className="text-slate-500">· {item.detail}</span>
              </p>
              <span className="vb-mono shrink-0 text-[0.6rem] text-slate-600">{timeAgo(item.at)}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
        {agent.actions.map((action) => (
          <Link
            key={action.href + action.label}
            href={action.href}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-cyan-300/40 hover:text-white"
            )}
          >
            {action.label}
            <ArrowUpRight className="h-3 w-3 opacity-60" />
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────

export function CommandCenterClient({
  initialData,
  initialBriefing,
}: {
  initialData: CommandCenterData
  initialBriefing?: BossBriefing | null
}) {
  const [data, setData] = useState(initialData)
  const [briefing, setBriefing] = useState(initialBriefing ?? null)
  const [refreshing, setRefreshing] = useState(false)
  const [focusedAgent, setFocusedAgent] = useState<AgentKey | null>(null)
  const reduce = useReducedMotion()

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const [commandCenterResponse, briefingResponse] = await Promise.all([
        fetch("/api/admin/command-center", { cache: "no-store" }),
        fetch("/api/admin/boss-agent", { cache: "no-store" }),
      ])

      if (commandCenterResponse.ok) {
        const next = (await commandCenterResponse.json()) as CommandCenterData
        setData(next)
      }

      if (briefingResponse.ok) {
        const nextBriefing = (await briefingResponse.json()) as BossBriefing
        setBriefing(nextBriefing)
      }
    } catch {
      // keep showing current data
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(refresh, 120000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const summaryChips = [
    { label: "Revenue 30d", value: money(data.summary.revenue30d), sub: `target ${money(data.summary.revenueTarget)}` },
    { label: "Outreach 24h", value: `${data.summary.outreach24h}`, sub: `target ${data.summary.outreachTarget}` },
    { label: "New leads 24h", value: `${data.summary.newLeads24h}`, sub: "all sources" },
    { label: "Replies 7d", value: `${data.summary.replySignals7d}`, sub: "live conversations" },
    { label: "Active partners", value: `${data.summary.activePartners}`, sub: "buyers + lenders" },
  ]

  const criticalAlerts = data.alerts.filter((alert) => alert.severity === "critical")

  return (
    <div className="space-y-5">
      {/* Top strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="vb-mono text-[0.65rem] uppercase tracking-[0.3em] text-cyan-300/80">VestBlock · Operator Cockpit</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white md:text-3xl">Command Center</h1>
        </div>
        <div className="flex items-center gap-3">
          {criticalAlerts.length ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-xs font-medium text-rose-200">
              <ShieldAlert className="h-3.5 w-3.5" />
              {criticalAlerts.length} critical
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-1 text-xs font-medium text-emerald-200">
              <Signal className="h-3.5 w-3.5" />
              Systems nominal
            </span>
          )}
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-cyan-300/40 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            {refreshing ? "Syncing" : `Synced ${timeAgo(data.generatedAt) || "now"} ago`}
          </button>
        </div>
      </div>

      {/* Hero: mission core + priorities/alerts */}
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <PanelShell className="min-h-[460px] p-0">
          <div className="relative h-full min-h-[460px]">
            <MissionCore nodes={data.missionNodes} focusedAgent={focusedAgent} onAgentClick={setFocusedAgent} />

            {/* Legend overlay */}
            <div className="pointer-events-none absolute left-4 top-4">
              <p className="vb-mono text-[0.6rem] uppercase tracking-[0.24em] text-slate-400">Live intelligence map</p>
              <p className="mt-1 max-w-[230px] text-xs leading-5 text-slate-500">
                Each node is an operating agent. Pulse and flow reflect real activity. Click a node to focus its panel.
              </p>
            </div>

            {/* Agent legend */}
            <div className="pointer-events-auto absolute bottom-4 left-4 flex max-w-full flex-wrap gap-1.5 pr-4">
              {data.agents.map((agent) => {
                const accent = AGENT_ACCENTS[agent.key]
                return (
                  <button
                    key={agent.key}
                    type="button"
                    onClick={() => setFocusedAgent(focusedAgent === agent.key ? null : agent.key)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.65rem] font-medium transition-colors",
                      focusedAgent === agent.key
                        ? "border-cyan-300/50 bg-cyan-300/10 text-white"
                        : "border-white/10 bg-slate-950/60 text-slate-300 hover:border-white/25"
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", accent.dot)} />
                    {agent.name}
                  </button>
                )
              })}
            </div>

            {/* Summary chips */}
            <div className="pointer-events-none absolute right-4 top-4 hidden w-44 space-y-2 md:block">
              {summaryChips.map((chip) => (
                <div key={chip.label} className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 backdrop-blur">
                  <p className="vb-mono text-[0.55rem] uppercase tracking-[0.16em] text-slate-500">{chip.label}</p>
                  <p className="text-base font-semibold tabular-nums text-white">{chip.value}</p>
                  <p className="text-[0.6rem] text-slate-500">{chip.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </PanelShell>

        <div className="flex flex-col gap-4">
          {/* Priorities */}
          <PanelShell className="flex-1" delay={0.05}>
            <PanelTitle icon={Crosshair} title="Today’s priorities" hint="ranked" />
            <div className="mt-3 space-y-2">
              {data.priorities.length ? (
                data.priorities.map((priority, index) => (
                  <div
                    key={priority}
                    className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                  >
                    <span className="vb-mono mt-0.5 text-[0.65rem] font-semibold text-cyan-300">{String(index + 1).padStart(2, "0")}</span>
                    <p className="text-xs leading-5 text-slate-200">{priority}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500">No urgent priorities detected. Work the routing queue.</p>
              )}
            </div>
          </PanelShell>

          {/* Alerts */}
          <PanelShell delay={0.1}>
            <PanelTitle icon={AlertTriangle} title="Blockers & alerts" hint={`${data.alerts.length} open`} />
            <div className="mt-3 space-y-2">
              {data.alerts.length ? (
                data.alerts.map((alert) => {
                  const body = (
                    <div
                      className={cn(
                        "flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-xs leading-5 transition-colors",
                        alert.severity === "critical"
                          ? "border-rose-400/25 bg-rose-400/[0.07] text-rose-100"
                          : alert.severity === "warning"
                            ? "border-amber-300/20 bg-amber-300/[0.06] text-amber-100"
                            : "border-white/[0.06] bg-white/[0.02] text-slate-300",
                        alert.href && "hover:border-white/25"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                          alert.severity === "critical" ? "bg-rose-400" : alert.severity === "warning" ? "bg-amber-300" : "bg-slate-500"
                        )}
                      />
                      <span className="flex-1">{alert.message}</span>
                      {alert.href ? <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 opacity-50" /> : null}
                    </div>
                  )
                  return alert.href ? (
                    <Link key={alert.message} href={alert.href} className="block">
                      {body}
                    </Link>
                  ) : (
                    <div key={alert.message}>{body}</div>
                  )
                })
              ) : (
                <p className="text-xs text-slate-500">Nothing blocking. Keep cadence.</p>
              )}
            </div>
          </PanelShell>
        </div>
      </div>

      {/* Boss agent strategy deck */}
      {briefing ? <BossAgentPanel briefing={briefing} onDispatched={refresh} /> : null}

      {/* Data source warning */}
      {!data.liveDataReachable ? (
        <PanelShell className="border-amber-300/25 bg-amber-300/[0.05]">
          <PanelTitle icon={ShieldAlert} title="Some data sources unreachable" hint={`${data.dataSourceIssues.length} sources`} />
          <p className="mt-2 text-xs leading-5 text-amber-100/80">
            Zero counts from these sources are not verified business activity:{" "}
            {data.dataSourceIssues.map((issue) => issue.source).join(", ")}.
          </p>
        </PanelShell>
      ) : null}

      {/* Agent grid */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Operating agents</h2>
          <p className="vb-mono text-[0.6rem] uppercase tracking-[0.16em] text-slate-600">7 parallel lanes</p>
        </div>
        <motion.div
          initial={reduce ? false : { opacity: 0 }}
          whileInView={reduce ? undefined : { opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {data.agents.map((agent) => (
            <AgentPanel key={agent.key} agent={agent} focused={focusedAgent === agent.key} onFocus={setFocusedAgent} />
          ))}

          {/* Routing queue tile completes the grid */}
          <PanelShell className="flex flex-col" delay={0.05}>
            <PanelTitle icon={ListChecks} title="Routing queue" hint="open work" />
            <div className="mt-3 flex-1 space-y-2">
              {data.routingQueue.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-cyan-300/35"
                >
                  <p className="text-xs text-slate-200">{item.label}</p>
                  <span
                    className={cn(
                      "vb-mono rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
                      item.count > 0 ? "bg-cyan-400/10 text-cyan-200" : "bg-white/[0.03] text-slate-600"
                    )}
                  >
                    {item.count}
                  </span>
                </Link>
              ))}
            </div>
          </PanelShell>
        </motion.div>
      </div>

      {/* Market heat + capital + local signals */}
      <div className="grid gap-4 lg:grid-cols-3">
        <PanelShell>
          <PanelTitle icon={Flame} title="Market heat" hint="lead momentum" />
          <div className="mt-3 space-y-2.5">
            {data.marketHeat.length ? (
              data.marketHeat.map((market) => (
                <div key={market.market}>
                  <div className="flex items-baseline justify-between text-xs">
                    <p className="font-medium text-slate-200">{market.market}</p>
                    <p className="vb-mono text-[0.65rem] text-slate-500">
                      {market.leads} leads · {market.recent7d} new 7d{market.replied ? ` · ${market.replied} replied` : ""}
                    </p>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400/80 to-amber-300/80 transition-[width] duration-700"
                      style={{ width: `${Math.max(4, market.heat)}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs leading-5 text-slate-500">
                No market activity yet. New leads with city data will rank here automatically.
              </p>
            )}
          </div>
        </PanelShell>

        <PanelShell delay={0.05}>
          <PanelTitle icon={CircleDollarSign} title="Capital desk" hint="funding readiness" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3">
              <p className="vb-mono text-[0.58rem] uppercase tracking-[0.14em] text-slate-500">Revenue 30d</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-white">{money(data.summary.revenue30d)}</p>
              <p className="mt-0.5 text-[0.65rem] text-slate-500">
                {money(Math.max(0, data.summary.revenueTarget - data.summary.revenue30d))} to target
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3">
              <p className="vb-mono text-[0.58rem] uppercase tracking-[0.14em] text-slate-500">Paid requests</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-white">{data.summary.paidFundingRequests}</p>
              <p className="mt-0.5 text-[0.65rem] text-slate-500">funding strategy</p>
            </div>
          </div>
          <Link
            href="/admin/funding"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-cyan-200 hover:text-white"
          >
            Open funding pipeline <ArrowRight className="h-3 w-3" />
          </Link>
        </PanelShell>

        <PanelShell delay={0.1}>
          <PanelTitle icon={Radar} title="DealMachine lane" hint="local signals" />
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
              <p className="text-slate-200">Distress stack rows</p>
              <span className="vb-mono font-semibold tabular-nums text-cyan-200">
                {data.localSignals.distressStackRows ?? "n/a"}
              </span>
            </div>
            {data.localSignals.dmExports.length ? (
              data.localSignals.dmExports.map((file) => (
                <div
                  key={file.file}
                  className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                >
                  <p className="truncate pr-2 text-slate-300">{file.file}</p>
                  <span
                    className={cn(
                      "vb-mono shrink-0 text-[0.65rem]",
                      file.ageDays > 7 ? "text-amber-300" : "text-slate-500"
                    )}
                  >
                    {file.ageDays === 0 ? "today" : `${file.ageDays}d old`}
                  </span>
                </div>
              ))
            ) : (
              <p className="leading-5 text-slate-500">
                No contact exports on disk. Export Contacts from DealMachine, then run{" "}
                <code className="vb-mono text-cyan-300/90">npm run distress:dealmachine:ingest-export:apply</code>.
              </p>
            )}
          </div>
        </PanelShell>
      </div>

      {/* Activity dock */}
      <PanelShell className="p-0">
        <div className="border-b border-white/[0.06] px-5 py-3">
          <PanelTitle icon={Activity} title="System feed" hint="latest events" />
        </div>
        <div className="max-h-72 overflow-y-auto px-5 py-3">
          {data.activity.length ? (
            <div className="space-y-1">
              {data.activity.map((item, index) => (
                <div
                  key={`${item.at}-${index}`}
                  className="flex items-baseline gap-3 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-white/[0.03]"
                >
                  <span className="vb-mono w-10 shrink-0 text-right text-[0.65rem] text-slate-600">{timeAgo(item.at)}</span>
                  <span
                    className={cn(
                      "vb-mono w-20 shrink-0 text-[0.62rem] uppercase tracking-[0.12em]",
                      item.source === "Outreach"
                        ? "text-blue-300/80"
                        : item.source === "Leads"
                          ? "text-cyan-300/80"
                          : item.source === "Authority"
                            ? "text-violet-300/80"
                            : item.source === "Sources"
                              ? "text-rose-300/70"
                              : "text-slate-400"
                    )}
                  >
                    {item.source}
                  </span>
                  <span className="truncate text-slate-300">{item.message}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-xs text-slate-500">
              No recorded events yet. As leads, sends, source runs, and published assets land, they stream here.
            </p>
          )}
        </div>
      </PanelShell>
    </div>
  )
}
