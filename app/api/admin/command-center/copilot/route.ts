export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { checkAdminAccess } from "@/lib/auth/admin"
import {
  buildAgentInfrastructureBrief,
  buildAgentInfrastructureContext,
  isAgentInfrastructureQuery,
} from "@/lib/admin/agentInfrastructure"
import { getCommandCenterData, type CommandCenterData } from "@/lib/admin/commandCenter"
import { getOpenAIClient } from "@/lib/openai-server"
import { COMMAND_CENTER_SELF_IMPROVING_SYSTEM_PROMPT } from "@/lib/admin/selfImprovement"

const copilotRequestSchema = z.object({
  query: z.string().trim().min(1).max(1200),
  mode: z.enum(["acquire", "analyze", "route", "outreach", "capital", "authority"]),
  focusAgent: z.string().trim().max(120).optional(),
})

const MODE_LABELS = {
  acquire: "Acquire",
  analyze: "Analyze",
  route: "Route",
  outreach: "Outreach",
  capital: "Capital",
  authority: "Authority",
} as const

function readQueueCount(data: CommandCenterData, label: string) {
  return data.routingQueue.find((item) => item.label === label)?.count ?? 0
}

function buildSuggestedCommands(data: CommandCenterData, mode: z.infer<typeof copilotRequestSchema>["mode"]) {
  const topMarket = data.marketHeat[0]?.market || "Milwaukee"

  switch (mode) {
    case "acquire":
      return [
        "run daily strategy lab",
        `launch seller outreach in ${topMarket}`,
        `find builders in ${topMarket}`,
      ]
    case "analyze":
      return [
        "analyze 3425 n 11th st",
        "show buyer matches",
        "show lender matches",
      ]
    case "route":
      return [
        "show buyer matches",
        "show lender matches",
        `find builders in ${topMarket}`,
      ]
    case "outreach":
      return [
        "run daily strategy lab",
        "open inbox command",
        "open outreach command",
      ]
    case "capital":
      return [
        "show lender matches",
        "launch lender outreach",
        "analyze 3425 n 11th st",
      ]
    case "authority":
    default:
      return [
        "run daily strategy lab",
        "boss strategy engine",
        `find builders in ${topMarket}`,
      ]
  }
}

function buildSnapshot(data: CommandCenterData, mode: z.infer<typeof copilotRequestSchema>["mode"], focusAgent?: string) {
  const hotReplies = data.inbox.sections.find((section) => section.key === "hot_replies")?.items.length ?? 0
  const partnerReplies = data.inbox.sections.find((section) => section.key === "partner_replies")?.items.length ?? 0
  const staleThreads = data.inbox.sections.find((section) => section.key === "stale_threads")?.items.length ?? 0
  const topAlerts = data.alerts
    .slice(0, 3)
    .map((alert) => `${alert.severity.toUpperCase()}: ${alert.message}`)
    .join("\n")
  const topTasks = data.overdueTasks
    .slice(0, 3)
    .map((task) => `${task.priority.toUpperCase()}: ${task.title} — ${task.detail}`)
    .join("\n")
  const topMarkets = data.marketHeat
    .slice(0, 3)
    .map(
      (market) =>
        `${market.market}: ${market.leads} leads, ${market.contactable} contactable, ${market.replied} replied, heat ${market.heat}`
    )
    .join("\n")
  const outreachQueues = data.outreachQueues
    .map((queue) => {
      const headline = queue.kpis
        .slice(0, 3)
        .map((kpi) => `${kpi.label} ${kpi.value}`)
        .join(", ")
      return `${queue.title}: ${headline}`
    })
    .join("\n")
  const routingSummary = data.routingQueue.map((item) => `${item.label}: ${item.count}`).join("\n")

  return [
    `Mode: ${MODE_LABELS[mode]}`,
    focusAgent ? `Focus lane: ${focusAgent}` : null,
    `Summary:
- new leads 24h: ${data.summary.newLeads24h}
- outreach 24h: ${data.summary.outreach24h} / ${data.summary.outreachTarget}
- reply signals 7d: ${data.summary.replySignals7d}
- urgent tasks: ${data.summary.urgentTasks}
- active partners: ${data.summary.activePartners}
- builder partners: ${data.summary.builderPartners}
- research-ready partners: ${data.summary.partnerResearchReady}
- outreach-ready partners: ${data.summary.partnerOutreachReady}
- confirmed buy boxes: ${data.summary.partnerBuyBoxesConfirmed}`,
    `Inbox:
- hot seller replies: ${hotReplies}
- partner replies: ${partnerReplies}
- stale threads: ${staleThreads}`,
    `Routing:
- buyer matches open: ${readQueueCount(data, "Buyer matches open")}
- lender matches open: ${readQueueCount(data, "Lender matches open")}
- lead follow-ups due: ${readQueueCount(data, "Lead follow-ups due")}
- partner follow-ups due: ${readQueueCount(data, "Partner follow-ups due")}
- research checklists open: ${readQueueCount(data, "Research checklists open")}`,
    topAlerts ? `Alerts:\n${topAlerts}` : "Alerts:\nNone",
    topTasks ? `Overdue tasks:\n${topTasks}` : "Overdue tasks:\nNone",
    `Outreach queues:\n${outreachQueues}`,
    `Market heat:\n${topMarkets}`,
    `Routing board:\n${routingSummary}`,
  ]
    .filter(Boolean)
    .join("\n\n")
}

