"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, useReducedMotion } from "framer-motion"
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
import { MissionCore } from "./mission-core"
import { CommandCenterAnalyzerPanel, type PropertyCommandSeed } from "./command-center-analyzer-panel"
import { CommandCenterCopilotPanel } from "./command-center-copilot-panel"
import { CommandCenterStrategyPanel } from "./command-center-strategy-panel"
import {
  CommandCenterInboxPanel,
  CommandCenterOutreachPanel,
  CommandCenterStrategyOpsPanel,
} from "./command-center-control-surfaces"
import {
  CommandCenterCommandDeck,
  type CommandCenterModeKey,
  type CommandCenterNeedsItem,
} from "./command-center-command-deck"
import type {
  AgentAction,
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

const AGENT_TO_MODE: Record<AgentKey, CommandCenterModeKey> = {
  acquisition: "acquire",
  outreach: "outreach",
  routing: "route",
  underwriting: "analyze",
  authority: "authority",
  qa: "route",
  operator: "acquire",
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

const COMMAND_MODES = [
  {
    key: "acquire",
    label: "Acquire",
    description: "Seller inflow, market expansion, partner discovery, and fresh inventory entering the system.",
    accentClassName: "border-cyan-300/25 bg-cyan-300/[0.08]",
    glowClassName: "from-cyan-400/25 via-cyan-400/5 to-transparent",
  },
  {
    key: "analyze",
    label: "Analyze",
    description: "Run address-level underwriting, comp context, MAO, creative paths, and assignment spreads from one place.",
    accentClassName: "border-amber-300/25 bg-amber-300/[0.08]",
    glowClassName: "from-amber-300/20 via-amber-300/5 to-transparent",
  },
  {
    key: "route",
    label: "Route",
    description: "Push deals toward the right buyers, lenders, and builders with fewer dead ends and better fit logic.",
    accentClassName: "border-emerald-300/25 bg-emerald-300/[0.08]",
    glowClassName: "from-emerald-400/20 via-emerald-400/5 to-transparent",
  },
  {
    key: "outreach",
    label: "Outreach",
    description: "Launch seller, buyer, lender, and partner contact from the live queues without losing the conversation thread.",
    accentClassName: "border-blue-300/25 bg-blue-300/[0.08]",
    glowClassName: "from-blue-400/20 via-blue-400/5 to-transparent",
  },
  {
    key: "capital",
    label: "Capital",
    description: "Move lender-fit deals forward, package clean underwriting, and keep capital paths open.",
    accentClassName: "border-violet-300/25 bg-violet-300/[0.08]",
    glowClassName: "from-violet-400/20 via-violet-400/5 to-transparent",
  },
  {
    key: "authority",
    label: "Authority",
    description: "Track visibility, trust signals, research output, and the behind-the-scenes content engine.",
    accentClassName: "border-fuchsia-300/25 bg-fuchsia-300/[0.08]",
    glowClassName: "from-fuchsia-400/20 via-fuchsia-400/5 to-transparent",
  },
] as const

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

function readKpi(agent: AgentPanelData | undefined, label: string) {
  return agent?.kpis.find((kpi) => kpi.label === label)
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
  const [commandInput, setCommandInput] = useState("")
  const [copilotSeed, setCopilotSeed] = useState<{ id: number; prompt: string; autoSubmit?: boolean } | null>(null)
  const [propertyCommandSeed, setPropertyCommandSeed] = useState<PropertyCommandSeed | null>(null)
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null)
  const [runningActionId, setRunningActionId] = useState<string | null>(null)
  const reduce = useReducedMotion()

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const commandCenterResponse = await fetch("/api/admin/command-center", { cache: "no-store" })

      if (commandCenterResponse.ok) {
        const next = (await commandCenterResponse.json()) as CommandCenterData
        setData(next)
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
  const researchChecklistsOpen = queueByLabel.get("Research checklists open") ?? 0
  const topMarket = data.marketHeat[0]?.market || "top active market"
  const outreachAgent = data.agents.find((agent) => agent.key === "outreach")
  const authorityAgent = data.agents.find((agent) => agent.key === "authority")
  const published7d = Number(readKpi(authorityAgent, "Published 7d")?.value ?? 0)
  const authorityTasks = Number(readKpi(authorityAgent, "Authority tasks")?.value ?? 0)
  const sendReady = Number(readKpi(outreachAgent, "Send-ready")?.value ?? 0)
  const allExportsStale =
    data.localSignals.dmExports.length > 0 && data.localSignals.dmExports.every((file) => file.ageDays > 7)
  const focusPlay =
    initialBossBriefing.plays.find((play) => play.key === initialBossBriefing.focusKey) ||
    initialBossBriefing.plays[0] ||
    null

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
        setCommandInput("")
        return
      }

      if (intent.kind === "scroll") {
        openDockTarget(intent.targetId)
        setCommandInput("")
        return
      }

      router.push(intent.href)
      setCommandInput("")
    },
    [dispatchPropertyCommand, openDockTarget, router, setModeAndFocus]
  )

  const runAgentAction = useCallback(
    (action: AgentAction, key: AgentKey) => {
      runIntent(
        action.href.startsWith("#")
          ? {
              kind: "scroll",
              title: action.label,
              detail: action.label,
              actionLabel: "Open",
              targetId: action.href.replace("#", ""),
              mode: AGENT_TO_MODE[key],
              focusAgent: key,
            }
          : {
              kind: "navigate",
              title: action.label,
              detail: action.label,
              actionLabel: "Open",
              href: action.href,
              mode: AGENT_TO_MODE[key],
              focusAgent: key,
            }
      )
    },
    [runIntent]
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

      setCommandInput(trimmed)
      setOperationsView("copilot")
      scrollToSection("command-deck")
      toast({
        title: "Loaded into command deck",
        description: `I parked "${trimmed}" in the command bar so we can refine or run it from there.`,
      })
    },
    [resolveCommand, runIntent, scrollToSection, toast]
  )

  const commandSuggestions = useMemo(() => {
    switch (activeMode) {
      case "acquire":
        return [
          {
            id: "acquire-analyze",
            label: "Analyze an address",
            detail: "Open the property command panel and drop in a live lead.",
            intent: {
              kind: "scroll",
              title: "Open Property Command",
              detail: "Jump into live underwriting from the cockpit.",
              actionLabel: "Open analyzer",
              targetId: "property-command",
              mode: "analyze",
              focusAgent: "underwriting",
            } satisfies CommandIntent,
          },
          {
            id: "acquire-seller-outreach",
            label: "Work seller outreach",
            detail: "Open the seller queue and follow-up path.",
            intent: {
              kind: "navigate",
              title: "Open seller lead queue",
              detail: "Work seller inflow, replies, and follow-up from the lead pipeline.",
              actionLabel: "Open leads",
              href: "/admin/leads",
              mode: "outreach",
              focusAgent: "outreach",
            } satisfies CommandIntent,
          },
          {
            id: "acquire-on-market-lowball",
            label: "On-market cash review",
            detail: "Open the fresh listing agent-offer play.",
            intent: {
              kind: "scroll",
              title: "Open fresh on-market cash review",
              detail: "Open the Boss play for fresh public-listing 50-60% conditional cash-review outreach.",
              actionLabel: "Open strategy lab",
              targetId: "strategy-engine",
              mode: "outreach",
              focusAgent: "outreach",
            } satisfies CommandIntent,
          },
          {
            id: "acquire-tax-code-stack",
            label: "Tax + code stack",
            detail: "Build the DealMachine tax-delinquent plus code-violation list.",
            intent: {
              kind: "scroll",
              title: "Open tax + code stack",
              detail: "Open the Boss play for tax-delinquent owners stacked with county/city code violations.",
              actionLabel: "Open strategy lab",
              targetId: "strategy-engine",
              mode: "acquire",
              focusAgent: "acquisition",
            } satisfies CommandIntent,
          },
          {
            id: "acquire-builders",
            label: `Find builders in ${topMarket}`,
            detail: "Push partner discovery in the hottest current market.",
            intent: {
              kind: "navigate",
              title: `Find builders in ${topMarket}`,
              detail: "Open the builder lane and work fit around the hottest market signal.",
              actionLabel: "Open partner engine",
              href: `/admin/investor-partnerships?lane=builder&market=${encodeURIComponent(topMarket)}`,
              mode: "route",
              focusAgent: "routing",
            } satisfies CommandIntent,
          },
        ]
      case "analyze":
        return [
          {
            id: "analyze-open",
            label: "Open property command",
            detail: "Jump into value, MAO, route fit, and packet actions.",
            intent: {
              kind: "scroll",
              title: "Open Property Command",
              detail: "Jump into live underwriting from the cockpit.",
              actionLabel: "Open analyzer",
              targetId: "property-command",
              mode: "analyze",
              focusAgent: "underwriting",
            } satisfies CommandIntent,
          },
          {
            id: "analyze-buyer-matches",
            label: "Show buyer matches",
            detail: "Open buyer-fit routing for current inventory.",
            intent: {
              kind: "navigate",
              title: "Show buyer matches",
              detail: "Open buyer routing and disposition from the command center.",
              actionLabel: "Open buyer matches",
              href: "/admin/buyer-matches",
              mode: "route",
              focusAgent: "routing",
            } satisfies CommandIntent,
          },
          {
            id: "analyze-lender-matches",
            label: "Show lender matches",
            detail: "Open capital routing for deal-ready properties.",
            intent: {
              kind: "navigate",
              title: "Show lender matches",
              detail: "Open the capital queue and lender-fit lane for active deals.",
              actionLabel: "Open lender matches",
              href: "/admin/lender-matches",
              mode: "capital",
              focusAgent: "underwriting",
            } satisfies CommandIntent,
          },
        ]
      case "route":
        return [
          {
            id: "route-buyer",
            label: "Open buyer matches",
            detail: "Push live inventory toward buyer buy boxes.",
            intent: {
              kind: "navigate",
              title: "Open buyer matches",
              detail: "Work buyer routing decisions from one queue.",
              actionLabel: "Open buyer matches",
              href: "/admin/buyer-matches",
              mode: "route",
              focusAgent: "routing",
            } satisfies CommandIntent,
          },
          {
            id: "route-lender",
            label: "Open lender matches",
            detail: "Package capital paths for active deals.",
            intent: {
              kind: "navigate",
              title: "Open lender matches",
              detail: "Push active deals toward the right capital source.",
              actionLabel: "Open lender matches",
              href: "/admin/lender-matches",
              mode: "capital",
              focusAgent: "underwriting",
            } satisfies CommandIntent,
          },
          {
            id: "route-builders",
            label: "Open builder lane",
            detail: "Match builder criteria against current seller inventory.",
            intent: {
              kind: "navigate",
              title: "Open builder lane",
              detail: "Move into builder and developer fit, outreach, and assignment spread work.",
              actionLabel: "Open partner engine",
              href: "/admin/investor-partnerships?lane=builder",
              mode: "route",
              focusAgent: "routing",
            } satisfies CommandIntent,
          },
        ]
      case "outreach":
        return [
          {
            id: "outreach-inbox",
            label: "Open inbox command",
            detail: "Work hot seller replies and stale threads inline.",
            intent: {
              kind: "scroll",
              title: "Open inbox command",
              detail: "Jump to hot seller replies and stale follow-ups.",
              actionLabel: "Open inbox",
              targetId: "inbox-command",
              mode: "outreach",
              focusAgent: "outreach",
            } satisfies CommandIntent,
          },
          {
            id: "outreach-seller",
            label: "Open outreach command",
            detail: "See send-ready seller, buyer, and lender lanes in one place.",
            intent: {
              kind: "scroll",
              title: "Open outreach command",
              detail: "Jump to live send-ready lanes inside the cockpit.",
              actionLabel: "Open outreach command",
              targetId: "outreach-command",
              mode: "outreach",
              focusAgent: "outreach",
            } satisfies CommandIntent,
          },
          {
            id: "outreach-cap",
            label: "Open daily cap",
            detail: `${data.outboundControl.remainingToday} send${data.outboundControl.remainingToday === 1 ? "" : "s"} remain toward today’s cap.`,
            intent: {
              kind: "scroll",
              title: "Open outbound governor",
              detail: "Jump to daily cap, sender, provider, and throughput sprint controls.",
              actionLabel: "Open outbound",
              targetId: "outreach-command",
              mode: "outreach",
              focusAgent: "outreach",
            } satisfies CommandIntent,
          },
          {
            id: "outreach-buyer",
            label: "Launch buyer outreach",
            detail: "Push buyer recruiting and criteria follow-up.",
            intent: {
              kind: "navigate",
              title: "Launch buyer outreach",
              detail: "Open the approved buyer outreach queue.",
              actionLabel: "Open buyer outreach",
              href: "/admin/buyer-outreach",
              mode: "outreach",
              focusAgent: "outreach",
            } satisfies CommandIntent,
          },
          {
            id: "outreach-lender",
            label: "Launch lender outreach",
            detail: "Push lender recruiting and capital follow-up.",
            intent: {
              kind: "navigate",
              title: "Launch lender outreach",
              detail: "Open lender recruiting and capital follow-up.",
              actionLabel: "Open lender outreach",
              href: "/admin/lender-outreach",
              mode: "capital",
              focusAgent: "underwriting",
            } satisfies CommandIntent,
          },
        ]
      case "capital":
        return [
          {
            id: "capital-lender-matches",
            label: "Open lender matches",
            detail: "Move lender-fit deals through the capital queue.",
            intent: {
              kind: "navigate",
              title: "Open lender matches",
              detail: "Package capital routes for active deals.",
              actionLabel: "Open lender matches",
              href: "/admin/lender-matches",
              mode: "capital",
              focusAgent: "underwriting",
            } satisfies CommandIntent,
          },
          {
            id: "capital-lenders",
            label: "Open lender network",
            detail: "Work the lender roster and criteria depth.",
            intent: {
              kind: "navigate",
              title: "Open lender network",
              detail: "Review lender criteria, relationship stage, and readiness.",
              actionLabel: "Open lenders",
              href: "/admin/lenders",
              mode: "capital",
              focusAgent: "underwriting",
            } satisfies CommandIntent,
          },
          {
            id: "capital-analyze",
            label: "Analyze a deal",
            detail: "Run a property and attach packet-ready capital context.",
            intent: {
              kind: "scroll",
              title: "Open Property Command",
              detail: "Run underwriting and capital-fit directly from the command center.",
              actionLabel: "Open analyzer",
              targetId: "property-command",
              mode: "analyze",
              focusAgent: "underwriting",
            } satisfies CommandIntent,
          },
        ]
      case "authority":
      default:
        return [
          {
            id: "authority-research",
            label: "Open research engine",
            detail: "Work visibility, authority, and city-page intelligence.",
            intent: {
              kind: "navigate",
              title: "Open research engine",
              detail: "Move into authority work without leaving the admin ecosystem.",
              actionLabel: "Open research",
              href: "/admin/research",
              mode: "authority",
              focusAgent: "authority",
            } satisfies CommandIntent,
          },
          {
            id: "authority-reports",
            label: "Open daily reports",
            detail: "Review the live authority and growth scorecard.",
            intent: {
              kind: "navigate",
              title: "Open daily reports",
              detail: "Review the current reporting loop and next moves.",
              actionLabel: "Open reports",
              href: "/admin/reports/daily",
              mode: "authority",
              focusAgent: "authority",
            } satisfies CommandIntent,
          },
          {
            id: "authority-strategy",
            label: "Open Boss strategy engine",
            detail: "See how visibility plays are ranking against outreach and acquisition plays.",
            intent: {
              kind: "scroll",
              title: "Open Boss strategy engine",
              detail: "Jump straight to the ranked playbook and learning loop.",
              actionLabel: "Open strategy engine",
              targetId: "strategy-engine",
              mode: "authority",
              focusAgent: "authority",
            } satisfies CommandIntent,
          },
        ]
    }
  }, [activeMode, data.outboundControl.remainingToday, topMarket])

  const suggestionIntentMap = useMemo(
    () => new Map(commandSuggestions.map((suggestion) => [suggestion.id, suggestion.intent])),
    [commandSuggestions]
  )

  const previewIntent = useMemo(() => {
    if (commandInput.trim()) return resolveCommand(commandInput)
    return commandSuggestions[0]?.intent || null
  }, [commandInput, commandSuggestions, resolveCommand])

  const activeFocusAgent =
    data.agents.find((agent) => agent.key === (focusedAgent || MODE_TO_AGENT[activeMode])) ||
    data.agents.find((agent) => agent.key === MODE_TO_AGENT[activeMode]) ||
    data.agents[0]
  const activeFocusNode =
    data.missionNodes.find((node) => node.key === activeFocusAgent?.key) ||
    data.missionNodes.find((node) => node.key === MODE_TO_AGENT[activeMode]) ||
    data.missionNodes[0]

  const activeModeDetails = useMemo(() => {
    switch (activeMode) {
      case "acquire":
        return {
          objective: "Build the next wave of quality seller inventory and partner coverage without burning usage on duplicate work.",
          metrics: [
            { label: "New leads 24h", value: data.summary.newLeads24h, helper: "fresh seller inflow" },
            { label: "Discovery 7d", value: data.summary.partnerDiscoveryRuns7d, helper: "buyer / lender / builder runs" },
            { label: "Builder partners", value: data.summary.builderPartners, helper: "active in the engine" },
          ],
          actions: [
            { label: "Lead management", href: "/admin/leads" },
            { label: "Lead sources", href: "/admin/lead-sources" },
            { label: "Partner engine", href: "/admin/investor-partnerships" },
          ],
        }
      case "analyze":
        return {
          objective: "Turn raw addresses into fast cash, creative, novation, builder, and capital decisions without leaving the cockpit.",
          metrics: [
            { label: "Buyer matches", value: buyerMatchesOpen, helper: "open routing decisions" },
            { label: "Lender matches", value: lenderMatchesOpen, helper: "capital packaging" },
            { label: "Confirmed criteria", value: data.summary.partnerBuyBoxesConfirmed, helper: "partner boxes ready" },
          ],
          actions: [
            { label: "Jump to analyzer", href: "#property-command" },
            { label: "Buyer matches", href: "/admin/buyer-matches" },
            { label: "Lender matches", href: "/admin/lender-matches" },
          ],
        }
      case "route":
        return {
          objective: "Match live properties with the right buyers, lenders, and builders before opportunities cool off.",
          metrics: [
            { label: "Buyer matches", value: buyerMatchesOpen, helper: "open buyer routes" },
            { label: "Lender matches", value: lenderMatchesOpen, helper: "capital routes" },
            { label: "DM aligned", value: data.summary.dealMachineAlignedPartners, helper: "partner overlap" },
          ],
          actions: [
            { label: "Buyer matches", href: "/admin/buyer-matches" },
            { label: "Lender matches", href: "/admin/lender-matches" },
            { label: "Builder lane", href: "/admin/investor-partnerships?lane=builder" },
          ],
        }
      case "outreach":
        return {
          objective: "Keep live conversations moving, refill the queue, and push the right follow-ups instead of spraying volume blindly.",
          metrics: [
            { label: "Sent 24h", value: data.summary.outreach24h, helper: `target ${data.summary.outreachTarget}` },
            { label: "Send ready", value: sendReady, helper: "approved for contact" },
            { label: "Follow-ups due", value: leadFollowUpsDue + partnerFollowUpsDue, helper: "seller + partner threads" },
          ],
          actions: [
            { label: "Seller queue", href: "/admin/leads" },
            { label: "Buyer outreach", href: "/admin/buyer-outreach" },
            { label: "Lender outreach", href: "/admin/lender-outreach" },
          ],
        }
      case "capital":
        return {
          objective: "Package lender-fit deals cleanly and keep capital paths moving with confirmed criteria and usable packets.",
          metrics: [
            { label: "Lender matches", value: lenderMatchesOpen, helper: "capital routes open" },
            { label: "Confirmed criteria", value: data.summary.partnerBuyBoxesConfirmed, helper: "capital-ready partners" },
            { label: "Outreach ready", value: data.summary.partnerOutreachReady, helper: "clear for contact" },
          ],
          actions: [
            { label: "Lender matches", href: "/admin/lender-matches" },
            { label: "Lender network", href: "/admin/lenders" },
            { label: "Partner engine", href: "/admin/investor-partnerships" },
          ],
        }
      case "authority":
      default:
        return {
          objective: "Raise visibility and trust behind the scenes so outbound, inbound, and partner discovery all get easier over time.",
          metrics: [
            { label: "Published 7d", value: published7d, helper: "target 5 per week" },
            { label: "Authority tasks", value: authorityTasks, helper: "open research / visibility work" },
            { label: "Reports", value: data.priorities.length, helper: "live priorities in circulation" },
          ],
          actions: [
            { label: "Research", href: "/admin/research" },
            { label: "Daily reports", href: "/admin/reports/daily" },
            { label: "Strategy engine", href: "#strategy-engine" },
          ],
        }
    }
  }, [
    activeMode,
    authorityTasks,
    buyerMatchesOpen,
    data.priorities.length,
    data.summary.builderPartners,
    data.summary.dealMachineAlignedPartners,
    data.summary.newLeads24h,
    data.summary.outreach24h,
    data.summary.outreachTarget,
    data.summary.partnerBuyBoxesConfirmed,
    data.summary.partnerDiscoveryRuns7d,
    data.summary.partnerOutreachReady,
    leadFollowUpsDue,
    lenderMatchesOpen,
    partnerFollowUpsDue,
    published7d,
    sendReady,
  ])

  const needsNow = useMemo<CommandCenterNeedsItem[]>(() => {
    switch (activeMode) {
      case "acquire":
        return [
          allExportsStale
            ? {
                title: "Refresh DealMachine contacts",
                detail: "Every saved export on disk is older than 7 days. Pull a fresh export before the next send.",
                href: "/admin/lead-sources",
                tone: "critical",
              }
            : {
                title: "Keep inflow up",
                detail: `${data.summary.newLeads24h} new lead${data.summary.newLeads24h === 1 ? "" : "s"} in the last 24 hours.`,
                href: "/admin/leads",
                tone: data.summary.newLeads24h > 0 ? "info" : "warning",
              },
          {
            title: "Partner discovery coverage",
            detail: `${data.summary.partnerDiscoveryRuns7d} discovery run${data.summary.partnerDiscoveryRuns7d === 1 ? "" : "s"} landed in the last 7 days.`,
            href: "/admin/scrape-runs",
            tone: data.summary.partnerDiscoveryRuns7d > 0 ? "info" : "warning",
          },
          {
            title: "Research-ready partners",
            detail: `${data.summary.partnerResearchReady} builder, buyer, or lender profiles are ready for review.`,
            href: "/admin/investor-partnerships",
            tone: data.summary.partnerResearchReady > 0 ? "info" : "warning",
          },
          {
            title: "Strategy lab next move",
            detail: data.strategyLab.nextMove,
            href: "#strategy-lab-command",
            tone: data.strategyLab.status === "red" ? "critical" : data.strategyLab.status === "yellow" ? "warning" : "info",
          },
        ]
      case "analyze":
        return [
          {
            title: "Open property command",
            detail: "Run the next address through MAO, creative fit, and builder spread.",
            href: "#property-command",
            tone: "info",
          },
          {
            title: "Buyer + lender fit waiting",
            detail: `${buyerMatchesOpen + lenderMatchesOpen} route${buyerMatchesOpen + lenderMatchesOpen === 1 ? "" : "s"} still need underwriting context.`,
            href: buyerMatchesOpen >= lenderMatchesOpen ? "/admin/buyer-matches" : "/admin/lender-matches",
            tone: buyerMatchesOpen + lenderMatchesOpen > 0 ? "warning" : "info",
          },
          {
            title: "Confirmed criteria depth",
            detail: `${data.summary.partnerBuyBoxesConfirmed} partner buy boxes are confirmed and usable in analysis.`,
            href: "/admin/investor-partnerships",
            tone: data.summary.partnerBuyBoxesConfirmed > 0 ? "info" : "warning",
          },
        ]
      case "route":
        return [
          {
            title: "Buyer routing",
            detail: `${buyerMatchesOpen} buyer match${buyerMatchesOpen === 1 ? "" : "es"} are open right now.`,
            href: "/admin/buyer-matches",
            tone: buyerMatchesOpen > 0 ? "warning" : "info",
          },
          {
            title: "Capital routing",
            detail: `${lenderMatchesOpen} lender match${lenderMatchesOpen === 1 ? "" : "es"} still need movement.`,
            href: "/admin/lender-matches",
            tone: lenderMatchesOpen > 0 ? "warning" : "info",
          },
          {
            title: "Builder lane",
            detail: `${data.summary.dealMachineAlignedPartners} partner profile${data.summary.dealMachineAlignedPartners === 1 ? "" : "s"} overlap active DealMachine markets.`,
            href: "/admin/investor-partnerships?lane=builder",
            tone: data.summary.dealMachineAlignedPartners > 0 ? "info" : "warning",
          },
        ]
      case "outreach":
        return [
          {
            title: "Queue pressure",
            detail: sendReady === 0 ? "The send-ready queue is empty." : `${sendReady} approved message${sendReady === 1 ? "" : "s"} are ready to go.`,
            href: "#outreach-command",
            tone: sendReady === 0 ? "critical" : "info",
          },
          {
            title: "Seller follow-ups",
            detail: `${leadFollowUpsDue} seller follow-up${leadFollowUpsDue === 1 ? "" : "s"} are due now.`,
            href: "#inbox-command",
            tone: leadFollowUpsDue > 0 ? "warning" : "info",
          },
          {
            title: "Partner follow-ups",
            detail: `${partnerFollowUpsDue} buyer or lender follow-up${partnerFollowUpsDue === 1 ? "" : "s"} are due.`,
            href: "#inbox-command",
            tone: partnerFollowUpsDue > 0 ? "warning" : "info",
          },
          {
            title: "Strategy lab",
            detail: data.strategyLab.nextMove,
            href: "#strategy-lab-command",
            tone: data.strategyLab.status === "red" ? "critical" : data.strategyLab.status === "yellow" ? "warning" : "info",
          },
        ]
      case "capital":
        return [
          {
            title: "Capital queue",
            detail: `${lenderMatchesOpen} lender match${lenderMatchesOpen === 1 ? "" : "es"} are open right now.`,
            href: "/admin/lender-matches",
            tone: lenderMatchesOpen > 0 ? "warning" : "info",
          },
          {
            title: "Confirmed lender criteria",
            detail: `${data.summary.partnerBuyBoxesConfirmed} confirmed partner buy boxes are ready to route.`,
            href: "/admin/investor-partnerships",
            tone: data.summary.partnerBuyBoxesConfirmed > 0 ? "info" : "warning",
          },
          {
            title: "Research blockers",
            detail: `${researchChecklistsOpen} research checklist${researchChecklistsOpen === 1 ? "" : "s"} still block clean packaging.`,
            href: "/admin/research-checklists",
            tone: researchChecklistsOpen > 0 ? "warning" : "info",
          },
        ]
      case "authority":
      default:
        return [
          {
            title: "Publishing cadence",
            detail: `${published7d} item${published7d === 1 ? "" : "s"} published in the last 7 days.`,
            href: "/admin/research",
            tone: published7d >= 5 ? "info" : "warning",
          },
          {
            title: "Authority backlog",
            detail: `${authorityTasks} authority task${authorityTasks === 1 ? "" : "s"} remain open.`,
            href: "/admin/research",
            tone: authorityTasks > 0 ? "warning" : "info",
          },
          {
            title: "Strategy visibility plays",
            detail: focusPlay ? `${focusPlay.name} is the current Boss focus play.` : "Open the strategy engine to rank visibility plays.",
            href: "#strategy-engine",
            tone: "info",
          },
        ]
    }
  }, [
    activeMode,
    allExportsStale,
    authorityTasks,
    buyerMatchesOpen,
    data.summary.dealMachineAlignedPartners,
    data.summary.newLeads24h,
    data.summary.partnerBuyBoxesConfirmed,
    data.summary.partnerDiscoveryRuns7d,
    data.summary.partnerResearchReady,
    data.strategyLab.nextMove,
    data.strategyLab.status,
    focusPlay,
    leadFollowUpsDue,
    lenderMatchesOpen,
    partnerFollowUpsDue,
    published7d,
    researchChecklistsOpen,
    sendReady,
  ])

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

      <div className="grid items-start gap-4 xl:grid-cols-[0.72fr_1.28fr]">
        <div id="command-deck" className="min-w-0">
          <CommandCenterCommandDeck
            modes={COMMAND_MODES}
            activeMode={activeMode}
            onModeChange={setModeAndFocus}
            commandInput={commandInput}
            onCommandInputChange={setCommandInput}
            onCommandSubmit={(command) => runIntent(resolveCommand(command) || previewIntent)}
            preview={previewIntent}
            suggestions={commandSuggestions.map(({ id, label, detail }) => ({ id, label, detail }))}
            onSuggestionSelect={(suggestionId) => runIntent(suggestionIntentMap.get(suggestionId) || null)}
            needsNow={needsNow}
            focusPlay={
              focusPlay
                ? {
                    name: focusPlay.name,
                    thesis: focusPlay.thesis,
                    whyNow: focusPlay.whyNow[0] || focusPlay.expectedOutcome,
                    score: focusPlay.score,
                  }
                : null
            }
          />
        </div>

        <PanelShell className="min-h-[620px] overflow-hidden border-cyan-300/15 bg-slate-950/55 p-0 shadow-[0_0_0_1px_rgba(34,211,238,0.06),0_32px_110px_rgba(8,145,178,0.12)]">
          <div className="relative h-full min-h-[620px]">
            <MissionCore
              nodes={data.missionNodes}
              focusedAgent={focusedAgent}
              onAgentClick={setFocusedAgent}
              onAgentAction={runAgentAction}
              onOpenCodex={() =>
                openCopilotWithPrompt("What needs me now across the command center?", true, {
                  mode: activeMode,
                  focusAgent: focusedAgent,
                })
              }
              onAskCodex={(prompt, key) =>
                openCopilotWithPrompt(prompt, true, {
                  mode: key ? AGENT_TO_MODE[key] : focusedAgent ? AGENT_TO_MODE[focusedAgent] : activeMode,
                  focusAgent: key || focusedAgent,
                })
              }
            />

            <div className="pointer-events-none absolute bottom-4 left-4 z-20 rounded-2xl border border-white/10 bg-slate-950/65 px-3 py-2 backdrop-blur">
              <p className="vb-mono text-[0.6rem] uppercase tracking-[0.24em] text-slate-400">
                Live {COMMAND_MODES.find((mode) => mode.key === activeMode)?.label || "Command"} mission core
              </p>
              <p className="mt-1 max-w-[280px] text-xs leading-5 text-slate-500">
                Pan the asset field, focus a module, and ask Codex for the next move without leaving the operating surface.
              </p>
            </div>

            {activeFocusAgent && activeFocusNode ? (
              <div className="pointer-events-auto absolute bottom-4 right-4 z-20 hidden w-[280px] rounded-2xl border border-white/10 bg-slate-950/75 p-4 backdrop-blur 2xl:block">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="vb-mono text-[0.58rem] uppercase tracking-[0.16em] text-slate-500">
                      {COMMAND_MODES.find((mode) => mode.key === activeMode)?.label || "Live"} focus
                    </p>
                    <h2 className="mt-1 text-base font-semibold text-white">{activeFocusAgent.name}</h2>
                  </div>
                  <span className={cn("rounded-full border px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.14em]", AGENT_ACCENTS[activeFocusAgent.key].text, "border-white/10 bg-white/[0.04]")}>
                    {statusLabel(activeFocusAgent.status)}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-200">{activeFocusNode.headline}</p>
                <p className="mt-2 text-xs leading-5 text-slate-400">{activeFocusNode.detail}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {activeFocusNode.signals.map((metric) => (
                    <div key={metric.label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                      <p className="vb-mono text-[0.55rem] uppercase tracking-[0.14em] text-slate-500">{metric.label}</p>
                      <p className={cn("mt-1 text-base font-semibold tabular-nums", kpiTone(metric.status))}>{metric.value}</p>
                      {metric.helper ? <p className="text-[0.6rem] text-slate-500">{metric.helper}</p> : null}
                    </div>
                  ))}
                </div>
                <div className="mt-3 space-y-1.5 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-3">
                  <p className="vb-mono text-[0.55rem] uppercase tracking-[0.14em] text-slate-500">Watch now</p>
                  {activeFocusNode.watchItems.map((item) => (
                    <div key={item} className="flex gap-2 text-xs leading-5 text-slate-300">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      openCopilotWithPrompt(`What matters most in the ${activeFocusAgent.name} lane right now?`, true, {
                        mode: AGENT_TO_MODE[activeFocusAgent.key],
                        focusAgent: activeFocusAgent.key,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.08] px-2.5 py-1.5 text-xs font-medium text-cyan-100 transition-colors hover:border-cyan-200/45 hover:text-white"
                  >
                    <Bot className="h-3 w-3" />
                    Ask Codex
                  </button>
                  {activeFocusNode.actions.slice(0, 3).map((action) => (
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
                                focusAgent: activeFocusAgent.key,
                              }
                            : {
                                kind: "navigate",
                                title: action.label,
                                detail: action.label,
                                actionLabel: "Open",
                                href: action.href,
                                mode: activeMode,
                                focusAgent: activeFocusAgent.key,
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
            ) : null}
          </div>
        </PanelShell>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.88fr_1.12fr]">
          <PanelShell className="flex-1">
            <PanelTitle icon={Crosshair} title="Mission focus" hint={COMMAND_MODES.find((mode) => mode.key === activeMode)?.label} />
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {activeFocusNode?.headline || activeFocusAgent?.statusReason || "No lane selected yet."}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {(activeFocusNode?.signals || activeModeDetails.metrics).map((metric) => (
                <div key={metric.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3">
                  <p className="vb-mono text-[0.58rem] uppercase tracking-[0.14em] text-slate-500">{metric.label}</p>
                  <p className={cn("mt-1 text-lg font-semibold tabular-nums", kpiTone(metric.status))}>{metric.value}</p>
                  {metric.helper ? <p className="mt-0.5 text-[0.65rem] text-slate-500">{metric.helper}</p> : null}
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2 border-t border-white/[0.06] pt-4">
              {(activeFocusNode?.watchItems || []).length ? (
                activeFocusNode.watchItems.map((item) => (
                  <div key={item} className="flex gap-2 text-xs leading-5 text-slate-300">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
                    <span>{item}</span>
                  </div>
                ))
              ) : (
                activeFocusAgent?.feed.slice(0, 3).map((item, index) => <FeedRow key={`${item.label}-${index}`} item={item} />)
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(activeFocusNode?.actions || []).slice(0, 3).map((action) => (
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
                            focusAgent: activeFocusAgent?.key,
                          }
                        : {
                            kind: "navigate",
                            title: action.label,
                            detail: action.label,
                            actionLabel: "Open",
                            href: action.href,
                            mode: activeMode,
                            focusAgent: activeFocusAgent?.key,
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
          </PanelShell>

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

      <CommandCenterStrategyOpsPanel
        strategyLab={data.strategyLab}
        operatingLoops={data.operatingLoops}
        operatingArchitecture={data.operatingArchitecture}
        dealMemory={data.dealMemory}
        sourceGovernor={data.sourceGovernor}
        suppressionCenter={data.suppressionCenter}
        dealMachineFreshness={data.dealMachineFreshness}
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
                <motion.div
                  initial={reduce ? false : { opacity: 0 }}
                  whileInView={reduce ? undefined : { opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4 }}
                  className="grid gap-4 md:grid-cols-2"
                >
                  {coreAgents.map((agent) => (
                    <AgentPanel key={agent.key} agent={agent} focused={focusedAgent === agent.key} onFocus={setFocusedAgent} />
                  ))}
                </motion.div>
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
