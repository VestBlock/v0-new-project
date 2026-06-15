"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bot,
  CheckCheck,
  Crosshair,
  Flame,
  ListChecks,
  RefreshCw,
  ShieldAlert,
  Signal,
} from "lucide-react"

import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { CommandCenterAnalyzerPanel, type PropertyCommandSeed } from "./command-center-analyzer-panel"
import { CommandCenterCopilotPanel } from "./command-center-copilot-panel"
import { CommandCenterStrategyPanel } from "./command-center-strategy-panel"
import {
  CommandCenterInboxPanel,
  CommandCenterOutreachPanel,
  CommandCenterStrategyOpsPanel,
} from "./command-center-control-surfaces"
import type { CommandCenterModeKey } from "./command-center-types"
import type {
  AgentKey,
  AgentPanelData,
  CommandCenterData,
  CommandCenterInlineAction,
  CommandStatus,
} from "@/lib/admin/commandCenter"

type OperationsViewKey = "copilot" | "property" | "strategy" | "lanes" | "intel" | "activity"

const AGENT_ACCENTS: Record<AgentKey, { dot: string; ring: string; text: string }> = {
  acquisition: { dot: "bg-cyan-400", ring: "ring-cyan-400/40", text: "text-cyan-300" },
  outreach: { dot: "bg-blue-400", ring: "ring-blue-400/40", text: "text-blue-300" },
  routing: { dot: "bg-emerald-400", ring: "ring-emerald-400/40", text: "text-emerald-300" },
  underwriting: { dot: "bg-amber-300", ring: "ring-amber-300/40", text: "text-amber-200" },
  authority: { dot: "bg-violet-400", ring: "ring-violet-400/40", text: "text-violet-300" },
  qa: { dot: "bg-rose-400", ring: "ring-rose-400/40", text: "text-rose-300" },
  operator: { dot: "bg-slate-200", ring: "ring-slate-300/40", text: "text-slate-200" },
}

const MODE_TO_AGENT: Record<CommandCenterModeKey, AgentKey> = {
  acquire: "acquisition",
  analyze: "underwriting",
  route: "routing",
  outreach: "outreach",
  capital: "underwriting",
  authority: "authority",
}

const MODE_TO_DOCK: Record<CommandCenterModeKey, OperationsViewKey> = {
  acquire: "lanes",
  analyze: "property",
  route: "lanes",
  outreach: "lanes",
  capital: "property",
  authority: "strategy",
}

const DOCK_COPY: Record<
  OperationsViewKey,
  { title: string; detail: string; hint: string }
> = {
  copilot: {
    title: "Codex console",
    detail: "Ask Codex what matters now, run the next move, and stay inside the cockpit while you shift between strategy, analysis, inbox work, and outreach.",
    hint: "embedded operator",
  },
  property: {
    title: "Property command",
    detail: "Address-level analysis, creative paths, packet actions, and route fit stay docked here instead of living on a different page.",
    hint: "analyze and package",
  },
  strategy: {
    title: "Boss strategy engine",
    detail: "Ranked plays, feedback loops, and the operator-level why-now reasoning for the next move.",
    hint: "deploy and learn",
  },
  lanes: {
    title: "Lane diagnostics",
    detail: "Core operator lanes and support systems in one place so you can see which part of the machine is carrying or slipping.",
    hint: "lane pressure",
  },
  intel: {
    title: "Market watch",
    detail: "Market heat, partner fit, DealMachine inventory context, and the partner-side signals that sharpen routing.",
    hint: "secondary intelligence",
  },
  activity: {
    title: "System activity",
    detail: "A live operator log for sends, source runs, content, and recent movement across the machine.",
    hint: "live stream",
  },
}

type CommandIntent =
  | {
      kind: "analyze"
      title: string
      detail: string
      actionLabel: string
      address?: string
    }
  | {
      kind: "scroll"
      title: string
      detail: string
      actionLabel: string
      targetId: string
      mode: CommandCenterModeKey
      focusAgent?: AgentKey
    }
  | {
      kind: "navigate"
      title: string
      detail: string
      actionLabel: string
      href: string
      mode: CommandCenterModeKey
      focusAgent?: AgentKey
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

function priorityTone(priority: string) {
  if (priority === "urgent") return "border-rose-400/30 bg-rose-400/10 text-rose-200"
  if (priority === "high") return "border-amber-300/30 bg-amber-300/10 text-amber-200"
  if (priority === "low") return "border-white/10 bg-white/[0.03] text-slate-400"
  return "border-white/10 bg-white/[0.03] text-slate-200"
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
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] p-5 backdrop-blur-xl",
        className
      )}
    >
      {children}
    </section>
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

