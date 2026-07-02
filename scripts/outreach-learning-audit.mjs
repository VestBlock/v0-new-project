#!/usr/bin/env node
// Outreach learning audit: computed from the campaign ledger, latest V4 scorecard,
// suppressions, and the operator reply log. No hardcoded narrative — every
// pause/keep decision below is derived from the numbers in this run.

import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const OUT_DIR = path.join(ROOT, "data", "operating-loops")
const SUMMARY_PATH = path.join(OUT_DIR, "campaign-summary.json")
const SCORECARD_ROOT = path.join(ROOT, "artifacts", "outreach-v4")
const SUPPRESSIONS_PATH = path.join(ROOT, "data", "outreach-suppressions.json")
const REPLY_LOG_PATH = path.join(OUT_DIR, "reply-log.jsonl")
const OUT_PATH = path.join(OUT_DIR, "outreach-learning-audit-latest.json")

// Policy currently in force (config, not findings).
const ACTIVE_RULES = [
  "Default strategy rotation uses high-intent stacked lanes first.",
  "Generic seller-options live sends require --allow-generic-seller-options.",
  "On-market lowball live sends require --allow-on-market-lowball-live.",
  "Unreviewed lane caps stay at 30 unless --allow-high-volume is passed intentionally.",
]
const PRIORITY_ROTATION = [
  "tax-code-stack",
  "portfolio-landlord",
  "tax-remote-equity-rotation",
  "vacant-equity",
  "preforeclosure-equity",
  "probate-vacant-equity",
  "failed-landlord-exit",
  "rent-gap-multifamily",
  "portfolio-fragmentation",
  "judgment-lien-pressure",
  "utility-lien-water-shutoff",
  "permit-spike-developer-land",
]
const REVIEW_ONLY_PATTERN = /seller-options|on-market-lowball/

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return fallback
  }
}

function latestScorecard() {
  try {
    const dates = fs
      .readdirSync(SCORECARD_ROOT)
      .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name))
      .sort()
    for (const date of dates.reverse()) {
      const file = path.join(SCORECARD_ROOT, date, "outreach-v4-scorecard.json")
      if (fs.existsSync(file)) return { date, scorecard: readJson(file, null) }
    }
  } catch {
    // no artifacts yet
  }
  return { date: null, scorecard: null }
}

function suppressionRows() {
  const data = readJson(SUPPRESSIONS_PATH, null)
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.emails)) return data.emails
  return []
}