function buildFallbackResponse(
  data: CommandCenterData,
  query: string,
  mode: z.infer<typeof copilotRequestSchema>["mode"],
  focusAgent?: string
) {
  const lower = query.toLowerCase()
  const sendReady =
    data.outreachQueues.flatMap((queue) => queue.kpis).find((kpi) => kpi.label.toLowerCase() === "send-ready")?.value ?? 0
  const buyerMatches = readQueueCount(data, "Buyer matches open")
  const lenderMatches = readQueueCount(data, "Lender matches open")
  const leadFollowUps = readQueueCount(data, "Lead follow-ups due")
  const partnerFollowUps = readQueueCount(data, "Partner follow-ups due")
  const topMarket = data.marketHeat[0]?.market || "the top active market"
  const topAlert = data.alerts[0]?.message
  const topTask = data.overdueTasks[0]

  if (isAgentInfrastructureQuery(query)) {
    return buildAgentInfrastructureBrief()
  }

  if (lower.includes("outreach") || lower.includes("reply") || lower.includes("inbox")) {
    return [
      `I’m looking at the live outreach pressure first.`,
      `${sendReady} messages are send-ready, ${leadFollowUps} seller follow-up${leadFollowUps === 1 ? "" : "s"} are due, and ${partnerFollowUps} partner follow-up${partnerFollowUps === 1 ? "" : "s"} are due.`,
      topAlert ? `The biggest blocker on the board is: ${topAlert}` : `The cleanest next move is to work the hottest live reply or launch the next seller push in ${topMarket}.`,
    ].join(" ")
  }

  if (lower.includes("analy") || lower.includes("underwrit") || lower.includes("deal")) {
    return [
      `I’m in analysis mode.`,
      `${buyerMatches} buyer match${buyerMatches === 1 ? "" : "es"} and ${lenderMatches} lender match${lenderMatches === 1 ? "" : "es"} are open, so the smartest use of the analyzer is a property that can move both routing and capital forward.`,
      `If you already have an address, run it from Property Command and I’ll help you decide between fast cash, creative, builder, and lender paths.`,
    ].join(" ")
  }

  if (lower.includes("strategy") || lower.includes("play") || lower.includes("next")) {
    return [
      `If we’re optimizing for the next revenue move, I’d bias toward the lane with the most live pressure.`,
      mode === "outreach"
        ? `That means inbox and outreach first: clear the due follow-ups, then launch the next seller wave in ${topMarket}.`
        : `Right now the best tactical swing is to work ${buyerMatches > lenderMatches ? "buyer routing" : "lender routing"} and keep ${topMarket} as the strongest market signal.`,
      topTask ? `The overdue task with the most immediate drag is "${topTask.title}".` : `There isn’t a single overdue task dominating the board right now.`,
    ].join(" ")
  }

  if (lower.includes("risk") || lower.includes("block") || lower.includes("problem")) {
    return [
      topAlert ? `The biggest visible blocker is: ${topAlert}.` : `There is no single critical alert at the top of the board right now.`,
      topTask ? `The task most likely to slow us down next is "${topTask.title}" with ${topTask.priority} priority.` : `The overdue task board is relatively clear.`,
      focusAgent ? `I’d keep an eye on the ${focusAgent} lane while you clear the blocker.` : `I’d clear the blocker before adding more outbound volume.`,
    ].join(" ")
  }

  return [
    `I’m reading the command center as an operator, not a dashboard.`,
    `Mode ${MODE_LABELS[mode]} is carrying ${data.summary.newLeads24h} new leads in 24 hours, ${data.summary.outreach24h} outreach touches in 24 hours, and ${data.summary.replySignals7d} reply signals in 7 days.`,
    topAlert
      ? `The board’s sharpest issue is "${topAlert}".`
      : `The board is clear enough to keep pushing the highest-yield lane.`,
    `If you want speed, I’d work ${mode === "outreach" ? "the inbox and outreach queue" : mode === "analyze" ? "Property Command next" : `the strongest market signal in ${topMarket}`}.`,
  ].join(" ")
}

export async function POST(request: NextRequest) {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 })
  }

  try {
    const json = await request.json()
    const parsed = copilotRequestSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid copilot request.", details: parsed.error.flatten() }, { status: 400 })
    }

    const { query, mode, focusAgent } = parsed.data
    const data = await getCommandCenterData()
    const suggestedCommands = buildSuggestedCommands(data, mode)
    const fallback = buildFallbackResponse(data, query, mode, focusAgent)
    const openai = getOpenAIClient()
    const agentInfrastructureContext = isAgentInfrastructureQuery(query)
      ? `\n\nCurated agent infrastructure review:\n${buildAgentInfrastructureContext()}`
      : ""

    if (!openai) {
      return NextResponse.json({
        message: fallback,
        suggestedCommands,
        source: "fallback",
      })
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: [
            COMMAND_CENTER_SELF_IMPROVING_SYSTEM_PROMPT,
            "You are Codex embedded inside VestBlock's admin command center.",
            "Act like a sharp acquisitions and operations copilot.",
            "Ground every answer in the board data you are given.",
            "Be concise, specific, and action-first.",
            "Prefer exact counts, queues, and markets when they help.",
            "No hype, no generic AI framing, no long preambles.",
            "Do not recommend installing broad agent runtimes unless the curated VestBlock review says to.",
            "Keep the answer under 170 words and make it feel like an operator brief.",
          ].join(" "),
        },
        {
          role: "user",
          content: `Operator question: ${query}\n\n${buildSnapshot(data, mode, focusAgent)}${agentInfrastructureContext}`,
        },
      ],
    })

    const message = completion.choices[0]?.message?.content?.trim() || fallback

    return NextResponse.json({
      message,
      suggestedCommands,
      source: "openai",
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load command center copilot.",
      },
      { status: 500 }
    )
  }
}
