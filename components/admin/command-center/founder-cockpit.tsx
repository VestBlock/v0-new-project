"use client"

import { useMemo, useState, type ComponentProps, type FormEvent } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Brain,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CircleDollarSign,
  FileText,
  Gauge,
  ImageIcon,
  Loader2,
  Megaphone,
  Network,
  RefreshCw,
  Rocket,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react"

import { BrandMark } from "@/components/brand-logo"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { AutopilotCockpitSnapshot } from "@/lib/autopilot/cockpit"
import type { CommandCenterData } from "@/lib/admin/commandCenter"
import { cn } from "@/lib/utils"
import { CommandCenterClient } from "./command-center-client"

type FounderArea = "today" | "pipeline" | "growth" | "brain" | "system"

type Props = {
  initialData: CommandCenterData
  initialCockpit: AutopilotCockpitSnapshot
  initialBossBriefing: ComponentProps<typeof CommandCenterClient>["initialBossBriefing"]
}

const areaCopy: Record<FounderArea, { label: string; icon: LucideIcon }> = {
  today: { label: "Today", icon: Gauge },
  pipeline: { label: "Pipeline", icon: BriefcaseBusiness },
  growth: { label: "Growth", icon: Rocket },
  brain: { label: "AI Brain", icon: Brain },
  system: { label: "System", icon: Settings },
}

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

function displayTime(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

function statusTone(status: string) {
  if (["ready", "green", "active", "approved", "auto_applied", "published"].includes(status)) {
    return "border-lime-300/25 bg-lime-300/[0.08] text-lime-100"
  }
  if (["blocked", "red", "failed", "rejected"].includes(status)) {
    return "border-rose-400/25 bg-rose-400/[0.08] text-rose-100"
  }
  return "border-amber-300/25 bg-amber-300/[0.08] text-amber-100"
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-white/10 bg-[#0b0d10]/90 p-5", className)}>
      {children}
    </section>
  )
}

function Heading({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-lime-300/15 bg-lime-300/[0.07] text-lime-200">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>
      {hint ? <p className="vb-mono text-[0.58rem] uppercase tracking-[0.16em] text-slate-500">{hint}</p> : null}
    </div>
  )
}

function Metric({ label, value, helper }: { label: string; value: string | number; helper?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
      <p className="vb-mono text-[0.58rem] uppercase tracking-[0.15em] text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-white">{value}</p>
      {helper ? <p className="mt-1 text-[0.68rem] text-slate-500">{helper}</p> : null}
    </div>
  )
}

function AskBrain({ data }: { data: CommandCenterData }) {
  const [query, setQuery] = useState("")
  const [answer, setAnswer] = useState("")
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!query.trim() || loading) return
    setLoading(true)
    try {
      const response = await fetch("/api/admin/command-center/copilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: query.trim(), mode: "authority" }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Unable to ask the VestBlock Brain.")
      setAnswer(payload.message || "No answer was returned.")
    } catch (error) {
      setAnswer(error instanceof Error ? error.message : "Unable to ask the VestBlock Brain.")
    } finally {
      setLoading(false)
    }
  }

  const suggestions = [
    "What needs my attention?",
    "Where is money closest?",
    "What is wasting time?",
    `What should we do with ${data.summary.replySignals7d} reply signals?`,
  ]

  return (
    <Card className="border-lime-300/20 bg-[radial-gradient(circle_at_top_left,rgba(196,255,32,0.08),transparent_45%),#0b0d10]">
      <form onSubmit={submit}>
        <div className="flex items-center gap-2 text-lime-100">
          <Sparkles className="h-4 w-4" />
          <span className="text-sm font-semibold">Ask VestBlock Brain</span>
          <span className="ml-auto vb-mono text-[0.56rem] uppercase tracking-[0.15em] text-slate-500">grounded in live command data</span>
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Why were leads down? What should I approve? Create a strategy for Milwaukee…"
            maxLength={1200}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-lime-300/35"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="inline-flex items-center gap-2 rounded-xl border border-lime-300/30 bg-lime-300 px-4 py-3 text-sm font-semibold text-black transition hover:bg-lime-200 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Ask
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setQuery(suggestion)}
              className="rounded-full border border-white/[0.07] px-2.5 py-1 text-[0.65rem] text-slate-400 transition hover:border-lime-300/20 hover:text-white"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </form>
      {answer ? <p className="mt-4 border-t border-white/[0.07] pt-4 text-sm leading-6 text-slate-200">{answer}</p> : null}
    </Card>
  )
}

