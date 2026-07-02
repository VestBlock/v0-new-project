#!/usr/bin/env node
// Outreach Autopilot: the whole daily loop in one command, review-first by design.
//
// Automates everything EXCEPT the final send decision (policy since the 2026-05-19
// cap-overrun incident: live sends stay human-gated).
//
// Phases:
//   1. GATHER   — per-lane stats from the campaign ledger + reply log + suppressions
//   2. REACTIVATE — stage second-touch drafts (Mondays, or --reactivation)
//   3. VERIFY   — email preflight on the newest staged batch
//   4. PLAN     — today's send plan against the daily cap, replies-first lane order
//   5. LEARN    — computed learning audit
//   6. BRIEF    — one morning brief with the single decision that needs a human
//
// Usage:
//   npm run outreach:autopilot                # full morning run (stages, never sends)
//   npm run outreach:autopilot -- --reactivation   # force the reactivation phase
//   npm run outreach:autopilot -- --skip-verify    # skip MX/email preflight
//
// Env: OUTREACH_DAILY_CAP (default 50)

import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

const ROOT = process.cwd()
const OPS_DIR = path.join(ROOT, "data", "operating-loops")
const LEDGER_PATH = path.join(OPS_DIR, "campaign-ledger.jsonl")
const REPLY_LOG_PATH = path.join(OPS_DIR, "reply-log.jsonl")
const SUPPRESSIONS_PATH = path.join(ROOT, "data", "outreach-suppressions.json")
const REACTIVATION_DIR = path.join(OPS_DIR, "reactivation")
const BRIEF_JSON = path.join(OPS_DIR, "morning-brief-latest.json")
const BRIEF_MD = path.join(OPS_DIR, "morning-brief-latest.md")

const DAILY_CAP = Number(process.env.OUTREACH_DAILY_CAP || 50)
const REVIEW_ONLY_PATTERN = /seller-options|on-market-lowball/
const PRIORITY_ROTATION = [
  "tax-code-stack", "portfolio-landlord", "tax-remote-equity-rotation", "vacant-equity",
  "preforeclosure-equity", "probate-vacant-equity", "failed-landlord-exit", "rent-gap-multifamily",
  "portfolio-fragmentation", "judgment-lien-pressure", "utility-lien-water-shutoff", "permit-spike-developer-land",
  "stale-listing-creative-finance",
]

const hasFlag = (name) => process.argv.includes(`--${name}`)

function readJsonl(file) {
  try {
    return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => {
      try { return JSON.parse(line) } catch { return null }
    }).filter(Boolean)
  } catch { return [] }
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")) } catch { return fallback }
}

function fileAgeDays(file) {
  try { return (Date.now() - fs.statSync(file).mtimeMs) / 86400000 } catch { return null }
}

function runStep(label, command, args) {
  console.log(`\n── ${label} ──`)
  const result = spawnSync(command, args, { stdio: "inherit", cwd: ROOT })
  return result.status === 0
}

function latestFile(dir, prefix, suffix) {
  try {
    return fs.readdirSync(dir).filter((n) => n.startsWith(prefix) && n.endsWith(suffix)).sort().pop() || null
  } catch { return null }
}

// ---- Phase 0: REPLY SYNC ---------------------------------------------------
// Pull inbox replies into the attribution loop BEFORE computing lane stats.
// Fails soft: without the gmail.readonly scope this warns and the run continues.
console.log("VestBlock Outreach Autopilot — review-first daily run")
if (!hasFlag("skip-reply-sync")) {
  const replySync = spawnSync("node", ["--env-file=.env.local", "scripts/gmail-reply-sync.mjs", "--apply"], {
    stdio: "inherit",
    cwd: ROOT,
  })
  if (replySync.status !== 0) {
    console.warn("Reply sync unavailable (likely missing gmail.readonly scope) — continuing; log replies manually with outreach:log-reply.")
  }
}

const events = readJsonl(LEDGER_PATH)
const ledgerAgeDays = fileAgeDays(LEDGER_PATH)
const suppressionRows = (() => {
  const data = readJson(SUPPRESSIONS_PATH, null)
  return Array.isArray(data) ? data : Array.isArray(data?.emails) ? data.emails : []
})()
const suppressedEmails = new Set(suppressionRows.map((r) => String(r.email || "").trim().toLowerCase()).filter(Boolean))
const repliedEmails = new Set(readJsonl(REPLY_LOG_PATH).map((r) => String(r.email || "").trim().toLowerCase()).filter(Boolean))