function replyLogRows() {
  try {
    return fs
      .readFileSync(REPLY_LOG_PATH, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line)
        } catch {
          return null
        }
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

function campaignRow(row) {
  return {
    key: row.key,
    label: row.label,
    sent: row.sent || 0,
    replies: row.replies || 0,
    failed: row.failed || 0,
    blocked: row.blocked || 0,
    optOuts: row.optOuts || 0,
    nextMove: row.nextMove,
  }
}

const campaigns = readJson(SUMMARY_PATH, []).map(campaignRow)
const { date: scorecardDate, scorecard } = latestScorecard()
const suppressions = suppressionRows()
const replyLog = replyLogRows()

const totals = campaigns.reduce(
  (sum, row) => ({
    trackedSends: sum.trackedSends + row.sent,
    replies: sum.replies + row.replies,
    failed: sum.failed + row.failed,
    blocked: sum.blocked + row.blocked,
    optOutSignals: sum.optOutSignals + row.optOuts,
  }),
  { trackedSends: 0, replies: 0, failed: 0, blocked: 0, optOutSignals: 0 }
)
totals.suppressionRecords = suppressions.length
totals.operatorLoggedReplies = replyLog.length

// Data-driven lane triage
const winning = campaigns.filter((row) => row.replies > 0).sort((a, b) => b.replies - a.replies)
const pauseOrReviewOnly = campaigns
  .filter(
    (row) =>
      row.sent > 0 &&
      row.replies === 0 &&
      (REVIEW_ONLY_PATTERN.test(row.key || "") || row.optOuts > 0 || row.sent >= 30)
  )
  .sort((a, b) => b.sent - a.sent)
  .slice(0, 8)
  .map((row) => ({
    ...row,
    why: REVIEW_ONLY_PATTERN.test(row.key || "")
      ? "Policy lane: review-only by default until reply attribution proves it."
      : row.optOuts > 0
        ? `${row.optOuts} opt-out signal(s) with zero attributed replies.`
        : `${row.sent} sends with zero attributed replies — volume without signal.`,
  }))
const keepTesting = campaigns
  .filter(
    (row) =>
      row.sent > 0 &&
      row.replies === 0 &&
      row.blocked === 0 &&
      row.optOuts === 0 &&
      row.sent < 30 &&
      !REVIEW_ONLY_PATTERN.test(row.key || "")
  )
  .sort((a, b) => b.sent - a.sent)
  .slice(0, 8)
const blockedLanes = campaigns.filter((row) => row.blocked > 0 && row.sent === 0)

// Computed observations
const learned = []
if (totals.trackedSends > 0 && totals.replies === 0 && replyLog.length === 0) {
  learned.push(
    `${totals.trackedSends} tracked sends have zero attributed replies. Either nobody replied (source/copy problem) or replies are not being logged (run outreach:log-reply on every inbox reply before drawing conclusions).`
  )
}
if (winning.length) {
  learned.push(
    `Reply-producing lanes: ${winning.map((row) => `${row.key} (${row.replies})`).join(", ")}. Route follow-up capacity and fresh sourcing there first.`
  )
}
if (totals.optOutSignals > 0) {
  const rate = totals.trackedSends ? ((totals.optOutSignals / totals.trackedSends) * 100).toFixed(1) : "n/a"
  learned.push(`Opt-out signal rate is ${rate}% of tracked sends (${totals.optOutSignals}/${totals.trackedSends}). Tighten copy in lanes listed under pauseOrReviewOnly.`)
}
if (blockedLanes.length) {
  learned.push(`${blockedLanes.length} lane(s) are source-blocked with zero sends: ${blockedLanes.map((row) => row.key).join(", ")}. Rebuild exports before treating them as tested.`)
}
if (!campaigns.length) {
  learned.push("Campaign summary is empty — open /admin/command-center once (or run a send script) to regenerate the ledger before trusting this audit.")
}

const audit = {
  generatedAt: new Date().toISOString(),
  inputs: {
    campaignSummary: SUMMARY_PATH,
    scorecardDate,
    suppressionsFile: SUPPRESSIONS_PATH,
    replyLogFile: REPLY_LOG_PATH,
  },
  totals,
  currentBottleneck:
    scorecard?.bottleneck ||
    (totals.replies === 0 && totals.trackedSends > 0
      ? "reply attribution: zero replies logged against tracked sends"
      : "source quality and lane fit"),
  learned,
  ruleChangesNowActive: ACTIVE_RULES,
  priorityRotation: PRIORITY_ROTATION,
  winning: winning.slice(0, 8),
  pauseOrReviewOnly,
  keepTesting,
  blockedLanes: blockedLanes.slice(0, 8),
  nextRun: [
    "Log every inbox reply with npm run outreach:log-reply so lane replies/optOuts stay real.",
    "Build or download fresh DealMachine Contacts exports for priorityRotation lanes only.",
    "Stage 30 per lane in Command Center, verify DNC/suppressions, then send the strongest batch.",
    "Rerun this audit and compare replies + opt-outs per lane before increasing caps.",
  ],
}

fs.mkdirSync(OUT_DIR, { recursive: true })
fs.writeFileSync(OUT_PATH, `${JSON.stringify(audit, null, 2)}\n`, "utf8")
console.log(`Outreach learning audit written: ${OUT_PATH}`)
console.log(
  `Tracked sends: ${totals.trackedSends}; replies: ${totals.replies}; failed: ${totals.failed}; blocked: ${totals.blocked}; opt-outs: ${totals.optOutSignals}; scorecard: ${scorecardDate || "none found"}`
)
if (audit.learned.length) {
  for (const line of audit.learned) console.log(`- ${line}`)
}