function TodayArea({ data, cockpit, onNavigate }: { data: CommandCenterData; cockpit: AutopilotCockpitSnapshot; onNavigate: (area: FounderArea) => void }) {
  const hotReplies = data.inbox.sections.find((section) => section.key === "hot_replies")?.items || []
  const partnerReplies = data.inbox.sections.find((section) => section.key === "partner_replies")?.items || []
  const needsYou = [
    ...hotReplies.slice(0, 2).map((item) => ({ title: item.title, detail: item.detail, href: item.href, kind: "Reply" })),
    ...partnerReplies.slice(0, 1).map((item) => ({ title: item.title, detail: item.detail, href: item.href, kind: "Partner" })),
    ...data.overdueTasks.slice(0, 2).map((item) => ({ title: item.title, detail: item.detail, href: item.relatedHref || item.href, kind: "Task" })),
    ...data.alerts.filter((item) => item.severity !== "info").slice(0, 2).map((item) => ({ title: item.message, detail: `${item.severity} system alert`, href: item.href, kind: "Failure" })),
  ].slice(0, 6)

  const stages = [...data.dealPipeline.stages]
    .filter((stage) => stage.count > 0)
    .sort((a, b) => b.value - a.value || b.count - a.count)
    .slice(0, 5)
  const moves = Array.from(new Set([...data.revenueEngine.today.topPriorities, ...data.priorities])).slice(0, 5)

  return (
    <div className="space-y-5">
      <AskBrain data={data} />
      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <Heading icon={AlertTriangle} title={`Needs you — ${needsYou.length}`} hint="decisions and replies" />
          <div className="mt-4 space-y-2">
            {needsYou.length ? needsYou.map((item, index) => (
              <Link key={`${item.title}-${index}`} href={item.href || "/admin/command-center"} className="group flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition hover:border-lime-300/20">
                <span className="mt-0.5 rounded-md border border-amber-300/20 bg-amber-300/[0.08] px-1.5 py-0.5 text-[0.55rem] uppercase tracking-[0.12em] text-amber-100">{item.kind}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-white">{item.title}</span>
                  <span className="mt-1 block line-clamp-2 text-[0.7rem] leading-5 text-slate-500">{item.detail}</span>
                </span>
                <ArrowRight className="mt-1 h-3.5 w-3.5 text-slate-600 transition group-hover:text-lime-200" />
              </Link>
            )) : <p className="rounded-xl border border-white/[0.06] p-4 text-sm text-slate-400">No urgent founder decision is visible in the current snapshot.</p>}
          </div>
        </Card>

        <Card>
          <Heading icon={CircleDollarSign} title="Money closest" hint="ranked from live pipeline" />
          <div className="mt-4 space-y-2">
            {stages.length ? stages.map((stage) => (
              <button key={stage.key} type="button" onClick={() => onNavigate("pipeline")} className="flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left transition hover:border-lime-300/20">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime-300/[0.08] text-sm font-semibold text-lime-100">{stage.count}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-white">{stage.label}</span>
                  <span className="mt-0.5 block text-[0.68rem] text-slate-500">{stage.items[0]?.nextAction || data.dealPipeline.nextMove}</span>
                </span>
                <span className="vb-mono text-xs text-lime-200">{stage.value > 0 ? money.format(stage.value) : "value pending"}</span>
              </button>
            )) : <p className="rounded-xl border border-white/[0.06] p-4 text-sm text-slate-400">No valued deal stage is ready to rank yet.</p>}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <Heading icon={Bot} title="AI working now" hint="plain operating summary" />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Metric label="Strategy runs" value={cockpit.aiWork.strategyRuns7d} helper="last 7 days" />
            <Metric label="Improvement runs" value={cockpit.aiWork.improvementRuns7d} helper="last 7 days" />
            <Metric label="Content queue" value={cockpit.content.drafts + cockpit.content.ready} helper="draft or ready" />
            <Metric label="Agents active" value={cockpit.aiWork.activeAgents} helper="current snapshot" />
          </div>
          {cockpit.aiWork.failedRuns7d > 0 ? <p className="mt-3 text-xs text-rose-200">{cockpit.aiWork.failedRuns7d} failed run{cockpit.aiWork.failedRuns7d === 1 ? "" : "s"} need review.</p> : null}
        </Card>

        <Card>
          <Heading icon={Target} title="Recommended moves" hint="maximum five" />
          <ol className="mt-4 space-y-2">
            {moves.map((move, index) => (
              <li key={move} className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <span className="vb-mono flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lime-300 text-[0.65rem] font-bold text-black">{index + 1}</span>
                <p className="pt-0.5 text-xs leading-5 text-slate-200">{move}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Card>
        <Heading icon={Activity} title="Today's numbers" hint={displayTime(data.generatedAt)} />
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <Metric label="Leads" value={data.summary.newLeads24h} />
          <Metric label="Replies" value={data.summary.replySignals7d} helper="7-day signal" />
          <Metric label="Positive" value={data.outcomeLearning.interested} />
          <Metric label="Qualified" value={data.outcomeLearning.qualified} />
          <Metric label="Matches" value={data.routingQueue.filter((item) => /matches open/i.test(item.label)).reduce((sum, item) => sum + item.count, 0)} />
          <Metric label="Active deals" value={data.revenueEngine.money.activeDeals} />
          <Metric label="Revenue" value={money.format(data.revenueEngine.money.revenue30d)} helper="known, 30 days" />
        </div>
      </Card>
    </div>
  )
}

function PipelineArea({ data }: { data: CommandCenterData }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        {data.revenueEngine.lanes.map((lane) => (
          <Card key={lane.lane}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="vb-mono text-[0.58rem] uppercase tracking-[0.16em] text-slate-500">{lane.label}</p>
                <p className="mt-2 text-3xl font-semibold text-white">{lane.active}</p>
              </div>
              <span className={cn("rounded-full border px-2.5 py-1 text-[0.58rem] uppercase tracking-[0.12em]", statusTone(lane.status))}>{lane.status}</span>
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-400">{lane.nextMove}</p>
            <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs">
              <span className="text-slate-500">{lane.leadingMetric}</span>
              <span className="font-semibold text-lime-100">{lane.leadingValue}</span>
            </div>
          </Card>
        ))}
      </div>
      <Card>
        <Heading icon={Network} title="Unified pipeline" hint={data.dealPipeline.summary} />
        <div className="mt-4 grid gap-3 lg:grid-cols-4 xl:grid-cols-7">
          {data.dealPipeline.stages.map((stage) => (
            <div key={stage.key} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-white">{stage.label}</p>
                <span className="vb-mono rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[0.65rem] text-lime-100">{stage.count}</span>
              </div>
              <p className="mt-2 text-[0.65rem] text-slate-500">{stage.value > 0 ? money.format(stage.value) : "Value not recorded"}</p>
              <div className="mt-3 space-y-2">
                {stage.items.slice(0, 2).map((item) => (
                  <div key={item.id} className="rounded-lg border border-white/[0.05] bg-black/20 p-2">
                    <p className="line-clamp-1 text-[0.68rem] font-medium text-slate-200">{item.propertyAddress}</p>
                    <p className="mt-1 line-clamp-2 text-[0.6rem] leading-4 text-slate-600">{item.nextAction}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function ContentStudio({ cockpit, onChanged }: { cockpit: AutopilotCockpitSnapshot; onChanged: () => Promise<void> }) {
  const [prompt, setPrompt] = useState("Explain how DSCR works for someone buying their first rental.")
  const [serviceKey, setServiceKey] = useState("real_estate_funding")
  const [platform, setPlatform] = useState("linkedin")
  const [asset, setAsset] = useState<Record<string, any> | null>(null)
  const [visualUrl, setVisualUrl] = useState<string | null>(null)
  const [scheduledFor, setScheduledFor] = useState(() => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    tomorrow.setHours(9, 0, 0, 0)
    const offset = tomorrow.getTimezoneOffset() * 60_000
    return new Date(tomorrow.getTime() - offset).toISOString().slice(0, 16)
  })
  const [working, setWorking] = useState<"draft" | "visual" | "schedule" | null>(null)
  const [message, setMessage] = useState("")

  async function createDraft() {
    setWorking("draft")
    setMessage("")
    try {
      const response = await fetch("/api/admin/content", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentType: "social_post", serviceKey, prompt, platform, postType: "educational", language: "en" }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Unable to generate content.")
      setAsset(payload.contentAsset)
      setMessage("Draft created. Review the copy before scheduling or publishing.")
      await onChanged()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to generate content.")
    } finally {
      setWorking(null)
    }
  }

  async function createVisual() {
    if (!asset?.id) return
    setWorking("visual")
    setMessage("")
    try {
      const response = await fetch("/api/admin/content/visual", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentAssetId: asset.id, format: "square", style: "premium editorial real-estate finance" }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Unable to generate the branded visual.")
      setVisualUrl(payload.signedUrl)
      setMessage("Branded graphic created as a private draft. It has not been published.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to generate the branded visual.")
    } finally {
      setWorking(null)
    }
  }

  async function addToCalendar() {
    if (!asset?.id || !scheduledFor) return
    setWorking("schedule")
    setMessage("")
    try {
      const response = await fetch("/api/admin/content", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: asset.id,
          scheduledFor: new Date(scheduledFor).toISOString(),
          scheduleStatus: "planned",
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Unable to add the draft to the calendar.")
      setAsset(payload.contentAsset)
      setMessage("Added to the internal calendar as planned. Nothing was sent to a social network.")
      await onChanged()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add the draft to the calendar.")
    } finally {
      setWorking(null)
    }
  }

  return (
    <Card className="xl:col-span-2">
      <Heading icon={Sparkles} title="VestBlock Content Studio" hint="draft → review → distribute" />
      <div className="mt-4 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-3">
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={2000} rows={5} className="w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-sm leading-6 text-white outline-none focus:border-lime-300/30" />
          <div className="grid grid-cols-2 gap-2">
            <select value={serviceKey} onChange={(event) => setServiceKey(event.target.value)} className="rounded-xl border border-white/10 bg-[#111318] px-3 py-2 text-xs text-white">
              <option value="real_estate_funding">DSCR / real estate funding</option>
              <option value="business_funding">Business funding</option>
              <option value="sell_property">Sell property</option>
              <option value="dealvault">DealVault</option>
              <option value="visibility_expansion">SEO / visibility</option>
            </select>
            <select value={platform} onChange={(event) => setPlatform(event.target.value)} className="rounded-xl border border-white/10 bg-[#111318] px-3 py-2 text-xs text-white">
              <option value="linkedin">LinkedIn</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="x">X</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void createDraft()} disabled={Boolean(working) || prompt.trim().length < 3} className="inline-flex items-center gap-2 rounded-xl bg-lime-300 px-3 py-2 text-xs font-semibold text-black disabled:opacity-50">
              {working === "draft" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              Create draft
            </button>
            <button type="button" onClick={() => void createVisual()} disabled={!asset?.id || Boolean(working)} className="inline-flex items-center gap-2 rounded-xl border border-lime-300/25 bg-lime-300/[0.08] px-3 py-2 text-xs font-semibold text-lime-100 disabled:opacity-40">
              {working === "visual" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
              Create graphic
            </button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input aria-label="Planned content date and time" type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#111318] px-3 py-2 text-xs text-white" />
            <button type="button" onClick={() => void addToCalendar()} disabled={!asset?.id || !scheduledFor || Boolean(working)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 disabled:opacity-40">
              {working === "schedule" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarDays className="h-3.5 w-3.5" />}
              Add to calendar
            </button>
          </div>
          {message ? <p className="text-xs leading-5 text-slate-400">{message}</p> : null}
        </div>
        <div className="min-h-52 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
          {asset ? (
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div>
                <p className="text-sm font-semibold text-white">{asset.title}</p>
                <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-slate-300">{asset.social_caption || asset.body_markdown}</p>
                {asset.metadata_json?.platformVariants ? <div className="mt-4 flex flex-wrap gap-1.5">{Object.keys(asset.metadata_json.platformVariants).map((key) => <span key={key} className="rounded-full border border-white/10 px-2 py-1 text-[0.58rem] uppercase text-slate-400">{key}</span>)}</div> : null}
              </div>
              {visualUrl ? <Image src={visualUrl} alt="Generated VestBlock content graphic draft" width={220} height={220} unoptimized className="h-44 w-44 rounded-xl object-cover" /> : null}
            </div>
          ) : <div className="flex min-h-44 items-center justify-center text-center text-xs leading-5 text-slate-500">Create one core asset. The studio stores platform variants, a graphic brief, video script, and shot list with the same factual claim set.</div>}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-[0.62rem] text-slate-500">
        <span>{cockpit.content.total} assets stored</span><span>•</span><span>{cockpit.content.drafts} drafts</span><span>•</span><span>{cockpit.content.published} published</span><span>•</span><span>Video rendering blocked until an approved provider is configured</span>
      </div>
    </Card>
  )
}

function GrowthArea({ cockpit, onChanged }: { cockpit: AutopilotCockpitSnapshot; onChanged: () => Promise<void> }) {
  const cards = [
    { title: "Outreach", icon: Send, href: "/admin/command-center", detail: "Approved campaigns, replies, suppression, and handoff." },
    { title: "SEO", icon: Search, href: "/admin/seo-opportunities", detail: `${cockpit.growth.seo.published} published assets; ${cockpit.growth.seo.refreshNeeded} refresh flags.` },
    { title: "PR", icon: Megaphone, href: "/admin/pr-engine", detail: `${cockpit.growth.pr.targets} targets; ${cockpit.growth.pr.approvedDrafts} approved drafts.` },
    { title: "Social", icon: Users, href: "/admin/command-center", detail: cockpit.providers.find((provider) => provider.key === "buffer")?.status === "ready" ? "Buffer is connected; every schedule or publish action still requires approval." : "Buffer is the selected distribution path; its existing account key is not stored in VestBlock yet." },
    { title: "ChatGPT Ads", icon: Target, href: "/admin/command-center", detail: cockpit.growth.advertising.chatgptAds.configured ? `Account review ${cockpit.growth.advertising.chatgptAds.reviewStatus || "pending"}; 30-day clicks ${cockpit.growth.advertising.chatgptAds.clicks ?? "unavailable"}. Spend changes require approval.` : "Advertiser onboarding is ready. VestBlock funding ads require OpenAI's financial-services review before launch." },
    { title: "Google Ads", icon: Megaphone, href: "/admin/command-center", detail: cockpit.growth.advertising.googleConfigured ? "Reporting connected; spend changes require approval." : "The account exists, but advertiser verification and reporting credentials still need completion." },
    { title: "Experiments", icon: Activity, href: "/admin/command-center", detail: `${cockpit.strategyMemory.experiments.length} recent measured records visible.` },
  ]
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <ContentStudio cockpit={cockpit} onChanged={onChanged} />
      {cards.map((card) => (
        <Link key={card.title} href={card.href} className="group rounded-2xl border border-white/10 bg-[#0b0d10]/90 p-5 transition hover:border-lime-300/20">
          <div className="flex items-center gap-3"><card.icon className="h-4 w-4 text-lime-200" /><h2 className="text-sm font-semibold text-white">{card.title}</h2><ArrowRight className="ml-auto h-4 w-4 text-slate-600 group-hover:text-lime-200" /></div>
          <p className="mt-3 text-xs leading-5 text-slate-400">{card.detail}</p>
        </Link>
      ))}
      <Card className="xl:col-span-2">
        <Heading icon={CalendarDays} title="Content calendar" hint="stored assets, not fake schedules" />
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {[...cockpit.content.latest].sort((a, b) => {
            if (a.scheduledFor && b.scheduledFor) return a.scheduledFor.localeCompare(b.scheduledFor)
            if (a.scheduledFor) return -1
            if (b.scheduledFor) return 1
            return b.createdAt.localeCompare(a.createdAt)
          }).map((item) => (
            <div key={item.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <span className={cn("rounded-full border px-2 py-0.5 text-[0.55rem] uppercase tracking-[0.1em]", statusTone(item.status))}>{item.status}</span>
              <p className="mt-3 line-clamp-2 text-xs font-semibold text-white">{item.title}</p>
              <p className="mt-2 text-[0.62rem] text-slate-500">{item.platform || item.contentType} · {item.scheduledFor ? `planned ${displayTime(item.scheduledFor)}` : `created ${displayTime(item.createdAt)}`}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function StrategyResultForm({ strategyId, campaignRunId, onChanged }: { strategyId: string; campaignRunId: string; onChanged: () => Promise<void> }) {
  const [values, setValues] = useState({ leads: 0, replies: 0, opportunities: 0, conversions: 0, revenue: 0 })
  const [lesson, setLesson] = useState("")
  const [nextIteration, setNextIteration] = useState("")
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState("")

  async function submit(event: FormEvent) {
    event.preventDefault()
    setWorking(true)
    setMessage("")
    try {
      const response = await fetch("/api/admin/autopilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intent: "record_result", strategyId, campaignRunId, ...values, lesson, nextIteration }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Unable to record the measured result.")
      setMessage("Measured result and next lesson saved to strategy memory.")
      await onChanged()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to record the measured result.")
    } finally {
      setWorking(false)
    }
  }

  return (
    <details className="mt-3 rounded-xl border border-white/[0.06] p-3">
      <summary className="cursor-pointer text-[0.68rem] font-medium text-slate-300">Record measured result</summary>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(Object.keys(values) as Array<keyof typeof values>).map((key) => (
            <label key={key} className="text-[0.58rem] uppercase tracking-[0.1em] text-slate-500">
              {key}
              <input type="number" min="0" step={key === "revenue" ? "0.01" : "1"} value={values[key]} onChange={(event) => setValues((current) => ({ ...current, [key]: Number(event.target.value) || 0 }))} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs text-white" />
            </label>
          ))}
        </div>
        <input value={lesson} onChange={(event) => setLesson(event.target.value)} minLength={3} maxLength={1500} required placeholder="What did the result teach us?" className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white" />
        <input value={nextIteration} onChange={(event) => setNextIteration(event.target.value)} minLength={3} maxLength={1500} required placeholder="What should change next?" className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white" />
        <button type="submit" disabled={working} className="inline-flex items-center gap-2 rounded-lg border border-lime-300/25 bg-lime-300/[0.08] px-3 py-2 text-xs font-semibold text-lime-100 disabled:opacity-50">{working ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}Save result</button>
        {message ? <p className="text-[0.65rem] text-slate-400">{message}</p> : null}
      </form>
    </details>
  )
}

function BrainArea({ cockpit, onChanged }: { cockpit: AutopilotCockpitSnapshot; onChanged: () => Promise<void> }) {
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [message, setMessage] = useState("")

  async function action(url: string, body: Record<string, unknown>, id: string) {
    setWorkingId(id)
    setMessage("")
    try {
      const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Unable to complete the action.")
      setMessage(body.intent === "generate_candidates" ? `${payload.created?.length || 0} new evidence-based candidate strategies created.` : "Action completed.")
      await onChanged()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to complete the action.")
    } finally {
      setWorkingId(null)
    }
  }

  async function review(id: string, reviewAction: "approve" | "reject") {
    setWorkingId(id)
    setMessage("")
    try {
      const response = await fetch(`/api/admin/improvement/strategy-updates/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: reviewAction }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Unable to review the strategy.")
      setMessage(`Strategy ${reviewAction === "approve" ? "approved" : "rejected"}.`)
      await onChanged()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to review the strategy.")
    } finally {
      setWorkingId(null)
    }
  }

  return (
    <div className="space-y-5">
      <Card className="border-lime-300/20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><Heading icon={Brain} title="VestBlock Strategy Engine" hint="observe → propose → test → learn" /><p className="mt-3 max-w-2xl text-xs leading-5 text-slate-400">Candidate strategies are built from the current Command Center, content, pipeline, and experiment records. Every score exposes its inputs and formula.</p></div>
          <button type="button" onClick={() => void action("/api/admin/autopilot", { intent: "generate_candidates" }, "generate")} disabled={Boolean(workingId)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-lime-300 px-4 py-2.5 text-xs font-semibold text-black disabled:opacity-50">{workingId === "generate" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}Generate weekly candidates</button>
        </div>
        {message ? <p className="mt-3 text-xs text-slate-400">{message}</p> : null}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {cockpit.strategyMemory.recent.length ? cockpit.strategyMemory.recent.map((item) => (
          <Card key={item.id}>
            <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-white">{item.title}</p><p className="mt-1 text-[0.65rem] uppercase tracking-[0.12em] text-slate-500">{item.strategy?.vertical.replaceAll("_", " ") || "strategy"}</p></div><span className={cn("rounded-full border px-2 py-0.5 text-[0.55rem] uppercase tracking-[0.1em]", statusTone(item.approvalStatus))}>{item.approvalStatus.replaceAll("_", " ")}</span></div>
            {item.strategy ? <><p className="mt-4 text-xs leading-5 text-slate-300">{item.strategy.hypothesis}</p><div className="mt-4 grid grid-cols-3 gap-2"><Metric label="Score" value={item.strategy.score.total} /><Metric label="Confidence" value={`${item.strategy.confidence}%`} /><Metric label="Risk" value={item.strategy.risk} /></div><details className="mt-3 rounded-xl border border-white/[0.06] p-3"><summary className="cursor-pointer text-[0.68rem] font-medium text-slate-300">Evidence and scoring</summary><ul className="mt-3 space-y-1 text-[0.65rem] leading-5 text-slate-500">{item.strategy.evidence.map((evidence) => <li key={`${evidence.source}:${evidence.metric}`}>• {evidence.metric}: {String(evidence.value ?? "not recorded")} · {evidence.source} · {evidence.quality}</li>)}</ul><p className="mt-2 text-[0.6rem] leading-4 text-slate-600">{item.strategy.score.formula}</p></details></> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {item.approvalStatus === "queued" ? <><button type="button" onClick={() => void review(item.id, "approve")} disabled={workingId === item.id} className="inline-flex items-center gap-1.5 rounded-lg bg-lime-300 px-3 py-2 text-xs font-semibold text-black disabled:opacity-50"><Check className="h-3.5 w-3.5" />Approve</button><button type="button" onClick={() => void review(item.id, "reject")} disabled={workingId === item.id} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 disabled:opacity-50">Dismiss</button></> : null}
              {["approved", "auto_applied"].includes(item.approvalStatus) ? <button type="button" onClick={() => void action("/api/admin/autopilot", { intent: "create_campaign", strategyId: item.id }, item.id)} disabled={workingId === item.id} className="inline-flex items-center gap-1.5 rounded-lg border border-lime-300/25 bg-lime-300/[0.08] px-3 py-2 text-xs font-semibold text-lime-100 disabled:opacity-50"><Rocket className="h-3.5 w-3.5" />Build campaign</button> : null}
            </div>
            {item.campaignRunId ? <StrategyResultForm strategyId={item.id} campaignRunId={item.campaignRunId} onChanged={onChanged} /> : null}
          </Card>
        )) : <Card className="xl:col-span-2"><p className="text-sm text-slate-400">No structured Autopilot strategy exists yet. Generate the first candidates from the live operating snapshot.</p></Card>}
      </div>

      <Card>
        <Heading icon={ShieldCheck} title="Autonomy controls" hint="visible by system" />
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {cockpit.autonomy.map((policy) => (
            <div key={policy.key} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-white">{policy.label}</p><span className={cn("rounded-full border px-2 py-0.5 text-[0.52rem] uppercase tracking-[0.1em]", statusTone(policy.mode === "auto" ? "ready" : policy.mode))}>{policy.mode}</span></div>
              <p className="mt-2 text-[0.65rem] leading-5 text-slate-500">{policy.guardrail}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <Heading icon={Activity} title="Strategy → campaign → result memory" hint="measured history" />
        <div className="mt-4 space-y-2">
          {cockpit.strategyMemory.experiments.slice(0, 8).map((item) => (
            <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-slate-200">{item.key}</p><p className="mt-1 text-[0.62rem] text-slate-500">{item.category} · {displayTime(item.createdAt)}</p></div>
              <div className="flex flex-wrap gap-2">{Object.entries(item.metrics).slice(0, 4).map(([key, value]) => <span key={key} className="rounded-md bg-white/[0.04] px-2 py-1 text-[0.58rem] text-slate-400">{key}: {String(value)}</span>)}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function SystemArea({ initialData: data, initialCockpit: cockpit, initialBossBriefing }: Props) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {cockpit.providers.map((provider) => (
          <Card key={provider.key}>
            <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-white">{provider.label}</p><span className={cn("rounded-full border px-2 py-0.5 text-[0.52rem] uppercase tracking-[0.1em]", statusTone(provider.status))}>{provider.status}</span></div>
            <p className="mt-3 text-[0.65rem] leading-5 text-slate-500">{provider.detail}</p>
            <p className="mt-3 vb-mono text-[0.55rem] uppercase tracking-[0.12em] text-slate-600">Mode: {provider.mode}</p>
          </Card>
        ))}
      </div>
      <Card>
        <Heading icon={Settings} title="Automation and infrastructure" hint="technical controls live here" />
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="Registered" value={data.revenueEngine.automation.inventoryTotal} />
          <Metric label="Active" value={data.revenueEngine.automation.active} />
          <Metric label="Blocked" value={data.revenueEngine.automation.blocked} />
          <Metric label="Attention" value={data.revenueEngine.automation.attention} />
          <Metric label="Data issues" value={data.dataSourceIssues.length} />
        </div>
      </Card>
      <details className="rounded-2xl border border-white/10 bg-[#080a0d]">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-white">Open detailed operations console</summary>
        <div className="border-t border-white/[0.06] p-3 sm:p-5">
          <CommandCenterClient initialData={data} initialBossBriefing={initialBossBriefing} />
        </div>
      </details>
    </div>
  )
}

export function FounderCockpit({ initialData, initialCockpit, initialBossBriefing }: Props) {
  const [area, setArea] = useState<FounderArea>("today")
  const [data, setData] = useState(initialData)
  const [cockpit, setCockpit] = useState(initialCockpit)
  const [refreshing, setRefreshing] = useState(false)

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning."
    if (hour < 18) return "Good afternoon."
    return "Good evening."
  }, [])

  async function refresh() {
    setRefreshing(true)
    try {
      const response = await fetch("/api/admin/autopilot", { cache: "no-store" })
      if (!response.ok) return
      const payload = await response.json()
      setData(payload.data)
      setCockpit(payload.cockpit)
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#050607] px-3 py-4 text-white sm:px-5 lg:px-7">
      <div className="mx-auto w-full max-w-[1600px] space-y-5">
        <header className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(196,255,32,0.08),transparent_35%),#0a0c0f] p-5 sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex items-start gap-4">
              <BrandMark className="h-12 w-12 shrink-0" />
              <div><p className="vb-mono text-[0.58rem] uppercase tracking-[0.2em] text-lime-200">VestBlock decision cockpit</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{greeting}</h1><p className="mt-2 max-w-2xl text-sm text-slate-400">See what needs you, where money is closest, what AI is doing, and what the data says to do next.</p></div>
            </div>
            <button type="button" onClick={() => void refresh()} disabled={refreshing} className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300 hover:border-lime-300/20 disabled:opacity-50"><RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />Refresh live data</button>
          </div>
        </header>

        <Tabs value={area} onValueChange={(value) => setArea(value as FounderArea)}>
          <TabsList className="grid h-auto w-full grid-cols-5 rounded-2xl border border-white/10 bg-[#0b0d10] p-1">
            {(Object.keys(areaCopy) as FounderArea[]).map((key) => {
              const item = areaCopy[key]
              return <TabsTrigger key={key} value={key} className="rounded-xl px-2 py-3 text-[0.65rem] data-[state=active]:bg-lime-300 data-[state=active]:text-black sm:text-xs"><item.icon className="mr-1.5 h-3.5 w-3.5" />{item.label}</TabsTrigger>
            })}
          </TabsList>
          <TabsContent value="today" className="mt-5"><TodayArea data={data} cockpit={cockpit} onNavigate={setArea} /></TabsContent>
          <TabsContent value="pipeline" className="mt-5"><PipelineArea data={data} /></TabsContent>
          <TabsContent value="growth" className="mt-5"><GrowthArea cockpit={cockpit} onChanged={refresh} /></TabsContent>
          <TabsContent value="brain" className="mt-5"><BrainArea cockpit={cockpit} onChanged={refresh} /></TabsContent>
          <TabsContent value="system" className="mt-5"><SystemArea initialData={data} initialCockpit={cockpit} initialBossBriefing={initialBossBriefing} /></TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