const today = new Date().toISOString().slice(0, 10)
const lanes = new Map()
let sentToday = 0
for (const event of events) {
  if (event.channel !== "email") continue
  const lane = lanes.get(event.strategyKey) || { sent: 0, replies: 0, optOuts: 0 }
  const email = String(event.recipient || "").trim().toLowerCase()
  if (event.status === "sent") {
    lane.sent += 1
    if (String(event.sentAt || "").slice(0, 10) === today) sentToday += 1
    if (email && repliedEmails.has(email)) lane.replies += 1
    if (email && suppressedEmails.has(email)) lane.optOuts += 1
  }
  lanes.set(event.strategyKey, lane)
}
const remainingToday = Math.max(0, DAILY_CAP - sentToday)

// ---- Phase 2: REACTIVATE -------------------------------------------------
const isMonday = new Date().getDay() === 1
if (isMonday || hasFlag("reactivation")) {
  runStep("Reactivation queue (second touches)", "node", ["scripts/reactivation-queue.mjs"])
} else {
  console.log("\n── Reactivation skipped (runs Mondays; force with --reactivation) ──")
}

// ---- Phase 3: VERIFY -----------------------------------------------------
let verification = null
const latestReactivationCsv = latestFile(REACTIVATION_DIR, "reactivation-queue-", ".csv")
const unverified = latestReactivationCsv && !latestReactivationCsv.includes("-verified") &&
  !fs.existsSync(path.join(REACTIVATION_DIR, latestReactivationCsv.replace(/\.csv$/, "-verified.csv")))
if (!hasFlag("skip-verify") && unverified) {
  runStep("Email verification preflight", "node", ["scripts/verify-email-batch.mjs", "--latest-reactivation"])
}
const latestSummary = latestFile(REACTIVATION_DIR, "reactivation-queue-", "-verification-summary.json")
if (latestSummary) verification = readJson(path.join(REACTIVATION_DIR, latestSummary), null)

// ---- Phase 4: PLAN -------------------------------------------------------
const laneRows = [...lanes.entries()].map(([key, stats]) => ({ key, ...stats }))
const activeLanes = laneRows.filter((lane) => !REVIEW_ONLY_PATTERN.test(lane.key))
const replyLanes = activeLanes.filter((lane) => lane.replies > 0).sort((a, b) => b.replies - a.replies)
const rotationOrder = PRIORITY_ROTATION.filter((key) => activeLanes.some((lane) => lane.key === key))
const planOrder = [...new Set([...replyLanes.map((l) => l.key), ...rotationOrder])]
const verifiedReady = verification ? verification.verified : null

const sendPlan = {
  dailyCap: DAILY_CAP,
  sentToday,
  remainingToday,
  laneOrder: planOrder.slice(0, 6),
  verifiedBatchReady: verifiedReady,
  command:
    remainingToday <= 0
      ? null
      : verifiedReady
        ? `npm run outreach:send-reactivation -- --limit=${Math.min(remainingToday, verifiedReady)}  (preview) then npm run outreach:send-reactivation:live -- --limit=${Math.min(remainingToday, verifiedReady)}`
        : `npm run outreach:v4-send-approved -- --limit=${Math.min(remainingToday, 50)}  (preview first; live variant only after review)`,
}

// ---- Phase 4b: LANE FILL ---------------------------------------------------
// Match each rotation lane to its freshest DealMachine export so today's build
// work targets empty lanes instead of guessing.
const ROTATION_PLAN = readJson(path.join(OPS_DIR, "strategy-rotation-plan.json"), null)
const DM_EXPORT_DIR = path.join(ROOT, "data", "dm-exports")
const FRESH_DAYS = Number(process.env.OUTREACH_EXPORT_FRESH_DAYS || 10)
const LANES_PER_DAY = Number(process.env.OUTREACH_LANE_BUILDS_PER_DAY || 2)

