#!/usr/bin/env node
// Reactivation queue: second-touch candidates mined from the campaign ledger.
//
// Every recipient in data/operating-loops/campaign-ledger.jsonl who got exactly one
// email, never replied, never opted out, and is past the age threshold is a paid-for
// contact going cold. This script stages them for a review-first second touch.
// It NEVER sends — output goes to data/operating-loops/reactivation/ for operator
// review and the existing guarded sender path.
//
// Usage:
//   npm run outreach:reactivation-queue                       # defaults: 12d age, 30/lane, 120 total
//   npm run outreach:reactivation-queue -- --min-age-days=21 --per-lane=20 --limit=60
//   Flags: --include-review-only   (also mine seller-options / on-market-lowball lanes)

import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const LEDGER_PATH = path.join(ROOT, "data", "operating-loops", "campaign-ledger.jsonl")
const SUPPRESSIONS_PATH = path.join(ROOT, "data", "outreach-suppressions.json")
const REPLY_LOG_PATH = path.join(ROOT, "data", "operating-loops", "reply-log.jsonl")
const OUT_DIR = path.join(ROOT, "data", "operating-loops", "reactivation")

const REVIEW_ONLY_PATTERN = /seller-options|on-market-lowball/

function arg(name, fallback) {
  const prefix = `--${name}=`
  const hit = process.argv.filter((piece) => piece.startsWith(prefix)).pop()
  return hit ? hit.slice(prefix.length) : fallback
}
const MIN_AGE_DAYS = Number(arg("min-age-days", 12))
const PER_LANE = Number(arg("per-lane", 30))
const LIMIT = Number(arg("limit", 120))
const INCLUDE_REVIEW_ONLY = process.argv.includes("--include-review-only")

