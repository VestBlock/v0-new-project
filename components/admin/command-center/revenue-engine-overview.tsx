"use client"

import { AlertTriangle, ArrowUpRight, BriefcaseBusiness, Building2, CircleDollarSign, Gauge, Handshake, ShieldCheck, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import type { RevenueExecutiveSnapshot, RevenueLane } from "@/lib/revenue-engine/types"

const LANE_ICON: Record<RevenueLane, LucideIcon> = {
  deals: Building2,
  capital: CircleDollarSign,
  partners: Handshake,
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
}

function statusTone(status: "green" | "yellow" | "red") {
  if (status === "red") return "border-rose-400/25 bg-rose-400/[0.07] text-rose-200"
  if (status === "yellow") return "border-amber-300/25 bg-amber-300/[0.07] text-amber-100"
  return "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-100"
}

export function RevenueEngineOverview({ snapshot }: { snapshot: RevenueExecutiveSnapshot }) {
  const attentionAutomations = snapshot.automation.entries
    .filter((entry) => entry.status === "blocked" || entry.status === "attention" || entry.riskClass === "red")
    .slice(0, 5)

  return (
    <section id="revenue-engine" className="overflow-hidden rounded-3xl border border-[#b7ff3c]/15 bg-[#0b0d10] shadow-[0_28px_100px_rgba(0,0,0,0.34)]">
      <div className="border-b border-white/[0.07] bg-[radial-gradient(circle_at_top_right,rgba(183,255,60,0.12),transparent_42%)] px-5 py-5 md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-[#c9ff77]">
              <Gauge className="h-4 w-4" />
              <p className="vb-mono text-[0.62rem] uppercase tracking-[0.24em]">Revenue Engine · Executive view</p>
            </div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-white md:text-2xl">{snapshot.headline}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Deals, Capital, Partners, and automation health are normalized here. Live actions remain behind their existing consent, suppression, and approval gates.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
            <div className="rounded-xl border border-white/[0.07] bg-black/25 px-3 py-2.5">
              <p className="vb-mono text-[0.55rem] uppercase tracking-[0.14em] text-slate-500">Attention</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-white">{snapshot.today.attentionCount}</p>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-black/25 px-3 py-2.5">
              <p className="vb-mono text-[0.55rem] uppercase tracking-[0.14em] text-slate-500">Urgent</p>
              <p className={cn("mt-1 text-xl font-semibold tabular-nums", snapshot.today.urgentCount ? "text-rose-300" : "text-emerald-300")}>{snapshot.today.urgentCount}</p>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-black/25 px-3 py-2.5">
              <p className="vb-mono text-[0.55rem] uppercase tracking-[0.14em] text-slate-500">Target</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-[#c9ff77]">{snapshot.money.targetProgress}%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-px bg-white/[0.06] lg:grid-cols-[0.82fr_1.18fr]">
        <div className="bg-[#0b0d10] p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BriefcaseBusiness className="h-4 w-4 text-[#b7ff3c]" />
              <h3 className="text-sm font-semibold text-white">Money and today</h3>
            </div>
            <span className="vb-mono text-[0.55rem] uppercase tracking-[0.14em] text-slate-600">real operating data</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              { label: "Revenue · 30d", value: money(snapshot.money.revenue30d) },
              { label: "30d target", value: money(snapshot.money.target30d) },
              { label: "Active deals", value: snapshot.money.activeDeals },
              { label: "Packets ready", value: snapshot.money.packetReady },
            ].map((metric) => (
              <div key={metric.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3">
                <p className="vb-mono text-[0.54rem] uppercase tracking-[0.13em] text-slate-500">{metric.label}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-white">{metric.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {snapshot.today.topPriorities.length ? snapshot.today.topPriorities.map((priority, index) => (
              <div key={`${priority}-${index}`} className="flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.018] px-3 py-2.5">
                <span className="vb-mono mt-0.5 text-[0.58rem] text-[#b7ff3c]">{String(index + 1).padStart(2, "0")}</span>
                <p className="text-xs leading-5 text-slate-300">{priority}</p>
              </div>
            )) : (
              <p className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04] px-3 py-3 text-xs text-emerald-100">No ranked priority is waiting in the current snapshot.</p>
            )}
          </div>
        </div>

        <div className="bg-[#0b0d10] p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-[#b7ff3c]" />
              <h3 className="text-sm font-semibold text-white">Shared pipelines</h3>
            </div>
            <span className="vb-mono text-[0.55rem] uppercase tracking-[0.14em] text-slate-600">Deals · Capital · Partners</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {snapshot.lanes.map((lane) => {
              const Icon = LANE_ICON[lane.lane]
              return (
                <article key={lane.lane} className="flex min-h-[220px] flex-col rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#b7ff3c]/15 bg-[#b7ff3c]/[0.06] text-[#c9ff77]"><Icon className="h-4 w-4" /></span>
                    <span className={cn("rounded-full border px-2 py-0.5 text-[0.58rem] uppercase tracking-[0.12em]", statusTone(lane.status))}>{lane.status}</span>
                  </div>
                  <h4 className="mt-3 text-base font-semibold text-white">{lane.label}</h4>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div><p className="vb-mono text-[0.52rem] uppercase tracking-[0.12em] text-slate-600">Active</p><p className="mt-1 text-lg font-semibold text-white">{lane.active}</p></div>
                    <div><p className="vb-mono text-[0.52rem] uppercase tracking-[0.12em] text-slate-600">Attention</p><p className="mt-1 text-lg font-semibold text-amber-200">{lane.attention}</p></div>
                  </div>
                  <p className="mt-3 text-[0.68rem] text-slate-500">{lane.leadingMetric}: <span className="text-slate-200">{lane.leadingValue}</span></p>
                  <p className="mt-auto pt-3 text-xs leading-5 text-slate-400">{lane.nextMove}</p>
                </article>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-px border-t border-white/[0.06] bg-white/[0.06] xl:grid-cols-[1.15fr_0.85fr]">
        <div className="bg-[#0b0d10] p-5 md:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#b7ff3c]" />
              <h3 className="text-sm font-semibold text-white">Automation registry</h3>
            </div>
            <p className="text-[0.65rem] text-slate-500">{snapshot.automation.inventoryTotal} inventoried · {snapshot.automation.registeredSchedulers} control-plane records · 0 approved removals</p>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {[
              { label: "Active", value: snapshot.automation.active, tone: "text-emerald-300" },
              { label: "Paused", value: snapshot.automation.paused, tone: "text-slate-200" },
              { label: "Blocked", value: snapshot.automation.blocked, tone: "text-rose-300" },
              { label: "Attention", value: snapshot.automation.attention, tone: "text-amber-200" },
            ].map((metric) => (
              <div key={metric.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                <p className="vb-mono text-[0.52rem] uppercase tracking-[0.12em] text-slate-600">{metric.label}</p>
                <p className={cn("mt-1 text-lg font-semibold", metric.tone)}>{metric.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            {attentionAutomations.map((entry) => (
              <div key={entry.id} className="flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-white/[0.018] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-white">{entry.name}</p>
                  <p className="mt-0.5 truncate text-[0.65rem] text-slate-500">{entry.surface} · {entry.owner} · {entry.disposition}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <span className={cn("rounded-full border px-2 py-0.5 text-[0.55rem] uppercase tracking-[0.11em]", statusTone(entry.riskClass))}>{entry.riskClass}</span>
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[0.55rem] uppercase tracking-[0.11em] text-slate-300">{entry.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#0b0d10] p-5 md:p-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-200" />
            <h3 className="text-sm font-semibold text-white">Daily brief</h3>
          </div>
          <div className="mt-4 space-y-2">
            {snapshot.dailyBrief.map((line, index) => (
              <p key={index} className="rounded-xl border border-white/[0.06] bg-white/[0.018] px-3 py-2.5 text-xs leading-5 text-slate-300">{line}</p>
            ))}
          </div>
          <div className="mt-5 border-t border-white/[0.06] pt-4">
            <h3 className="text-sm font-semibold text-white">Weekly CEO review</h3>
            <div className="mt-3 space-y-3">
              {[
                { label: "Wins", items: snapshot.weeklyReview.wins, tone: "text-emerald-200" },
                { label: "Risks", items: snapshot.weeklyReview.risks, tone: "text-amber-200" },
                { label: "Decisions", items: snapshot.weeklyReview.decisions, tone: "text-[#c9ff77]" },
              ].map((group) => (
                <div key={group.label}>
                  <p className={cn("vb-mono text-[0.55rem] uppercase tracking-[0.14em]", group.tone)}>{group.label}</p>
                  <ul className="mt-1.5 space-y-1">
                    {group.items.slice(0, 3).map((item, index) => (
                      <li key={index} className="text-[0.68rem] leading-5 text-slate-400">• {item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-4 text-[0.65rem] leading-5 text-slate-500">
            Registry verification: {new Date(snapshot.automation.verifiedAt).toLocaleDateString()} · Live scheduler changes require the migration gates and their assigned approval class.
          </p>
        </div>
      </div>
    </section>
  )
}
