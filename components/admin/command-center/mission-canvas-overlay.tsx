"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { ArrowUpRight, Bot, Crosshair, LocateFixed, Minus, Plus, ScanLine } from "lucide-react"

import { cn } from "@/lib/utils"
import type { AgentAction, AgentKey, AgentStatus, MissionNode } from "@/lib/admin/commandCenter"

export type MissionVisualMode = "scan" | "value" | "route" | "offer"

const WORLD = {
  width: 1680,
  height: 1180,
  centerX: 840,
  centerY: 590,
}

const NODE_OFFSETS: Record<AgentKey, { x: number; y: number }> = {
  acquisition: { x: -520, y: -160 },
  outreach: { x: -340, y: 165 },
  routing: { x: 250, y: -110 },
  underwriting: { x: 490, y: 180 },
  authority: { x: 40, y: -355 },
  qa: { x: -485, y: 270 },
  operator: { x: 15, y: 340 },
}

const AGENT_COLORS: Record<AgentKey, { accent: string; edge: string; glow: string }> = {
  acquisition: { accent: "#22d3ee", edge: "rgba(34, 211, 238, 0.6)", glow: "rgba(34, 211, 238, 0.18)" },
  outreach: { accent: "#60a5fa", edge: "rgba(96, 165, 250, 0.55)", glow: "rgba(96, 165, 250, 0.18)" },
  routing: { accent: "#34d399", edge: "rgba(52, 211, 153, 0.55)", glow: "rgba(52, 211, 153, 0.18)" },
  underwriting: { accent: "#facc15", edge: "rgba(250, 204, 21, 0.5)", glow: "rgba(250, 204, 21, 0.16)" },
  authority: { accent: "#c084fc", edge: "rgba(192, 132, 252, 0.55)", glow: "rgba(192, 132, 252, 0.18)" },
  qa: { accent: "#fb7185", edge: "rgba(251, 113, 133, 0.55)", glow: "rgba(251, 113, 133, 0.18)" },
  operator: { accent: "#e2e8f0", edge: "rgba(226, 232, 240, 0.5)", glow: "rgba(226, 232, 240, 0.12)" },
}

const SECONDARY_LINKS: Array<[AgentKey, AgentKey]> = [
  ["acquisition", "outreach"],
  ["outreach", "routing"],
  ["routing", "underwriting"],
  ["underwriting", "authority"],
  ["authority", "qa"],
  ["qa", "operator"],
  ["operator", "acquisition"],
]

const MODULE_LABELS: Record<AgentKey, string> = {
  acquisition: "Lead radar",
  outreach: "Signal relay",
  routing: "Deal router",
  underwriting: "MAO engine",
  authority: "Authority array",
  qa: "Risk shield",
  operator: "Operator console",
}

const VISUAL_MODES: Array<{ key: MissionVisualMode; label: string; detail: string }> = [
  { key: "scan", label: "Scan", detail: "Distress, ownership, condition" },
  { key: "value", label: "Value", detail: "ARV, MAO, spread bands" },
  { key: "route", label: "Route", detail: "Buyers, lenders, builders" },
  { key: "offer", label: "Offer", detail: "Cash and creative paths" },
]

type ViewportState = {
  x: number
  y: number
  scale: number
}

const DEFAULT_VIEWPORT: ViewportState = {
  x: 0,
  y: 0,
  scale: 1,
}