function readJsonl(file) {
  try {
    return fs
      .readFileSync(file, "utf8")
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

function suppressedEmails() {
  try {
    const data = JSON.parse(fs.readFileSync(SUPPRESSIONS_PATH, "utf8"))
    const rows = Array.isArray(data) ? data : Array.isArray(data?.emails) ? data.emails : []
    return new Set(rows.map((row) => String(row.email || "").trim().toLowerCase()).filter(Boolean))
  } catch {
    return new Set()
  }
}

function repliedEmails() {
  return new Set(
    readJsonl(REPLY_LOG_PATH)
      .map((row) => String(row.email || "").trim().toLowerCase())
      .filter(Boolean)
  )
}

function daysSince(iso) {
  const at = Date.parse(iso || "")
  if (!Number.isFinite(at)) return null
  return Math.floor((Date.now() - at) / 86400000)
}

// Short, honest second-touch copy. The guarded sender appends the compliance
// footer (mailing address + opt-out); do not add claims or pressure here.
function secondTouchDraft(candidate) {
  const address = candidate.propertyAddress || "your property"
  return {
    subject: `Following up on ${address}`,
    body: [
      `Hi,`,
      ``,
      `I reached out a few weeks ago about ${address} and wanted to follow up once.`,
      `If selling is on your mind this year, I can share what a cash offer or flexible-terms option could look like — no obligation and no pressure either way.`,
      ``,
      `If the timing is wrong or you'd rather not hear from me, just reply "no thanks" and I'll close the file.`,
    ].join("\n"),
  }
}

const events = readJsonl(LEDGER_PATH)
if (!events.length) {
  console.error("No campaign ledger found. Open /admin/command-center once to regenerate it, then rerun.")
  process.exit(1)
}

const suppressed = suppressedEmails()
const replied = repliedEmails()

// Count touches + keep latest sent event per recipient
const byRecipient = new Map()
for (const event of events) {
  const email = String(event.recipient || "").trim().toLowerCase()
  if (!email || event.channel !== "email") continue
  const entry = byRecipient.get(email) || { touches: 0, sent: 0, latest: null }
  entry.touches += 1
  if (event.status === "sent") {
    entry.sent += 1
    if (!entry.latest || Date.parse(event.sentAt || "") > Date.parse(entry.latest.sentAt || "")) {
      entry.latest = event
    }
  }
  byRecipient.set(email, entry)
}

const skipped = { suppressed: 0, replied: 0, tooFresh: 0, multiTouch: 0, reviewOnlyLane: 0, neverDelivered: 0 }
const candidates = []
for (const [email, entry] of byRecipient) {
  if (!entry.latest) {
    skipped.neverDelivered += 1
    continue
  }
  if (suppressed.has(email)) {
    skipped.suppressed += 1
    continue
  }
  if (replied.has(email)) {
    skipped.replied += 1
    continue
  }
  if (entry.sent > 1) {
    skipped.multiTouch += 1
    continue
  }
  const age = daysSince(entry.latest.sentAt)
  if (age === null || age < MIN_AGE_DAYS) {
    skipped.tooFresh += 1
    continue
  }
  if (!INCLUDE_REVIEW_ONLY && REVIEW_ONLY_PATTERN.test(entry.latest.strategyKey || "")) {
    skipped.reviewOnlyLane += 1
    continue
  }
  candidates.push({
    email,
    strategyKey: entry.latest.strategyKey,
    strategyName: entry.latest.strategyName,
    market: entry.latest.market || null,
    propertyAddress: entry.latest.propertyAddress || null,
    firstTouchAt: entry.latest.sentAt,
    daysSinceTouch: age,
    priorArtifact: entry.latest.artifactFile,
  })
}

// Oldest first inside each lane, cap per lane, then overall cap
candidates.sort((a, b) => b.daysSinceTouch - a.daysSinceTouch)
const perLaneCount = new Map()
const queue = []
for (const candidate of candidates) {
  if (queue.length >= LIMIT) break
  const laneCount = perLaneCount.get(candidate.strategyKey) || 0
  if (laneCount >= PER_LANE) continue
  perLaneCount.set(candidate.strategyKey, laneCount + 1)
  queue.push({ ...candidate, draft: secondTouchDraft(candidate) })
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-")
fs.mkdirSync(OUT_DIR, { recursive: true })
const jsonPath = path.join(OUT_DIR, `reactivation-queue-${stamp}.json`)
const csvPath = path.join(OUT_DIR, `reactivation-queue-${stamp}.csv`)

fs.writeFileSync(jsonPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), minAgeDays: MIN_AGE_DAYS, perLane: PER_LANE, limit: LIMIT, eligible: candidates.length, skipped, queue }, null, 2)}\n`, "utf8")

const csvEscape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`
const csvRows = [
  ["email", "strategy", "market", "property_address", "days_since_touch", "subject", "body"].join(","),
  ...queue.map((row) =>
    [row.email, row.strategyKey, row.market, row.propertyAddress, row.daysSinceTouch, row.draft.subject, row.draft.body]
      .map(csvEscape)
      .join(",")
  ),
]
fs.writeFileSync(csvPath, `${csvRows.join("\n")}\n`, "utf8")

const laneSummary = [...perLaneCount.entries()].sort((a, b) => b[1] - a[1])
console.log(`Reactivation queue staged (review-first, nothing sent):`)
console.log(`  candidates eligible: ${candidates.length}; staged: ${queue.length} (cap ${LIMIT}, ${PER_LANE}/lane, min age ${MIN_AGE_DAYS}d)`)
console.log(`  skipped -> suppressed: ${skipped.suppressed}, replied: ${skipped.replied}, too fresh: ${skipped.tooFresh}, multi-touch: ${skipped.multiTouch}, review-only lane: ${skipped.reviewOnlyLane}`)
for (const [lane, count] of laneSummary) console.log(`  ${lane}: ${count}`)
console.log(`  JSON: ${jsonPath}`)
console.log(`  CSV:  ${csvPath}`)
console.log(`Next: review the CSV, then send the strongest batch through the existing guarded sender. Log every reply with outreach:log-reply.`)
