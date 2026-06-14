"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Bot, Loader2, Orbit, SendHorizontal, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { CommandCenterData } from "@/lib/admin/commandCenter"
import type { CommandCenterModeKey } from "./command-center-command-deck"

type CopilotMessage = {
  id: string
  role: "assistant" | "user"
  content: string
  suggestedCommands?: string[]
}

type CopilotResponse = {
  message: string
  suggestedCommands?: string[]
  source?: "openai" | "fallback"
}

const MODE_LABELS: Record<CommandCenterModeKey, string> = {
  acquire: "Acquire",
  analyze: "Analyze",
  route: "Route",
  outreach: "Outreach",
  capital: "Capital",
  authority: "Authority",
}

function readQueueCount(data: CommandCenterData, label: string) {
  return data.routingQueue.find((item) => item.label === label)?.count ?? 0
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

function buildBoardBrief(data: CommandCenterData, mode: CommandCenterModeKey, focusAgentName?: string) {
  const sendReady =
    data.outreachQueues.flatMap((queue) => queue.kpis).find((kpi) => kpi.label.toLowerCase() === "send-ready")?.value ?? 0
  const hotReplies = data.inbox.sections.find((section) => section.key === "hot_replies")?.items.length ?? 0
  const leadFollowUps = readQueueCount(data, "Lead follow-ups due")
  const buyerMatches = readQueueCount(data, "Buyer matches open")
  const lenderMatches = readQueueCount(data, "Lender matches open")
  const topMarket = data.marketHeat[0]?.market || "the top market"
  const topAlert = data.alerts[0]?.message

  switch (mode) {
    case "acquire":
      return `I’m watching fresh inflow, partner discovery, and ${topMarket}. ${pluralize(
        data.summary.newLeads24h,
        "new lead"
      )} landed in the last 24 hours and ${pluralize(
        data.summary.partnerDiscoveryRuns7d,
        "discovery run"
      )} hit in the last week.`
    case "analyze":
      return `I’m ready to underwrite the next address. ${pluralize(
        buyerMatches,
        "buyer match"
      )} and ${pluralize(lenderMatches, "lender match")} are open, so a strong analysis can move both routing and capital.`
    case "route":
      return `I’m watching fit and momentum across buyers, lenders, and builders. ${pluralize(
        buyerMatches,
        "buyer match"
      )} and ${pluralize(lenderMatches, "lender match")} are still live on the board.`
    case "outreach":
      return `I’m sitting in the reply lane with you. ${pluralize(
        Number(sendReady) || 0,
        "send-ready message"
      )}, ${pluralize(hotReplies, "hot reply")}, and ${pluralize(leadFollowUps, "seller follow-up")} are the pressure points right now.`
    case "capital":
      return `I’m watching lender-fit and packaging quality. ${pluralize(
        lenderMatches,
        "lender match"
      )} are still open and ${pluralize(data.summary.partnerBuyBoxesConfirmed, "confirmed buy box")} can be routed now.`
    case "authority":
    default:
      return `I’m watching visibility, trust, and the operator layer behind the scenes. ${pluralize(
        data.summary.partnerDiscoveryRuns7d,
        "research-driven discovery run"
      )} and ${pluralize(data.summary.replySignals7d, "reply signal")} are on the board. ${topAlert ? `Top friction: ${topAlert}` : ""}`.trim()
  }
}

function buildSignalCards(data: CommandCenterData, mode: CommandCenterModeKey) {
  const hotReplies = data.inbox.sections.find((section) => section.key === "hot_replies")?.items.length ?? 0
  const partnerReplies = data.inbox.sections.find((section) => section.key === "partner_replies")?.items.length ?? 0
  const sendReady =
    data.outreachQueues.flatMap((queue) => queue.kpis).find((kpi) => kpi.label.toLowerCase() === "send-ready")?.value ?? 0

  switch (mode) {
    case "acquire":
      return [
        { label: "New leads 24h", value: data.summary.newLeads24h, helper: "seller inflow" },
        { label: "Discovery 7d", value: data.summary.partnerDiscoveryRuns7d, helper: "partner sourcing" },
        { label: "Top market", value: data.marketHeat[0]?.market || "—", helper: "highest heat" },
      ]
    case "analyze":
      return [
        { label: "Buyer matches", value: readQueueCount(data, "Buyer matches open"), helper: "need fit checks" },
        { label: "Lender matches", value: readQueueCount(data, "Lender matches open"), helper: "need packaging" },
        { label: "Buy boxes", value: data.summary.partnerBuyBoxesConfirmed, helper: "confirmed criteria" },
      ]
    case "route":
      return [
        { label: "Buyer routes", value: readQueueCount(data, "Buyer matches open"), helper: "open" },
        { label: "Capital routes", value: readQueueCount(data, "Lender matches open"), helper: "open" },
        { label: "DM aligned", value: data.summary.dealMachineAlignedPartners, helper: "partner overlap" },
      ]
    case "outreach":
      return [
        { label: "Send ready", value: sendReady, helper: "approved now" },
        { label: "Hot replies", value: hotReplies, helper: "seller-side" },
        { label: "Partner replies", value: partnerReplies, helper: "buyer/lender" },
      ]
    case "capital":
      return [
        { label: "Lender matches", value: readQueueCount(data, "Lender matches open"), helper: "still live" },
        { label: "Criteria ready", value: data.summary.partnerBuyBoxesConfirmed, helper: "confirmed boxes" },
        { label: "Outreach ready", value: data.summary.partnerOutreachReady, helper: "ready to move" },
      ]
    case "authority":
    default:
      return [
        { label: "Reply signals", value: data.summary.replySignals7d, helper: "7-day movement" },
        { label: "Authority tasks", value: data.priorities.length, helper: "tracked priorities" },
        { label: "Top market", value: data.marketHeat[0]?.market || "—", helper: "where heat is strongest" },
      ]
  }
}

function buildQuickPrompts(data: CommandCenterData, mode: CommandCenterModeKey) {
  const topMarket = data.marketHeat[0]?.market || "Milwaukee"

  switch (mode) {
    case "acquire":
      return [
        "What acquisition move should we run next?",
        `launch seller outreach in ${topMarket}`,
        `find builders in ${topMarket}`,
      ]
    case "analyze":
      return [
        "What analysis should I run next?",
        "How should I structure the next deal?",
        "show lender matches",
      ]
    case "route":
      return [
        "Which routing lane is most valuable right now?",
        "show buyer matches",
        `find builders in ${topMarket}`,
      ]
    case "outreach":
      return [
        "What needs me first in outreach?",
        "open inbox command",
        `launch seller outreach in ${topMarket}`,
      ]
    case "capital":
      return [
        "Where is capital getting stuck?",
        "show lender matches",
        "launch lender outreach",
      ]
    case "authority":
    default:
      return [
        "What strategy should we push next?",
        "boss strategy engine",
        `find builders in ${topMarket}`,
      ]
  }
}

export function CommandCenterCopilotPanel({
  data,
  activeMode,
  focusAgentName,
  onRunCommand,
  seed,
}: {
  data: CommandCenterData
  activeMode: CommandCenterModeKey
  focusAgentName?: string
  onRunCommand: (command: string) => void
  seed?: { id: number; prompt: string; autoSubmit?: boolean } | null
}) {
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const handledSeedRef = useRef<number | null>(null)
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: "copilot-welcome",
      role: "assistant",
      content:
        "I’m in the command center with you now. Ask me what needs attention, which strategy to run next, or let me push you straight into analysis, outreach, routing, or capital work.",
    },
  ])

  const boardBrief = useMemo(() => buildBoardBrief(data, activeMode, focusAgentName), [activeMode, data, focusAgentName])
  const signalCards = useMemo(() => buildSignalCards(data, activeMode), [activeMode, data])
  const quickPrompts = useMemo(() => buildQuickPrompts(data, activeMode), [activeMode, data])

  const askCopilot = useCallback(async (raw: string) => {
    const query = raw.trim()
    if (!query || loading) return

    const userMessage: CopilotMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
    }

    setMessages((current) => [...current, userMessage])
    setInput("")
    setLoading(true)

    try {
      const response = await fetch("/api/admin/command-center/copilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query,
          mode: activeMode,
          focusAgent: focusAgentName,
        }),
      })

      const payload = (await response.json().catch(() => null)) as CopilotResponse | { error?: string } | null
      if (!response.ok) {
        throw new Error(payload && "error" in payload ? payload.error || "Codex could not answer from the board." : "Codex could not answer from the board.")
      }

      const copilotResponse = payload as CopilotResponse
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: copilotResponse.message,
          suggestedCommands: copilotResponse.suggestedCommands?.slice(0, 3),
        },
      ])
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "I hit a wall trying to read the board. Try again in a moment.",
        },
      ])
    } finally {
      setLoading(false)
    }
  }, [activeMode, focusAgentName, loading])

  useEffect(() => {
    if (!seed?.prompt || handledSeedRef.current === seed.id) return
    handledSeedRef.current = seed.id
    if (seed.autoSubmit) {
      void askCopilot(seed.prompt)
      return
    }
    setInput(seed.prompt)
  }, [askCopilot, seed])

  return (
    <section id="codex-console-panel" className="space-y-5">
      <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/20 bg-slate-950/70 text-cyan-100">
              <Bot className="h-5 w-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-white">Codex console</h2>
                <span className="vb-mono rounded-full border border-cyan-300/20 bg-cyan-300/[0.08] px-2 py-0.5 text-[0.58rem] uppercase tracking-[0.18em] text-cyan-100">
                  {MODE_LABELS[activeMode]} mode
                </span>
                {focusAgentName ? (
                  <span className="vb-mono rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[0.58rem] uppercase tracking-[0.18em] text-slate-300">
                    {focusAgentName}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-cyan-50/90">{boardBrief}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-[0.65rem] font-medium text-slate-200">
            <Orbit className="h-3.5 w-3.5 text-cyan-200" />
            Embedded operator
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {signalCards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-white/[0.08] bg-slate-950/55 px-3 py-3">
              <p className="vb-mono text-[0.58rem] uppercase tracking-[0.16em] text-slate-500">{card.label}</p>
              <p className="mt-1 text-lg font-semibold text-white">{card.value}</p>
              <p className="mt-0.5 text-[0.68rem] text-slate-500">{card.helper}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-200" />
              <p className="text-sm font-semibold text-white">Talk to Codex</p>
            </div>
            <p className="vb-mono text-[0.58rem] uppercase tracking-[0.16em] text-slate-500">board-aware answers</p>
          </div>

          <ScrollArea className="mt-4 h-[360px] rounded-2xl border border-white/[0.06] bg-slate-950/55">
            <div className="space-y-3 p-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "rounded-2xl border px-3 py-3",
                    message.role === "assistant"
                      ? "border-cyan-300/15 bg-cyan-300/[0.07]"
                      : "border-white/[0.08] bg-white/[0.04]"
                  )}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className={cn(
                        "vb-mono rounded-full px-2 py-0.5 text-[0.55rem] uppercase tracking-[0.18em]",
                        message.role === "assistant"
                          ? "bg-slate-950/70 text-cyan-100"
                          : "bg-slate-950/70 text-slate-300"
                      )}
                    >
                      {message.role === "assistant" ? "Codex" : "You"}
                    </span>
                  </div>
                  <p className="whitespace-pre-line text-sm leading-6 text-slate-100">{message.content}</p>

                  {message.suggestedCommands?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {message.suggestedCommands.map((command) => (
                        <button
                          key={command}
                          type="button"
                          onClick={() => onRunCommand(command)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/20 bg-slate-950/65 px-3 py-1.5 text-[0.68rem] font-medium text-cyan-100 transition-colors hover:border-cyan-200/45 hover:text-white"
                        >
                          <SendHorizontal className="h-3 w-3" />
                          {command}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}

              {loading ? (
                <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06] px-3 py-3 text-sm text-cyan-50">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Reading the board and lining up the next move...
                  </span>
                </div>
              ) : null}
            </div>
          </ScrollArea>

          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void askCopilot(prompt)}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[0.7rem] text-slate-300 transition-colors hover:border-cyan-300/30 hover:text-white"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-slate-950/55 p-3">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    void askCopilot(input)
                  }
                }}
                placeholder="Ask what matters now, which strategy to run next, or where the board is getting stuck."
                className="min-h-[96px] resize-none border-0 bg-transparent px-0 py-0 text-sm text-white shadow-none focus-visible:ring-0"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-[0.68rem] text-slate-500">Enter sends. Shift+Enter keeps writing.</p>
                <Button
                  type="button"
                  onClick={() => void askCopilot(input)}
                  disabled={loading || !input.trim()}
                  className="bg-cyan-400 text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SendHorizontal className="mr-2 h-4 w-4" />}
                  Ask Codex
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
            <div className="flex items-center gap-2">
              <Orbit className="h-4 w-4 text-cyan-200" />
              <p className="text-sm font-semibold text-white">What I can do from here</p>
            </div>
            <div className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
              <p>I can read the live board and tell you what matters now.</p>
              <p>I can push you straight into analysis, outreach, routing, and strategy without the page-hopping.</p>
              <p>I can keep sharpening the next move instead of leaving you with a dead-end answer.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-200" />
              <p className="text-sm font-semibold text-white">Fast lanes</p>
            </div>
            <div className="mt-3 space-y-2">
              {buildQuickPrompts(data, activeMode).map((command) => (
                <button
                  key={command}
                  type="button"
                  onClick={() => onRunCommand(command)}
                  className="flex w-full items-center justify-between rounded-2xl border border-white/[0.06] bg-slate-950/55 px-3 py-3 text-left text-sm text-slate-200 transition-colors hover:border-cyan-300/30 hover:text-white"
                >
                  <span>{command}</span>
                  <SendHorizontal className="h-3.5 w-3.5 opacity-70" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