function statusTone(status: AgentStatus) {
  switch (status) {
    case "attention":
      return "border-amber-300/30 bg-amber-300/10 text-amber-100"
    case "active":
      return "border-cyan-300/25 bg-cyan-300/[0.08] text-cyan-100"
    default:
      return "border-white/10 bg-white/[0.03] text-slate-300"
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function pathBetween(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const controlX = from.x + dx / 2
  const controlY = from.y + dy / 2 - Math.max(80, Math.abs(dx) * 0.08)
  return `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`
}

export function MissionCanvasOverlay({
  nodes,
  focusedAgent,
  visualMode,
  onVisualModeChange,
  onScanPulse,
  onAgentClick,
  onAgentAction,
  onOpenCodex,
  onAskCodex,
}: {
  nodes: MissionNode[]
  focusedAgent: AgentKey | null
  visualMode: MissionVisualMode
  onVisualModeChange: (mode: MissionVisualMode) => void
  onScanPulse: () => void
  onAgentClick?: (key: AgentKey) => void
  onAgentAction?: (action: AgentAction, key: AgentKey) => void
  onOpenCodex?: () => void
  onAskCodex?: (prompt: string, key?: AgentKey) => void
}) {
  const [viewport, setViewport] = useState<ViewportState>(DEFAULT_VIEWPORT)
  const dragStateRef = useRef<{ active: boolean; x: number; y: number; pointerId: number | null }>({
    active: false,
    x: 0,
    y: 0,
    pointerId: null,
  })

  const nodeByKey = useMemo(
    () =>
      new Map(
        nodes.map((node) => [
          node.key,
          {
            ...node,
            position: {
              x: WORLD.centerX + NODE_OFFSETS[node.key].x,
              y: WORLD.centerY + NODE_OFFSETS[node.key].y,
            },
          },
        ])
      ),
    [nodes]
  )

  const positionedNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        position: {
          x: WORLD.centerX + NODE_OFFSETS[node.key].x,
          y: WORLD.centerY + NODE_OFFSETS[node.key].y,
        },
      })),
    [nodes]
  )

  const adjustZoom = useCallback((delta: number) => {
    setViewport((current) => ({
      ...current,
      scale: clamp(Number((current.scale + delta).toFixed(2)), 0.74, 1.8),
    }))
  }, [])

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const interactiveTarget = (event.target as HTMLElement).closest("[data-canvas-interactive='true']")
    if (interactiveTarget) return

    dragStateRef.current = {
      active: true,
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [])

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.active) return
    const dx = event.clientX - dragStateRef.current.x
    const dy = event.clientY - dragStateRef.current.y
    dragStateRef.current.x = event.clientX
    dragStateRef.current.y = event.clientY
    setViewport((current) => ({
      ...current,
      x: clamp(current.x + dx, -320, 320),
      y: clamp(current.y + dy, -260, 260),
    }))
  }, [])

  const stopDragging = useCallback((event?: React.PointerEvent<HTMLDivElement>) => {
    if (event && dragStateRef.current.pointerId !== null) {
      try {
        event.currentTarget.releasePointerCapture(dragStateRef.current.pointerId)
      } catch {
        // ignore capture release errors
      }
    }
    dragStateRef.current.active = false
    dragStateRef.current.pointerId = null
  }, [])

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const nextScale = viewport.scale + (event.deltaY < 0 ? 0.08 : -0.08)
    setViewport((current) => ({
      ...current,
      scale: clamp(Number(nextScale.toFixed(2)), 0.74, 1.8),
    }))
  }, [viewport.scale])

  const centralPrompt =
    focusedAgent && nodeByKey.has(focusedAgent)
      ? `What matters most in the ${nodeByKey.get(focusedAgent)?.label} lane right now?`
      : "What needs me now across the command center?"
  const activeVisualMode = VISUAL_MODES.find((mode) => mode.key === visualMode) || VISUAL_MODES[0]

  return (
    <div
      className="absolute inset-0 z-10 overflow-hidden"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerLeave={stopDragging}
      onWheel={handleWheel}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.06),transparent_42%),linear-gradient(to_right,rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:100%_100%,44px_44px,44px_44px] opacity-70" />

      <div
        className="pointer-events-auto absolute left-2 right-2 top-2 z-30 w-auto rounded-2xl border border-cyan-300/15 bg-slate-950/72 px-3 py-3 backdrop-blur sm:left-4 sm:right-auto sm:top-4 sm:w-[330px]"
        data-canvas-interactive="true"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="vb-mono text-[0.58rem] uppercase tracking-[0.18em] text-cyan-200/80">Real estate command hologram</p>
            <p className="mt-1 hidden text-[0.7rem] text-slate-300 sm:block">Pan the asset scan · zoom the field · click a module to focus</p>
          </div>
          <button
            type="button"
            onClick={onScanPulse}
            data-visual-action="pulse-scan"
            className="inline-flex h-8 w-8 shrink-0 scroll-mt-24 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-100 transition-colors hover:border-cyan-200/45 hover:text-white"
            aria-label="Pulse scan"
          >
            <ScanLine className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-3 grid grid-cols-[repeat(4,minmax(0,1fr))] gap-1 sm:gap-1.5">
          {VISUAL_MODES.map((mode) => (
            <button
              key={mode.key}
              type="button"
              onClick={() => onVisualModeChange(mode.key)}
              data-visual-mode={mode.key}
              data-active={visualMode === mode.key}
              aria-pressed={visualMode === mode.key}
              aria-label={`${mode.label} mode: ${mode.detail}`}
              className={cn(
                "min-w-0 scroll-mt-24 rounded-lg border px-1.5 py-1.5 text-left transition-colors sm:px-2",
                visualMode === mode.key
                  ? "border-cyan-300/35 bg-cyan-300/[0.12] text-cyan-50"
                  : "border-white/[0.08] bg-white/[0.03] text-slate-300 hover:border-white/20 hover:text-white"
              )}
              title={mode.detail}
            >
              <span className="vb-mono block truncate text-[0.48rem] uppercase tracking-[0.08em] sm:text-[0.52rem] sm:tracking-[0.12em]">{mode.label}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2">
          <div>
            <p className="vb-mono text-[0.5rem] uppercase tracking-[0.16em] text-slate-500">Active lens</p>
            <p className="mt-0.5 text-[0.72rem] font-medium text-cyan-50">{activeVisualMode.label}</p>
          </div>
          <p className="max-w-[185px] text-right text-[0.66rem] leading-4 text-slate-300">{activeVisualMode.detail}</p>
        </div>
      </div>

      <div className="pointer-events-auto absolute left-1/2 top-[10.75rem] z-30 flex -translate-x-1/2 items-center gap-2 sm:left-auto sm:right-4 sm:top-4 sm:translate-x-0" data-canvas-interactive="true">
        <button
          type="button"
          onClick={() => setViewport(DEFAULT_VIEWPORT)}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-slate-950/75 px-2.5 py-1.5 text-[0.68rem] font-medium text-slate-200 backdrop-blur transition-colors hover:border-cyan-300/35 hover:text-white"
        >
          <LocateFixed className="h-3.5 w-3.5" />
          Fit
        </button>
        <button
          type="button"
          onClick={() => adjustZoom(-0.1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-slate-950/75 text-slate-200 backdrop-blur transition-colors hover:border-cyan-300/35 hover:text-white"
          aria-label="Zoom out"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => adjustZoom(0.1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-slate-950/75 text-slate-200 backdrop-blur transition-colors hover:border-cyan-300/35 hover:text-white"
          aria-label="Zoom in"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div
        className="absolute left-1/2 top-1/2 z-10"
        style={{
          width: WORLD.width,
          height: WORLD.height,
          marginLeft: -WORLD.width / 2,
          marginTop: -WORLD.height / 2,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
          transformOrigin: `${WORLD.centerX}px ${WORLD.centerY}px`,
        }}
      >
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          viewBox={`0 0 ${WORLD.width} ${WORLD.height}`}
          fill="none"
        >
          {positionedNodes.map((node) => {
            const color = AGENT_COLORS[node.key]
            const dimmed = focusedAgent && focusedAgent !== node.key
            const center = { x: WORLD.centerX, y: WORLD.centerY }
            return (
              <g key={`link-${node.key}`}>
                <path
                  d={pathBetween(center, node.position)}
                  stroke={color.edge}
                  strokeOpacity={dimmed ? 0.14 : 0.25 + node.intensity * 0.5}
                  strokeWidth={focusedAgent === node.key ? 3.25 : 2}
                  strokeLinecap="round"
                  strokeDasharray={focusedAgent === node.key ? "0" : "6 10"}
                />
              </g>
            )
          })}
          {SECONDARY_LINKS.map(([fromKey, toKey]) => {
            const from = nodeByKey.get(fromKey)
            const to = nodeByKey.get(toKey)
            if (!from || !to) return null
            const focused = focusedAgent && (focusedAgent === fromKey || focusedAgent === toKey)
            return (
              <path
                key={`secondary-${fromKey}-${toKey}`}
                d={pathBetween(from.position, to.position)}
                stroke="rgba(148, 163, 184, 0.16)"
                strokeOpacity={focused ? 0.42 : 0.18}
                strokeWidth={focused ? 2.2 : 1.1}
                strokeLinecap="round"
              />
            )
          })}
          <g opacity="0.72">
            <path
              d={`M ${WORLD.centerX - 188} ${WORLD.centerY + 72} L ${WORLD.centerX - 86} ${WORLD.centerY - 98} L ${WORLD.centerX + 168} ${WORLD.centerY - 66} L ${WORLD.centerX + 204} ${WORLD.centerY + 98} L ${WORLD.centerX - 42} ${WORLD.centerY + 142} Z`}
              fill="rgba(34, 211, 238, 0.035)"
              stroke="rgba(125, 211, 252, 0.32)"
              strokeWidth="2"
            />
            <path
              d={`M ${WORLD.centerX - 188} ${WORLD.centerY + 72} L ${WORLD.centerX + 168} ${WORLD.centerY - 66}`}
              stroke="rgba(125, 211, 252, 0.24)"
              strokeWidth="1.4"
            />
            <path
              d={`M ${WORLD.centerX - 42} ${WORLD.centerY + 142} L ${WORLD.centerX - 86} ${WORLD.centerY - 98} M ${WORLD.centerX + 204} ${WORLD.centerY + 98} L ${WORLD.centerX + 168} ${WORLD.centerY - 66}`}
              stroke="rgba(226, 232, 240, 0.24)"
              strokeWidth="1.4"
            />
            <circle
              cx={WORLD.centerX}
              cy={WORLD.centerY}
              r="182"
              stroke="rgba(34, 211, 238, 0.16)"
              strokeWidth="1.4"
              strokeDasharray="10 14"
            />
          </g>
        </svg>

        <div
          data-canvas-interactive="true"
          className="absolute"
          style={{
            left: WORLD.centerX - 560,
            top: WORLD.centerY + 250,
            width: 300,
          }}
        >
          <div className="rounded-[26px] border border-cyan-300/25 bg-slate-950/68 px-5 py-4 shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_22px_70px_rgba(2,8,23,0.5)] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="vb-mono text-[0.58rem] uppercase tracking-[0.18em] text-cyan-200/80">VestBlock asset scanner</p>
                <h3 className="mt-1 text-base font-semibold text-white">Property, offers, buyers, and risk in one field</h3>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-2 py-0.5 text-[0.62rem] font-medium text-cyan-100">
                <ScanLine className="h-3 w-3" />
                scanning
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-300">
              {VISUAL_MODES.find((mode) => mode.key === visualMode)?.detail || "asset intelligence"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onOpenCodex}
                className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1.5 text-xs font-medium text-cyan-100 transition-colors hover:border-cyan-200/45 hover:text-white"
              >
                <Bot className="h-3.5 w-3.5" />
                Open Codex
              </button>
              <button
                type="button"
                onClick={() => onAskCodex?.(centralPrompt, focusedAgent || undefined)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-white/20 hover:text-white"
              >
                <Crosshair className="h-3.5 w-3.5" />
                What needs me now?
              </button>
            </div>
          </div>
        </div>

        {positionedNodes.map((node) => {
          const isFocused = focusedAgent === node.key
          const isDimmed = Boolean(focusedAgent && !isFocused)
          const color = AGENT_COLORS[node.key]
          const primaryAction = node.actions[0]

          return (
            <div
              key={node.key}
              data-canvas-interactive="true"
              className="absolute"
              style={{
                left: node.position.x - 128,
                top: node.position.y - 82,
                width: 256,
              }}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => onAgentClick?.(node.key)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return
                  event.preventDefault()
                  onAgentClick?.(node.key)
                }}
                className={cn(
                  "group block w-full cursor-pointer rounded-[22px] border bg-slate-950/78 px-4 py-3 text-left backdrop-blur-xl transition-all",
                  isFocused
                    ? "border-cyan-300/40 shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_18px_55px_rgba(34,211,238,0.12)]"
                    : "border-white/10 hover:border-white/20",
                  isDimmed && "opacity-45"
                )}
                style={{
                  boxShadow: isFocused ? `0 0 0 1px ${color.glow}, 0 18px 60px ${color.glow}` : undefined,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.58rem] uppercase tracking-[0.14em]",
                        statusTone(node.status)
                      )}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: color.accent, boxShadow: `0 0 14px ${color.accent}` }}
                      />
                      {MODULE_LABELS[node.key]}
                    </span>
                    <p className="mt-2 text-sm font-semibold text-white">{node.headline}</p>
                  </div>
                  <div
                    className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]"
                    style={{
                      background: `radial-gradient(circle at 35% 35%, ${color.glow}, rgba(15, 23, 42, 0.5))`,
                    }}
                  >
                    <span className="absolute h-px w-7" style={{ backgroundColor: color.accent, boxShadow: `0 0 14px ${color.accent}` }} />
                    <span className="absolute h-7 w-px" style={{ backgroundColor: color.accent, boxShadow: `0 0 14px ${color.accent}` }} />
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color.accent, boxShadow: `0 0 16px ${color.accent}` }} />
                  </div>
                </div>

                <p className="mt-2 line-clamp-3 text-[0.72rem] leading-5 text-slate-400">{node.detail}</p>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {node.signals.slice(0, 2).map((metric) => (
                    <div key={metric.label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-2.5 py-2">
                      <p className="vb-mono text-[0.52rem] uppercase tracking-[0.14em] text-slate-500">{metric.label}</p>
                      <p className="mt-1 text-sm font-semibold text-white">{metric.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onAskCodex?.(`What matters most in the ${node.label} lane right now?`, node.key)
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[0.68rem] font-medium text-slate-200 transition-colors hover:border-cyan-300/35 hover:text-white"
                  >
                    <Bot className="h-3.5 w-3.5" />
                    Ask Codex
                  </button>
                  {primaryAction ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onAgentAction?.(primaryAction, node.key)
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[0.68rem] font-medium text-slate-200 transition-colors hover:border-cyan-300/35 hover:text-white"
                    >
                      {primaryAction.label}
                      <ArrowUpRight className="h-3 w-3 opacity-70" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