function FeedRow({ item }: { item: AgentPanelData["feed"][number] }) {
  const body = (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <p className="truncate text-slate-300">
        {item.label} <span className="text-slate-500">· {item.detail}</span>
      </p>
      <span className="vb-mono shrink-0 text-[0.6rem] text-slate-600">{timeAgo(item.at)}</span>
    </div>
  )

  if (!item.href) return body

  return (
    <Link href={item.href} className="block rounded-lg px-1 py-1 transition-colors hover:bg-white/[0.03]">
      {body}
    </Link>
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
  const didMountRef = useRef(false)

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
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
            <FeedRow key={`${item.label}-${index}`} item={item} />
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
  initialBossBriefing,
}: {
  initialData: CommandCenterData
  initialBossBriefing: ComponentProps<typeof CommandCenterStrategyPanel>["initialBriefing"]
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [data, setData] = useState(initialData)
  const [refreshing, setRefreshing] = useState(false)
  const [activeMode, setActiveMode] = useState<CommandCenterModeKey>("acquire")
  const [operationsView, setOperationsView] = useState<OperationsViewKey>(MODE_TO_DOCK.acquire)
  const [focusedAgent, setFocusedAgent] = useState<AgentKey | null>(MODE_TO_AGENT.acquire)
  const [copilotSeed, setCopilotSeed] = useState<{ id: number; prompt: string; autoSubmit?: boolean } | null>(null)
  const [propertyCommandSeed, setPropertyCommandSeed] = useState<PropertyCommandSeed | null>(null)
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null)
  const [runningActionId, setRunningActionId] = useState<string | null>(null)

  const handleCommandCenterAuthFailure = useCallback(
    (status: number, message?: string) => {
      if (status === 401) {
        toast({
          title: "Session expired",
          description: "Sign back in to reopen the command center.",
          variant: "destructive",
        })
        router.replace(`/login?redirect=${encodeURIComponent("/admin/command-center")}`)
        return true
      }

      if (status === 403) {
        toast({
          title: "Admin access needed",
          description:
            message ||
            "This account is signed in, but it is not configured as a VestBlock admin.",
          variant: "destructive",
        })
        return true
      }

      return false
    },
    [router, toast]
  )

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const commandCenterResponse = await fetch("/api/admin/command-center", { cache: "no-store" })

      if (commandCenterResponse.ok) {
        const next = (await commandCenterResponse.json()) as CommandCenterData
        setData(next)
      } else {
        const payload = await commandCenterResponse.json().catch(() => ({}))
        handleCommandCenterAuthFailure(commandCenterResponse.status, payload?.error)
      }
    } catch {
      // keep showing current data
    } finally {
      setRefreshing(false)
    }
  }, [handleCommandCenterAuthFailure])

  useEffect(() => {
    const timer = window.setInterval(refresh, 120000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const scrollToSection = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  const openDockTarget = useCallback(
    (targetId: string) => {
      const dockView =
        targetId === "codex-console"
          ? "copilot"
          : targetId === "property-command"
          ? "property"
          : targetId === "strategy-engine"
            ? "strategy"
            : targetId === "lane-diagnostics"
              ? "lanes"
              : targetId === "market-watch"
                ? "intel"
                : targetId === "system-activity"
                  ? "activity"
                  : null

      if (dockView) {
        setOperationsView(dockView)
        requestAnimationFrame(() => {
          scrollToSection("operations-dock")
          requestAnimationFrame(() => {
            document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" })
          })
        })
        return
      }

      scrollToSection(targetId)
    },
    [scrollToSection]
  )

  const dispatchPropertyCommand = useCallback(
    (address?: string) => {
      const propertyAddress = address?.trim()
      const detail = propertyAddress ? { propertyAddress } : {}

      setOperationsView("property")
      if (propertyAddress) {
        setPropertyCommandSeed({
          id: Date.now(),
          propertyAddress,
        })
      }
      openDockTarget("property-command")

      requestAnimationFrame(() => {
        window.dispatchEvent(
          new CustomEvent("vestblock:property-command", {
            detail,
          })
        )
      })
    },
    [openDockTarget]
  )

  const setModeAndFocus = useCallback((mode: CommandCenterModeKey) => {
    setActiveMode(mode)
    setOperationsView(MODE_TO_DOCK[mode])
    setFocusedAgent(MODE_TO_AGENT[mode])
  }, [])

  const openCopilotWithPrompt = useCallback(
    (prompt: string, autoSubmit = false, options?: { mode?: CommandCenterModeKey; focusAgent?: AgentKey | null }) => {
      if (options?.mode) setModeAndFocus(options.mode)
      if (options?.focusAgent) setFocusedAgent(options.focusAgent)
      setCopilotSeed({
        id: Date.now(),
        prompt,
        autoSubmit,
      })
      requestAnimationFrame(() => openDockTarget("codex-console"))
    },
    [openDockTarget, setModeAndFocus]
  )

  const updateTask = useCallback(
    async (taskId: string, status: "completed" | "in_progress") => {
      setUpdatingTaskId(taskId)
      try {
        const response = await fetch("/api/admin/tasks", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ taskId, status }),
        })

        if (response.ok) {
          await refresh()
        }
      } catch {
        // keep current state visible if update fails
      } finally {
        setUpdatingTaskId(null)
      }
    },
    [refresh]
  )

  const runInlineAction = useCallback(
    async (action: CommandCenterInlineAction) => {
      if (action.type === "navigate") {
        if (action.href.startsWith("#")) {
          openDockTarget(action.href.replace("#", ""))
          return
        }
        router.push(action.href)
        return
      }

      setRunningActionId(action.id)
      try {
        let response: Response | null = null
        let successDescription = `${action.label} completed from the command center.`
        let partialWarning: string | null = null

        const patchJson = (url: string, body: Record<string, unknown>) =>
          fetch(url, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          })

        const postJson = (url: string, body: Record<string, unknown>) =>
          fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          })

        switch (action.type) {
          case "lead_bulk":
            response = await postJson("/api/admin/leads/bulk", {
              leadIds: action.leadIds,
              action: action.action,
            })
            successDescription = `${action.label} ran for ${action.leadIds.length} seller lead${action.leadIds.length === 1 ? "" : "s"}.`
            break
          case "buyer_bulk":
            response = await postJson("/api/admin/buyers/bulk", {
              buyerIds: action.buyerIds,
              action: action.action,
            })
            successDescription = `${action.label} ran for ${action.buyerIds.length} buyer${action.buyerIds.length === 1 ? "" : "s"}.`
            break
          case "lender_bulk":
            response = await postJson("/api/admin/lenders/bulk", {
              lenderIds: action.lenderIds,
              action: action.action,
            })
            successDescription = `${action.label} ran for ${action.lenderIds.length} lender${action.lenderIds.length === 1 ? "" : "s"}.`
            break
          case "investor_bulk":
            response = await postJson("/api/admin/investor-partnerships/bulk", {
              investorIds: action.investorIds,
              action: action.action,
            })
            successDescription = `${action.label} ran for ${action.investorIds.length} partner profile${action.investorIds.length === 1 ? "" : "s"}.`
            break
          case "lead_status":
            response = await patchJson("/api/admin/leads", { id: action.leadId, status: action.status })
            break
          case "lead_outreach":
            response = await patchJson(`/api/admin/leads/${action.leadId}/outreach`, {
              messageId: action.messageId,
              ...(action.status ? { status: action.status } : {}),
              ...(action.sendNow ? { sendNow: true } : {}),
            })
            break
          case "buyer_outreach":
            response = await patchJson(`/api/admin/buyers/${action.buyerId}/outreach`, {
              messageId: action.messageId,
              ...(action.status ? { status: action.status } : {}),
              ...(action.sendNow ? { sendNow: true } : {}),
            })
            break
          case "lender_outreach":
            response = await patchJson(`/api/admin/lenders/${action.lenderId}/outreach`, {
              messageId: action.messageId,
              ...(action.status ? { status: action.status } : {}),
              ...(action.sendNow ? { sendNow: true } : {}),
            })
            break
          case "lead_send_batch": {
            const results = await Promise.allSettled(
              action.messages.map((message) =>
                patchJson(`/api/admin/leads/${message.leadId}/outreach`, {
                  messageId: message.messageId,
                  sendNow: true,
                })
              )
            )
            const settledResponses = await Promise.all(
              results.map(async (result) => {
                if (result.status !== "fulfilled") return { ok: false, error: result.reason }
                if (result.value.ok) return { ok: true }
                const payload = await result.value.json().catch(() => ({}))
                return { ok: false, error: payload?.error || "Send failed." }
              })
            )
            const sent = settledResponses.filter((result) => result.ok).length
            const failed = settledResponses.length - sent
            if (sent === 0) {
              throw new Error(
                settledResponses.find((result) => !result.ok)?.error instanceof Error
                  ? (settledResponses.find((result) => !result.ok)?.error as Error).message
                  : "No seller emails were sent."
              )
            }
            successDescription = `${sent} seller email${sent === 1 ? "" : "s"} sent from the cockpit.`
            if (failed > 0) partialWarning = `${failed} seller send${failed === 1 ? "" : "s"} failed and should be checked in the full queue.`
            break
          }
          case "lead_throughput_sprint": {
            response = await postJson("/api/admin/command-center/outbound", {
              target: action.target,
              dryRun: Boolean(action.dryRun),
            })
            const payload = await response.clone().json().catch(() => ({}))
            if (response.ok) {
              const sentTotal = Number(payload?.sentTotal || 0)
              const remainingTarget = Number(payload?.remainingTarget || 0)
              const autoApprovedTotal = Number(payload?.autoApprovedTotal || 0)
              const enrichedInQueueTotal = Number(payload?.enrichedInQueueTotal || 0)
              successDescription = action.dryRun
                ? `Preview reviewed a ${action.target}-send sprint. ${sentTotal} would send, ${remainingTarget} would remain.`
                : `${sentTotal} seller email${sentTotal === 1 ? "" : "s"} sent toward the daily cap.`
              if (!action.dryRun && remainingTarget > 0) {
                partialWarning = `${remainingTarget} still short of the sprint target. Auto-approved ${autoApprovedTotal}; enriched ${enrichedInQueueTotal}.`
              }
              if (payload?.truncated) {
                partialWarning = partialWarning
                  ? `${partialWarning} Sprint stopped on runtime budget.`
                  : "Sprint stopped on runtime budget."
              }
            }
            break
          }
          case "boss_daily_loop": {
            response = await postJson("/api/admin/command-center/loops", {
              dryRun: action.dryRun !== false,
              dispatch: Boolean(action.dispatch),
              send: Boolean(action.send),
            })
            const payload = await response.clone().json().catch(() => ({}))
            if (response.ok) {
              const bossName = payload?.boss?.focusName || "the focus play"
              const dispatchMessage = payload?.dispatchResult?.message
              const sendMessage = payload?.sendAttempt?.message
              successDescription = action.dryRun !== false
                ? `Loop preview complete. Boss focus is ${bossName}.`
                : `Daily loop ran for ${bossName}.`
              partialWarning = [dispatchMessage, sendMessage].filter(Boolean).join(" ")
            }
            break
          }
          case "command_center_autopilot": {
            response = await postJson("/api/admin/command-center/autopilot", {
              dryRun: action.dryRun !== false,
              dispatch: Boolean(action.dispatch),
              send: Boolean(action.send),
            })
            const payload = await response.clone().json().catch(() => ({}))
            if (response.ok) {
              const mode = payload?.snapshot?.mode || "plan"
              const jobsSeeded = Number(payload?.persist?.jobsSeeded || 0)
              const strategyRunsWritten = Number(payload?.persist?.strategyRunsWritten || 0)
              const replyMemoriesWritten = Number(payload?.persist?.replyMemoriesWritten || 0)
              successDescription = action.dryRun !== false
                ? `Autopilot seeded ${jobsSeeded} job${jobsSeeded === 1 ? "" : "s"} and built a ${mode} plan.`
                : `Autopilot dispatched ${strategyRunsWritten} strategy run${strategyRunsWritten === 1 ? "" : "s"}.`
              partialWarning = [
                replyMemoriesWritten ? `${replyMemoriesWritten} reply memor${replyMemoriesWritten === 1 ? "y" : "ies"} synced.` : "",
                payload?.persist?.warning || "",
                payload?.sendAttempt?.message || "",
              ].filter(Boolean).join(" ")
            }
            break
          }
          case "buyer_send_batch": {
            const results = await Promise.allSettled(
              action.messages.map((message) =>
                patchJson(`/api/admin/buyers/${message.buyerId}/outreach`, {
                  messageId: message.messageId,
                  sendNow: true,
                })
              )
            )
            const settledResponses = await Promise.all(
              results.map(async (result) => {
                if (result.status !== "fulfilled") return { ok: false, error: result.reason }
                if (result.value.ok) return { ok: true }
                const payload = await result.value.json().catch(() => ({}))
                return { ok: false, error: payload?.error || "Send failed." }
              })
            )
            const sent = settledResponses.filter((result) => result.ok).length
            const failed = settledResponses.length - sent
            if (sent === 0) throw new Error("No buyer emails were sent.")
            successDescription = `${sent} buyer email${sent === 1 ? "" : "s"} sent from the cockpit.`
            if (failed > 0) partialWarning = `${failed} buyer send${failed === 1 ? "" : "s"} failed and should be reviewed.`
            break
          }
          case "lender_send_batch": {
            const results = await Promise.allSettled(
              action.messages.map((message) =>
                patchJson(`/api/admin/lenders/${message.lenderId}/outreach`, {
                  messageId: message.messageId,
                  sendNow: true,
                })
              )
            )
            const settledResponses = await Promise.all(
              results.map(async (result) => {
                if (result.status !== "fulfilled") return { ok: false, error: result.reason }
                if (result.value.ok) return { ok: true }
                const payload = await result.value.json().catch(() => ({}))
                return { ok: false, error: payload?.error || "Send failed." }
              })
            )
            const sent = settledResponses.filter((result) => result.ok).length
            const failed = settledResponses.length - sent
            if (sent === 0) throw new Error("No lender emails were sent.")
            successDescription = `${sent} lender email${sent === 1 ? "" : "s"} sent from the cockpit.`
            if (failed > 0) partialWarning = `${failed} lender send${failed === 1 ? "" : "s"} failed and should be reviewed.`
            break
          }
          default:
            return
        }

        if (response && !response.ok) {
          const payload = await response.json().catch(() => ({}))
          if (handleCommandCenterAuthFailure(response.status, payload?.error)) return
          throw new Error(payload?.error || "Action failed.")
        }

        toast({
          title: "Command executed",
          description: partialWarning ? `${successDescription} ${partialWarning}` : successDescription,
        })
        await refresh()
      } catch (error) {
        toast({
          title: "Command failed",
          description: error instanceof Error ? error.message : "Try again in a moment.",
          variant: "destructive",
        })
      } finally {
        setRunningActionId(null)
      }
    },
    [openDockTarget, refresh, router, toast]
  )

  const coreAgents = data.agents.filter((agent) =>
    ["acquisition", "outreach", "routing", "operator"].includes(agent.key)
  )
  const supportAgents = data.agents.filter((agent) =>
    ["underwriting", "authority", "qa"].includes(agent.key)
  )
  const queueByLabel = useMemo(
    () => new Map(data.routingQueue.map((item) => [item.label, item.count])),
    [data.routingQueue]
  )
  const visibleAlerts = data.alerts.filter((alert) => alert.severity !== "info").slice(0, 3)
  const criticalAlerts = visibleAlerts.filter((alert) => alert.severity === "critical")
  const visibleOverdueTasks = data.overdueTasks.slice(0, 3)
  const visibleActivity = data.activity.slice(0, 8)
  const buyerMatchesOpen = queueByLabel.get("Buyer matches open") ?? 0
  const lenderMatchesOpen = queueByLabel.get("Lender matches open") ?? 0
  const leadFollowUpsDue = queueByLabel.get("Lead follow-ups due") ?? 0
  const partnerFollowUpsDue = queueByLabel.get("Partner follow-ups due") ?? 0

  const runIntent = useCallback(
    (intent: CommandIntent | null) => {
      if (!intent) return

      if ("mode" in intent) {
        setModeAndFocus(intent.mode)
        if (intent.focusAgent) setFocusedAgent(intent.focusAgent)
      } else {
        setModeAndFocus("analyze")
      }

      if (intent.kind === "analyze") {
        dispatchPropertyCommand(intent.address)
        return
      }

      if (intent.kind === "scroll") {
        openDockTarget(intent.targetId)
        return
      }

      router.push(intent.href)
    },
    [dispatchPropertyCommand, openDockTarget, router, setModeAndFocus]
  )

  const resolveCommand = useCallback(
    (raw: string): CommandIntent | null => {
      const query = raw.trim()
      if (!query) return null

      const analyzeMatch = query.match(/^analyze\s+(.+)$/i)
      if (analyzeMatch) {
        return {
          kind: "analyze",
          title: `Analyze ${analyzeMatch[1]}`,
          detail: "Open the property command panel and prefill the address for underwriting.",
          actionLabel: "Analyze address",
          address: analyzeMatch[1],
        }
      }

      if (/^analyze$/i.test(query) || /property command|underwrite/i.test(query)) {
        return {
          kind: "scroll",
          title: "Open Property Command",
          detail: "Jump into address analysis, MAO, route fit, and packet generation without leaving the cockpit.",
          actionLabel: "Open analyzer",
          targetId: "property-command",
          mode: "analyze",
          focusAgent: "underwriting",
        }
      }

      if (/hot seller repl(y|ies)|seller repl(y|ies)|seller inbox/i.test(query)) {
        return {
          kind: "navigate",
          title: "Open seller reply queue",
          detail: "Go to the lead pipeline to work live replies and follow-up decisions.",
          actionLabel: "Open leads",
          href: "/admin/leads",
          mode: "outreach",
          focusAgent: "outreach",
        }
      }

      if (/on[- ]?market|zillow|lowball|as[- ]?is cash|agent offer/i.test(query)) {
        return {
          kind: "scroll",
          title: "Open fresh on-market cash review",
          detail:
            "Use fresh on-market listing inventory, calculate a 50-60% condition-dependent cash range, and send agent-facing outreach from acquisitions@vestblock.io.",
          actionLabel: "Open strategy lab",
          targetId: "strategy-engine",
          mode: "outreach",
          focusAgent: "outreach",
        }
      }

      if (/tax.*code|code.*tax|delinquent.*violation|violation.*delinquent|double[- ]?stack/i.test(query)) {
        return {
          kind: "scroll",
          title: "Open tax + code stack",
          detail:
            "Use DealMachine tax-delinquent owners, overlay county/city code violations, and build a ranked owner review list for new markets.",
          actionLabel: "Open strategy lab",
          targetId: "strategy-engine",
          mode: "acquire",
          focusAgent: "acquisition",
        }
      }

      const sellerOutreachMatch = query.match(/launch seller outreach(?: in (.+))?/i)
      if (sellerOutreachMatch) {
        const market = sellerOutreachMatch[1]?.trim()
        return {
          kind: "navigate",
          title: market ? `Launch seller outreach in ${market}` : "Launch seller outreach",
          detail: market
            ? `Open the lead queue and source controls with ${market} in mind for the next seller push.`
            : "Open the seller pipeline and outreach queue to start the next push.",
          actionLabel: "Open seller queue",
          href: market ? `/admin/leads?market=${encodeURIComponent(market)}` : "/admin/leads",
          mode: "outreach",
          focusAgent: "outreach",
        }
      }

      if (/launch buyer outreach|buyer recruit/i.test(query)) {
        return {
          kind: "navigate",
          title: "Launch buyer outreach",
          detail: "Open approved buyer recruiting and criteria follow-up from the command surface.",
          actionLabel: "Open buyer outreach",
          href: "/admin/buyer-outreach",
          mode: "outreach",
          focusAgent: "outreach",
        }
      }

      if (/launch lender outreach|capital outreach/i.test(query)) {
        return {
          kind: "navigate",
          title: "Launch lender outreach",
          detail: "Open lender recruiting, criteria confirmation, and capital follow-up.",
          actionLabel: "Open lender outreach",
          href: "/admin/lender-outreach",
          mode: "capital",
          focusAgent: "underwriting",
        }
      }

      const builderMatch = query.match(/find builders(?: in (.+))?/i)
      if (builderMatch) {
        const market = builderMatch[1]?.trim()
        return {
          kind: "navigate",
          title: market ? `Find builders in ${market}` : "Open builder partner engine",
          detail: market
            ? `Jump into the builder/developer lane and work partner discovery around ${market}.`
            : "Open the builder/developer partner lane and work discovery, fit, and outreach readiness.",
          actionLabel: "Open partner engine",
          href: market
            ? `/admin/investor-partnerships?lane=builder&market=${encodeURIComponent(market)}`
            : "/admin/investor-partnerships?lane=builder",
          mode: "route",
          focusAgent: "routing",
        }
      }

      if (/show lender matches|lender fit/i.test(query)) {
        return {
          kind: "navigate",
          title: "Show lender matches",
          detail: "Open lender-fit routing and package the capital path for live deals.",
          actionLabel: "Open lender matches",
          href: "/admin/lender-matches",
          mode: "capital",
          focusAgent: "underwriting",
        }
      }

      if (/show buyer matches|buyer fit/i.test(query)) {
        return {
          kind: "navigate",
          title: "Show buyer matches",
          detail: "Open buyer-fit routing for inventory that is ready to move.",
          actionLabel: "Open buyer matches",
          href: "/admin/buyer-matches",
          mode: "route",
          focusAgent: "routing",
        }
      }

      if (/inbox command|show inbox|hot replies|reply queue/i.test(query)) {
        return {
          kind: "scroll",
          title: "Open inbox command",
          detail: "Jump into hot seller replies, partner replies, and stale threads without leaving the cockpit.",
          actionLabel: "Open inbox",
          targetId: "inbox-command",
          mode: "outreach",
          focusAgent: "outreach",
        }
      }

      if (/daily cap|daily limit|push outbound|throughput|send cap|outbound governor/i.test(query)) {
        return {
          kind: "scroll",
          title: "Open outbound governor",
          detail: "Jump to daily cap, sender, provider, and throughput sprint controls.",
          actionLabel: "Open outbound",
          targetId: "outreach-command",
          mode: "outreach",
          focusAgent: "outreach",
        }
      }

      if (/strategy lab|daily lab|self[- ]?improv|autonomous strategy|run lab/i.test(query)) {
        return {
          kind: "scroll",
          title: "Open daily strategy lab",
          detail: "Jump to the self-improving strategy loop, suppression guardrails, and DealMachine freshness controls.",
          actionLabel: "Open strategy lab",
          targetId: "strategy-lab-command",
          mode: "route",
          focusAgent: "operator",
        }
      }

      if (/outreach command|send ready|launch queue/i.test(query)) {
        return {
          kind: "scroll",
          title: "Open outreach command",
          detail: "Jump into live seller, buyer, lender, and builder outreach lanes from the command center.",
          actionLabel: "Open outreach command",
          targetId: "outreach-command",
          mode: "outreach",
          focusAgent: "outreach",
        }
      }

      if (/run authority|authority sprint|research engine/i.test(query)) {
        return {
          kind: "navigate",
          title: "Open authority engine",
          detail: "Move into the research and authority workflows that raise market visibility behind the scenes.",
          actionLabel: "Open research",
          href: "/admin/research",
          mode: "authority",
          focusAgent: "authority",
        }
      }

      if (/boss|strategy|playbook/i.test(query)) {
        return {
          kind: "scroll",
          title: "Open Boss strategy engine",
          detail: "Jump straight to the ranked playbook and learning loop.",
          actionLabel: "Open strategy engine",
          targetId: "strategy-engine",
          mode: "route",
          focusAgent: "operator",
        }
      }

      return null
    },
    []
  )

  const runCommandText = useCallback(
    (command: string) => {
      const trimmed = command.trim()
      if (!trimmed) return

      const intent = resolveCommand(trimmed)
      if (intent) {
        runIntent(intent)
        return
      }

      setOperationsView("copilot")
      setCopilotSeed({ id: Date.now(), prompt: trimmed, autoSubmit: true })
      scrollToSection("codex-console")
      toast({
        title: "Sent to Codex",
        description: "I opened the Codex console with that command so it can reason from the board.",
      })
    },
    [resolveCommand, runIntent, scrollToSection, toast]
  )

  const activeFocusAgent =
    data.agents.find((agent) => agent.key === (focusedAgent || MODE_TO_AGENT[activeMode])) ||
    data.agents.find((agent) => agent.key === MODE_TO_AGENT[activeMode]) ||
    data.agents[0]
  const dockCopy = DOCK_COPY[operationsView]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="vb-mono text-[0.65rem] uppercase tracking-[0.3em] text-cyan-300/80">VestBlock · Operator Cockpit</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white md:text-3xl">Command Center</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              openCopilotWithPrompt("What needs me now across the command center?", true, {
                mode: activeMode,
                focusAgent: focusedAgent,
              })
            }
            className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1 text-xs font-medium text-cyan-100 transition-colors hover:border-cyan-200/45 hover:text-white"
          >
            <Bot className="h-3.5 w-3.5" />
            Codex live
          </button>
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

      <div className="grid items-start gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div id="command-deck">
          <PanelShell>
            <PanelTitle icon={ListChecks} title="Today’s operating board" hint="simple view" />
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Keep this surface focused: work replies, run analysis, push clean outreach, and move deals through buyer or capital routing.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                { label: "New leads", value: data.summary.newLeads24h, helper: "24h" },
                { label: "Outreach", value: `${data.summary.outreach24h}/${data.summary.outreachTarget}`, helper: "24h" },
                { label: "Replies", value: data.summary.replySignals7d, helper: "7d" },
                { label: "Open tasks", value: data.summary.openTasks, helper: `${data.summary.urgentTasks} urgent` },
              ].map((metric) => (
                <div key={metric.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3">
                  <p className="vb-mono text-[0.58rem] uppercase tracking-[0.14em] text-slate-500">{metric.label}</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-white">{metric.value}</p>
                  <p className="text-[0.65rem] text-slate-500">{metric.helper}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-2">
              {[
                { label: "Open replies", detail: "Work hot seller and partner replies.", target: "inbox-command", mode: "outreach" as CommandCenterModeKey },
                { label: "Analyze property", detail: "Run MAO, ARV, repair, rent, and creative paths.", target: "property-command", mode: "analyze" as CommandCenterModeKey },
                { label: "Start outreach", detail: "Use separated seller, buyer, lender, and builder lanes.", target: "outreach-command", mode: "outreach" as CommandCenterModeKey },
                { label: "Choose strategy", detail: "Let the Boss rank the next lane before sending.", target: "strategy-engine", mode: "authority" as CommandCenterModeKey },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() =>
                    runIntent({
                      kind: "scroll",
                      title: item.label,
                      detail: item.detail,
                      actionLabel: "Open",
                      targetId: item.target,
                      mode: item.mode,
                      focusAgent: MODE_TO_AGENT[item.mode],
                    })
                  }
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-left transition-colors hover:border-cyan-300/35"
                >
                  <span>
                    <span className="block text-sm font-medium text-white">{item.label}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-slate-400">{item.detail}</span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-500" />
                </button>
              ))}
            </div>
          </PanelShell>
        </div>

          <CommandCenterInboxPanel
            summary={data.inbox.summary}
            sections={data.inbox.sections}
            runningActionId={runningActionId}
            onAction={(action) => void runInlineAction(action)}
          />
      </div>

      <CommandCenterOutreachPanel
        queues={data.outreachQueues}
        outboundControl={data.outboundControl}
        runningActionId={runningActionId}
        onAction={(action) => void runInlineAction(action)}
      />

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <PanelShell>
          <PanelTitle icon={AlertTriangle} title="Queue pressure" hint="what can make money next" />
          <div className="mt-3 space-y-3">
            {visibleAlerts.length ? (
              visibleAlerts.slice(0, 3).map((alert) => (
                <Link
                  key={alert.message}
                  href={alert.href || "/admin/command-center"}
                  className={cn(
                    "block rounded-xl border px-3 py-3 text-xs leading-5 transition-colors hover:border-white/20",
                    alert.severity === "critical"
                      ? "border-rose-400/25 bg-rose-400/[0.07] text-rose-100"
                      : "border-amber-300/20 bg-amber-300/[0.06] text-amber-100"
                  )}
                >
                  {alert.message}
                </Link>
              ))
            ) : (
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-3 text-xs text-emerald-100">
                No major blockers right now. Keep the current lane moving.
              </div>
            )}

            <div className="grid gap-2">
              {visibleOverdueTasks.length ? (
                visibleOverdueTasks.map((task) => (
                  <div key={task.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white">{task.title}</p>
                        <p className="mt-1 text-[0.72rem] leading-5 text-slate-400">{task.detail}</p>
                      </div>
                      <span
                        className={cn(
                          "vb-mono inline-flex shrink-0 rounded-md border px-1.5 py-0.5 text-[0.55rem] uppercase tracking-[0.12em]",
                          priorityTone(task.priority)
                        )}
                      >
                        {task.priority}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => void updateTask(task.id, "in_progress")}
                        disabled={updatingTaskId === task.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[0.65rem] font-medium text-slate-200 transition-colors hover:border-cyan-300/35 hover:text-white disabled:opacity-50"
                      >
                        {updatingTaskId === task.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
                        Start
                      </button>
                      <button
                        type="button"
                        onClick={() => void updateTask(task.id, "completed")}
                        disabled={updatingTaskId === task.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-[0.65rem] font-medium text-emerald-100 transition-colors hover:border-emerald-300/45 disabled:opacity-50"
                      >
                        {updatingTaskId === task.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
                        Done
                      </button>
                      <Link
                        href={task.relatedHref || task.href}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[0.65rem] font-medium text-slate-200 transition-colors hover:border-cyan-300/35 hover:text-white"
                      >
                        Open
                        <ArrowUpRight className="h-3 w-3 opacity-60" />
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-xs text-slate-400">
                  No overdue operator tasks. The board is clear enough to push live outreach and routing work.
                </div>
              )}
            </div>
          </div>
        </PanelShell>

        <PanelShell>
          <PanelTitle icon={ListChecks} title="Routing and follow-up board" hint="clear the live queues" />
          <div className="mt-3 grid gap-2">
            {data.routingQueue.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-cyan-300/35"
              >
                <div>
                  <p className="text-xs font-medium text-slate-200">{item.label}</p>
                  <p className="text-[0.65rem] text-slate-500">
                    {item.count > 0 ? "Needs operator movement" : "Clear"}
                  </p>
                </div>
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
      </div>

      {!data.liveDataReachable ? (
        <PanelShell className="border-amber-300/25 bg-amber-300/[0.05]">
          <PanelTitle icon={ShieldAlert} title="Some data sources unreachable" hint={`${data.dataSourceIssues.length} sources`} />
          <p className="mt-2 text-xs leading-5 text-amber-100/80">
            Some counts may be stale because these sources are currently unavailable:{" "}
            {data.dataSourceIssues.map((issue) => issue.source).join(", ")}.
          </p>
        </PanelShell>
      ) : null}

      <PanelShell className="overflow-hidden p-0">
        <Tabs value={operationsView} onValueChange={(value) => setOperationsView(value as OperationsViewKey)}>
          <div id="operations-dock" className="border-b border-white/[0.06] px-5 py-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1 text-[0.62rem] uppercase tracking-[0.18em] text-cyan-100">
                    <Crosshair className="h-3.5 w-3.5" />
                    Operations dock
                  </span>
                  <span className="vb-mono text-[0.58rem] uppercase tracking-[0.16em] text-slate-500">
                    {dockCopy.hint}
                  </span>
                </div>
                <h2 className="mt-3 text-xl font-semibold text-white">{dockCopy.title}</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">{dockCopy.detail}</p>
              </div>

              <TabsList className="h-auto flex-wrap justify-start rounded-2xl border border-white/10 bg-slate-950/70 p-1">
                <TabsTrigger value="copilot" className="rounded-xl px-3 py-2 text-xs data-[state=active]:bg-cyan-300/15 data-[state=active]:text-cyan-100">
                  <Bot className="mr-1.5 h-3.5 w-3.5" />
                  Codex
                </TabsTrigger>
                <TabsTrigger value="property" className="rounded-xl px-3 py-2 text-xs data-[state=active]:bg-cyan-300/15 data-[state=active]:text-cyan-100">
                  <Crosshair className="mr-1.5 h-3.5 w-3.5" />
                  Property
                </TabsTrigger>
                <TabsTrigger value="strategy" className="rounded-xl px-3 py-2 text-xs data-[state=active]:bg-cyan-300/15 data-[state=active]:text-cyan-100">
                  <Flame className="mr-1.5 h-3.5 w-3.5" />
                  Strategy
                </TabsTrigger>
                <TabsTrigger value="lanes" className="rounded-xl px-3 py-2 text-xs data-[state=active]:bg-cyan-300/15 data-[state=active]:text-cyan-100">
                  <ListChecks className="mr-1.5 h-3.5 w-3.5" />
                  Lanes
                </TabsTrigger>
                <TabsTrigger value="intel" className="rounded-xl px-3 py-2 text-xs data-[state=active]:bg-cyan-300/15 data-[state=active]:text-cyan-100">
                  <Flame className="mr-1.5 h-3.5 w-3.5" />
                  Intel
                </TabsTrigger>
                <TabsTrigger value="activity" className="rounded-xl px-3 py-2 text-xs data-[state=active]:bg-cyan-300/15 data-[state=active]:text-cyan-100">
                  <Activity className="mr-1.5 h-3.5 w-3.5" />
                  Activity
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <TabsContent value="copilot" id="codex-console" className="mt-0 px-5 py-5">
            <CommandCenterCopilotPanel
              data={data}
              activeMode={activeMode}
              focusAgentName={activeFocusAgent?.name}
              onRunCommand={runCommandText}
              seed={copilotSeed}
            />
          </TabsContent>

          <TabsContent value="property" id="property-command" className="mt-0 px-5 py-5">
            <CommandCenterAnalyzerPanel key={propertyCommandSeed?.id ?? "manual-property-command"} commandSeed={propertyCommandSeed} />
          </TabsContent>

          <TabsContent value="strategy" id="strategy-engine" className="mt-0 px-5 py-5">
            <div className="space-y-5">
              <CommandCenterStrategyOpsPanel
                strategyLab={data.strategyLab}
                operatingLoops={data.operatingLoops}
                operatingArchitecture={data.operatingArchitecture}
                dealMemory={data.dealMemory}
                sourceGovernor={data.sourceGovernor}
                suppressionCenter={data.suppressionCenter}
                dealMachineFreshness={data.dealMachineFreshness}
                osintSourceBoard={data.osintSourceBoard}
                outcomeLearning={data.outcomeLearning}
                outboundGovernance={data.outboundGovernance}
                buyBoxGraph={data.buyBoxGraph}
                autopilot={data.autopilot}
                runningActionId={runningActionId}
                onAction={(action) => void runInlineAction(action)}
                sectionId="strategy-lab-command-dock"
              />
              <CommandCenterStrategyPanel initialBriefing={initialBossBriefing} />
            </div>
          </TabsContent>

          <TabsContent value="lanes" id="lane-diagnostics" className="mt-0 px-5 py-5">
            <div className="space-y-5">
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Core lanes</h2>
                  <p className="vb-mono text-[0.6rem] uppercase tracking-[0.16em] text-slate-600">4 operator lanes</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {coreAgents.map((agent) => (
                    <AgentPanel key={agent.key} agent={agent} focused={focusedAgent === agent.key} onFocus={setFocusedAgent} />
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Deal pipeline</h2>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{data.dealPipeline.summary}</p>
                  </div>
                  <span
                    className={cn(
                      "vb-mono rounded-full border px-3 py-1 text-[0.58rem] uppercase tracking-[0.14em]",
                      data.dealPipeline.status === "green"
                        ? "border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-100"
                        : data.dealPipeline.status === "red"
                          ? "border-rose-400/25 bg-rose-400/[0.08] text-rose-100"
                          : "border-amber-300/25 bg-amber-300/[0.08] text-amber-100"
                    )}
                  >
                    {data.dealPipeline.nextMove}
                  </span>
                </div>
                <div className="grid gap-3 xl:grid-cols-7">
                  {data.dealPipeline.stages.map((stage) => (
                    <div key={stage.key} className="min-h-[172px] rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-white">{stage.label}</p>
                        <span className="vb-mono rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[0.58rem] text-cyan-100">
                          {stage.count}
                        </span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {stage.items.length ? (
                          stage.items.map((item) => (
                            <div key={item.id} className="rounded-lg border border-white/[0.06] bg-slate-950/45 px-2.5 py-2">
                              <p className="truncate text-[0.72rem] font-medium text-slate-100">{item.propertyAddress}</p>
                              <p className="mt-0.5 text-[0.62rem] text-slate-500">{item.market}</p>
                              <p className="mt-1 line-clamp-2 text-[0.64rem] leading-4 text-slate-400">{item.nextAction}</p>
                              <div className="mt-2 flex items-center justify-between gap-2 text-[0.58rem] text-slate-500">
                                <span>{item.priority}</span>
                                <span>{item.sentCount} sent · {item.replyCount} replies</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="pt-8 text-center text-[0.68rem] leading-5 text-slate-600">No deals here yet</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-4">
                  {[
                    { label: "Active deals", value: data.dealPipeline.totals.activeDeals },
                    { label: "Packets ready", value: data.dealPipeline.totals.packetReady },
                    { label: "Packets sent", value: data.dealPipeline.totals.packetSent },
                    { label: "Buyer replies", value: data.dealPipeline.totals.buyerReplies },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                      <p className="vb-mono text-[0.56rem] uppercase tracking-[0.14em] text-slate-500">{item.label}</p>
                      <p className="mt-1 text-lg font-semibold tabular-nums text-white">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {supportAgents.length ? (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Support systems</h2>
                    <p className="vb-mono text-[0.6rem] uppercase tracking-[0.16em] text-slate-600">underwriting, authority, qa</p>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {supportAgents.map((agent) => (
                      <div key={agent.key} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{agent.name}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-400">{agent.statusReason}</p>
                          </div>
                          <span className={cn("vb-mono text-[0.62rem] uppercase tracking-[0.14em]", AGENT_ACCENTS[agent.key].text)}>
                            {statusLabel(agent.status)}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {agent.kpis.slice(0, 3).map((kpi) => (
                            <span
                              key={kpi.label}
                              className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[0.65rem] text-slate-300"
                            >
                              {kpi.label}: <span className="text-white">{kpi.value}</span>
                            </span>
                          ))}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {agent.actions.slice(0, 2).map((action) => (
                            <button
                              key={action.href + action.label}
                              type="button"
                              onClick={() =>
                                runIntent(
                                  action.href.startsWith("#")
                                    ? {
                                        kind: "scroll",
                                        title: action.label,
                                        detail: action.label,
                                        actionLabel: "Open",
                                        targetId: action.href.replace("#", ""),
                                        mode: activeMode,
                                        focusAgent: agent.key,
                                      }
                                    : {
                                        kind: "navigate",
                                        title: action.label,
                                        detail: action.label,
                                        actionLabel: "Open",
                                        href: action.href,
                                        mode: activeMode,
                                        focusAgent: agent.key,
                                      }
                                )
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-cyan-300/35 hover:text-white"
                            >
                              {action.label}
                              <ArrowUpRight className="h-3 w-3 opacity-60" />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="intel" id="market-watch" className="mt-0 px-5 py-5">
            <div className="grid gap-4 xl:grid-cols-2">
              <div>
                <p className="vb-mono text-[0.58rem] uppercase tracking-[0.14em] text-slate-500">Market heat</p>
                <div className="mt-3 space-y-2.5">
                  {data.marketHeat.length ? (
                    data.marketHeat.map((market) => (
                      <Link
                        key={market.market}
                        href={market.href || "/admin/leads"}
                        className="block rounded-xl px-2 py-1 transition-colors hover:bg-white/[0.03]"
                      >
                        <div className="flex items-baseline justify-between gap-3 text-xs">
                          <p className="font-medium text-slate-200">{market.market}</p>
                          <p className="vb-mono text-right text-[0.65rem] text-slate-500">
                            {market.leads} leads · {market.recent7d} new 7d{market.replied ? ` · ${market.replied} replied` : ""}
                          </p>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-400/80 to-amber-300/80 transition-[width] duration-700"
                            style={{ width: `${Math.max(4, market.heat)}%` }}
                          />
                        </div>
                      </Link>
                    ))
                  ) : (
                    <p className="text-xs leading-5 text-slate-500">
                      No market activity yet. New leads with city data will rank here automatically.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <p className="vb-mono text-[0.58rem] uppercase tracking-[0.14em] text-slate-500">Inventory & partner fit</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3">
                    <p className="vb-mono text-[0.58rem] uppercase tracking-[0.14em] text-slate-500">Builder partners</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums text-white">{data.summary.builderPartners}</p>
                    <p className="mt-0.5 text-[0.65rem] text-slate-500">active in the partner engine</p>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3">
                    <p className="vb-mono text-[0.58rem] uppercase tracking-[0.14em] text-slate-500">Buy boxes confirmed</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums text-white">{data.summary.partnerBuyBoxesConfirmed}</p>
                    <p className="mt-0.5 text-[0.65rem] text-slate-500">verified criteria</p>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3">
                    <p className="vb-mono text-[0.58rem] uppercase tracking-[0.14em] text-slate-500">Outreach ready</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums text-white">{data.summary.partnerOutreachReady}</p>
                    <p className="mt-0.5 text-[0.65rem] text-slate-500">clear for direct contact</p>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3">
                    <p className="vb-mono text-[0.58rem] uppercase tracking-[0.14em] text-slate-500">DM-aligned</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums text-white">{data.summary.dealMachineAlignedPartners}</p>
                    <p className="mt-0.5 text-[0.65rem] text-slate-500">active-market overlap</p>
                  </div>
                </div>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <p className="text-slate-200">Distress stack rows</p>
                    <span className="vb-mono font-semibold tabular-nums text-cyan-200">
                      {data.localSignals.distressStackRows ?? "n/a"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <p className="text-slate-200">Saved DealMachine exports</p>
                    <span className="vb-mono font-semibold tabular-nums text-cyan-200">
                      {data.localSignals.dmExports.length}
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-slate-200">Tax + code stack</p>
                      <span className="vb-mono font-semibold tabular-nums text-cyan-200">
                        {data.localSignals.taxCodeStack.writtenRows}
                      </span>
                    </div>
                    <p className="mt-1 text-[0.65rem] leading-5 text-slate-500">
                      {data.localSignals.taxCodeStack.summary}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-slate-200">DM contact export request</p>
                      <span className="vb-mono font-semibold tabular-nums text-cyan-200">
                        {data.localSignals.dealMachineExportRequest?.totalRows ?? 0}
                      </span>
                    </div>
                    <p className="mt-1 text-[0.65rem] leading-5 text-slate-500">
                      {data.localSignals.dealMachineExportRequest
                        ? `Latest package: ${data.localSignals.dealMachineExportRequest.csvPath || data.localSignals.dealMachineExportRequest.summaryFile || "generated"} · Contacts export only, DNC columns required, no DealMachine skip tracing by default.`
                        : "No DealMachine contact-export package yet. Run npm run distress:dealmachine:export-request:all before retrying zero-sendable lanes."}
                    </p>
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
                      No contact exports on disk. Export contacts from DealMachine, then run{" "}
                      <code className="vb-mono text-cyan-300/90">npm run distress:dealmachine:ingest-export:apply</code>.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="activity" id="system-activity" className="mt-0 px-5 py-5">
            <div className="max-h-96 overflow-y-auto">
              {visibleActivity.length ? (
                <div className="space-y-1">
                  {visibleActivity.map((item, index) => (
                    <Link
                      key={`${item.at}-${index}`}
                      href={item.href || "/admin/command-center"}
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
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-xs text-slate-500">
                  No recorded events yet. As leads, sends, source runs, and published assets land, they stream here.
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </PanelShell>
    </div>
  )
}