function marketSlug(market) {
  return String(market || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

function laneFreshness(strategy, market) {
  const slug = marketSlug(market)
  let newest = null
  const walk = (dir) => {
    let names = []
    try { names = fs.readdirSync(dir) } catch { return }
    for (const name of names) {
      const full = path.join(dir, name)
      let stat
      try { stat = fs.statSync(full) } catch { continue }
      if (stat.isDirectory()) { walk(full); continue }
      if (!name.endsWith(".csv")) continue
      const lower = name.toLowerCase()
      if (!lower.includes(strategy) || !lower.includes(slug)) continue
      if (!newest || stat.mtimeMs > newest) newest = stat.mtimeMs
    }
  }
  walk(DM_EXPORT_DIR)
  if (!newest) return { state: "missing", ageDays: null }
  const ageDays = (Date.now() - newest) / 86400000
  return { state: ageDays <= FRESH_DAYS ? "fresh" : "stale", ageDays: Math.round(ageDays) }
}

let laneFill = null
if (ROTATION_PLAN && Array.isArray(ROTATION_PLAN.lanes)) {
  const laneStates = ROTATION_PLAN.lanes.map((lane) => ({
    strategy: lane.strategy,
    market: lane.market,
    ...laneFreshness(lane.strategy, lane.market),
    buildCommand: lane.buildCommand,
  }))
  const fresh = laneStates.filter((l) => l.state === "fresh")
  const empty = laneStates.filter((l) => l.state !== "fresh")
  // Today's builds: first unfilled lanes in plan order (the plan is already wave-ordered).
  const buildToday = empty.slice(0, LANES_PER_DAY)
  laneFill = {
    totalLanes: laneStates.length,
    freshLanes: fresh.length,
    emptyLanes: empty.length,
    freshList: fresh.slice(0, 8).map((l) => `${l.strategy} / ${l.market} (${l.ageDays}d)`),
    buildToday: buildToday.map((l) => ({ lane: `${l.strategy} / ${l.market}`, command: l.buildCommand })),
  }
}

// ---- Phase 5: LEARN --------------------------------------------------------
runStep("Learning audit (computed)", "node", ["scripts/outreach-learning-audit.mjs"])
const learning = readJson(path.join(OPS_DIR, "outreach-learning-audit-latest.json"), null)

// ---- Phase 6: BRIEF --------------------------------------------------------
const blockers = []
if (ledgerAgeDays !== null && ledgerAgeDays > 2) {
  blockers.push(`Campaign ledger is ${Math.round(ledgerAgeDays)} days old — open /admin/command-center once to resync before trusting lane stats.`)
}
if (events.length && repliedEmails.size === 0) {
  blockers.push("Zero replies logged all-time. Log every inbox reply with outreach:log-reply or lane decisions stay blind.")
}
if (verification && verification.risky > 0) {
  blockers.push(`${verification.risky} risky email(s) held out of the verified batch — send only the -verified.csv file.`)
}
if (remainingToday <= 0) blockers.push(`Daily cap (${DAILY_CAP}) already reached — no sends today.`)

const decision =
  remainingToday <= 0
    ? "No decision needed today: cap reached. Work replies and follow-ups instead."
    : verifiedReady
      ? `Review the verified reactivation batch (${verifiedReady} emails) and approve the send. Everything else is staged.`
      : `Pick today's lane from [${planOrder.slice(0, 3).join(", ") || "none staged"}] and stage a 30-lead batch in the command center.`

if (laneFill && laneFill.freshLanes === 0) {
  blockers.push(`All ${laneFill.totalLanes} rotation lanes lack a fresh export (<=${FRESH_DAYS}d) — run today's lane builds before expecting new sends.`)
}

const brief = {
  generatedAt: new Date().toISOString(),
  sentToday,
  remainingToday,
  dailyCap: DAILY_CAP,
  ledgerAgeDays: ledgerAgeDays !== null ? Math.round(ledgerAgeDays * 10) / 10 : null,
  topReplyLanes: replyLanes.slice(0, 3),
  sendPlan,
  laneFill,
  verification,
  bottleneck: learning?.currentBottleneck || null,
  blockers,
  decision,
}
fs.mkdirSync(OPS_DIR, { recursive: true })
fs.writeFileSync(BRIEF_JSON, `${JSON.stringify(brief, null, 2)}\n`, "utf8")

const md = [
  `# Outreach Morning Brief — ${today}`,
  "",
  `**Sends:** ${sentToday}/${DAILY_CAP} today · ${remainingToday} slots left`,
  `**Bottleneck:** ${brief.bottleneck || "n/a"}`,
  replyLanes.length
    ? `**Reply lanes:** ${replyLanes.slice(0, 3).map((l) => `${l.key} (${l.replies})`).join(", ")}`
    : "**Reply lanes:** none yet — log replies with `outreach:log-reply`",
  verification ? `**Verified batch:** ${verification.verified} clean / ${verification.risky} held` : "**Verified batch:** none staged",
  "",
  ...(laneFill
    ? [
        "",
        "## Lane fill (new leads every day)",
        `${laneFill.freshLanes}/${laneFill.totalLanes} rotation lanes have a fresh export (<=${FRESH_DAYS}d).`,
        ...(laneFill.buildToday.length
          ? [
              `Build these ${laneFill.buildToday.length} lane(s) today:`,
              ...laneFill.buildToday.map((b) => `- **${b.lane}**\n  \`${b.command}\``),
            ]
          : ["All lanes are fresh — no builds needed today."]),
      ]
    : []),
  "",
  "## Blockers",
  ...(blockers.length ? blockers.map((b) => `- ${b}`) : ["- none"]),
  "",
  "## The one decision",
  decision,
  "",
  sendPlan.command ? `Send command after review: \`${sendPlan.command}\`` : "",
].join("\n")
fs.writeFileSync(BRIEF_MD, `${md}\n`, "utf8")

console.log(`\n${"═".repeat(60)}\n${md}\n${"═".repeat(60)}`)
console.log(`\nBrief written: ${BRIEF_MD}`)
