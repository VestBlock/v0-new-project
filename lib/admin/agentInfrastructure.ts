export type AgentInfrastructureDecision = "adopt-patterns" | "pilot-later" | "skip-runtime"

export type AgentInfrastructureCandidate = {
  key: string
  name: string
  url: string
  decision: AgentInfrastructureDecision
  fit: "high" | "medium" | "low"
  installNow: boolean
  bestUse: string
  why: string
  guardrail: string
}

export const AGENT_INFRASTRUCTURE_CANDIDATES: AgentInfrastructureCandidate[] = [
  {
    key: "mcp",
    name: "MCP servers",
    url: "https://modelcontextprotocol.io/",
    decision: "adopt-patterns",
    fit: "high",
    installNow: false,
    bestUse:
      "Standardize controlled access to Supabase, GitHub, Outlook, browser research, and future property-data tools.",
    why:
      "This is the cleanest direction for VestBlock because it expands tool access without creating another command center or another agent family.",
    guardrail:
      "Use least-privilege, audited connectors. Prefer read-only first, require approval for email, contract, database writes, and spend-bearing actions.",
  },
  {
    key: "langgraph",
    name: "LangGraph / LangGraph.js",
    url: "https://github.com/langchain-ai/langgraph",
    decision: "pilot-later",
    fit: "high",
    installNow: false,
    bestUse:
      "Durable routing workflows when seller lead -> analyze -> route -> offer -> follow-up becomes too complex for simple TypeScript orchestration.",
    why:
      "It is strong for long-running, stateful, human-in-the-loop workflows, but VestBlock already has a workable boss/play/task layer.",
    guardrail:
      "Pilot one bounded flow first, such as seller reply triage or deal-routing state transitions. Do not rewrite the command center around it.",
  },
  {
    key: "crewai",
    name: "CrewAI",
    url: "https://github.com/crewAIInc/crewAI",
    decision: "adopt-patterns",
    fit: "medium",
    installNow: false,
    bestUse:
      "Borrow role decomposition and crew-style handoff language for acquisition, underwriting, routing, outreach, and capital plays.",
    why:
      "Its role-based model matches the VestBlock mental model, but the current app is TypeScript/Next and already has agent lanes.",
    guardrail:
      "Do not add a separate Python crew runtime unless a specific offline research job needs it and has clear output contracts.",
  },
  {
    key: "openhands",
    name: "OpenHands",
    url: "https://github.com/OpenHands/OpenHands",
    decision: "pilot-later",
    fit: "medium",
    installNow: false,
    bestUse:
      "External development worker for contained engineering chores, scrapers, tests, and issue-to-PR automation.",
    why:
      "It is useful as an engineering assistant, not as VestBlock product infrastructure. Codex already covers the live build loop here.",
    guardrail:
      "Run outside production with restricted repo permissions. Never give it live outreach, mailbox, payment, or production database write access by default.",
  },
  {
    key: "openmanus",
    name: "OpenManus",
    url: "https://github.com/FoundationAgents/OpenManus",
    decision: "skip-runtime",
    fit: "low",
    installNow: false,
    bestUse:
      "Reference general multi-step agent patterns only.",
    why:
      "It is broad and prototype-oriented. VestBlock needs narrow, auditable revenue workflows more than a general agent shell.",
    guardrail:
      "Do not introduce it unless it clearly beats existing TypeScript workflows for a specific isolated process.",
  },
  {
    key: "openclaw",
    name: "OpenClaw",
    url: "https://github.com/openclaw/openclaw",
    decision: "skip-runtime",
    fit: "low",
    installNow: false,
    bestUse:
      "Borrow the always-on assistant and canvas-control idea, not the broad local-device agent runtime.",
    why:
      "It overlaps heavily with what VestBlock now has: Outlook monitoring, Codex console, browser control, automations, and command-center canvas.",
    guardrail:
      "Avoid broad email/browser/file permissions in one autonomous process. Keep sensitive actions gated and logged.",
  },
  {
    key: "conway-automaton",
    name: "Conway Automaton",
    url: "https://github.com/Conway-Research/automaton",
    decision: "adopt-patterns",
    fit: "medium",
    installNow: false,
    bestUse:
      "Borrow governance patterns: policy engine, spend caps, prompt-injection checks, heartbeat state, audit logs, and protected files.",
    why:
      "The sovereign/self-replicating runtime is not a fit for VestBlock production, but its safety architecture is directly relevant to a command-center agent that can email, analyze, and launch plays.",
    guardrail:
      "Do not use self-replication, wallet-funded autonomy, domain purchase, or self-modification in VestBlock. Borrow controls, not sovereignty.",
  },
]

const INFRASTRUCTURE_KEYWORDS = [
  "agent infrastructure",
  "openhands",
  "open hands",
  "crew ai",
  "crewai",
  "langgraph",
  "openmanus",
  "open manus",
  "openclaw",
  "open claw",
  "conway",
  "automaton",
  "mcp",
]

export function isAgentInfrastructureQuery(query: string) {
  const lower = query.toLowerCase()
  return INFRASTRUCTURE_KEYWORDS.some((keyword) => lower.includes(keyword))
}

export function buildAgentInfrastructureContext() {
  return AGENT_INFRASTRUCTURE_CANDIDATES.map((candidate) =>
    [
      `${candidate.name} (${candidate.url})`,
      `Decision: ${candidate.decision}; fit: ${candidate.fit}; install now: ${candidate.installNow ? "yes" : "no"}.`,
      `Best use: ${candidate.bestUse}`,
      `Why: ${candidate.why}`,
      `Guardrail: ${candidate.guardrail}`,
    ].join(" ")
  ).join("\n")
}

export function buildAgentInfrastructureBrief() {
  const top = AGENT_INFRASTRUCTURE_CANDIDATES.filter((candidate) => candidate.fit === "high" || candidate.key === "conway-automaton")
  return [
    "I would not install Conway Automaton, OpenHands, OpenManus, CrewAI, or OpenClaw directly into VestBlock right now.",
    "The strongest move is MCP-style connector discipline plus our existing command-center/boss architecture.",
    "Best near-term additions: MCP connectors with least-privilege access, Conway-style policy and spend guardrails, and a small LangGraph.js pilot only when a single deal workflow needs durable state.",
    `Highest-signal candidates: ${top.map((candidate) => `${candidate.name} (${candidate.decision})`).join(", ")}.`,
  ].join(" ")
}
