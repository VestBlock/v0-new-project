#!/usr/bin/env node
// Lanes 2+4: Transparent Underwriting / Listing Post-Mortem draft generator.
//
// Takes stale/expired listing data (agent or owner contact + list price + days on market)
// and generates "here's our math" drafts: DOM framing, screening cash-review band, and the
// three exit paths. Nobody else in the market shows their math — that's the lane.
//
// Screening bands use the house conventions (conservative 62% / balanced 72% of list price
// as a value proxy) and every draft carries the screening disclaimer. This is honest
// screening math, not an appraisal or an offer.
//
// Input (newest wins unless --input given):
//   tmp/outreach/stale-listing-drafts-*.json  (from stale-listing-finder)
// Output (review-first, never sends):
//   data/operating-loops/postmortem/postmortem-drafts-<stamp>.csv (email,subject,body,...)
//   -> verify with outreach:verify-emails -- --csv=<file>, send the -verified.csv via the guarded sender
//
// Usage:
//   npm run outreach:postmortem-drafts
//   npm run outreach:postmortem-drafts -- --min-dom=60 --limit=60

import fs from "node:fs"
import path from "node:path"
import { getEmailQualityIssue, normalizeEmailAddress } from "./shared-email-quality.mjs"

const ROOT = process.cwd()
const SOURCE_DIR = path.join(ROOT, "tmp", "outreach")
const OUT_DIR = path.join(ROOT, "data", "operating-loops", "postmortem")
const SUPPRESSIONS_PATH = path.join(ROOT, "data", "outreach-suppressions.json")

const args = process.argv.slice(2)
const argValue = (name, fallback) => {
  const hit = [...args].reverse().find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const MIN_DOM = Number(argValue("min-dom", 60))
const LIMIT = Number(argValue("limit", 60))
const INPUT = argValue("input", "")

const money = (value) => `$${Math.round(Number(value)).toLocaleString()}`
const roundK = (value) => Math.round(Number(value) / 1000) * 1000

function suppressedEmails() {
  try {
    const data = JSON.parse(fs.readFileSync(SUPPRESSIONS_PATH, "utf8"))
    const rows = Array.isArray(data) ? data : Array.isArray(data?.emails) ? data.emails : []
    return new Set(rows.map((r) => String(r.email || "").trim().toLowerCase()).filter(Boolean))
  } catch { return new Set() }
}

function latestDraftFile() {
  if (INPUT) return path.resolve(ROOT, INPUT)
  try {
    const latest = fs.readdirSync(SOURCE_DIR)
      .filter((n) => n.startsWith("stale-listing-drafts-") && n.endsWith(".json"))
      .sort()
      .pop()
    return latest ? path.join(SOURCE_DIR, latest) : null
  } catch { return null }
}

const csvEscape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`

function teardownDraft(row) {
  const price = Number(String(row.price || row.list_price || "").replace(/[^0-9.]/g, "")) || null
  const dom = Number(row.days_on_market || row.dom || 0) || null
  const address = String(row.address || "").trim()
  const agentName = String(row.agent_name || "").trim().split(/\s+/)[0] || null

  const conservative = price ? roundK(price * 0.62) : null
  const balanced = price ? roundK(price * 0.72) : null

  const domLine = dom
    ? dom >= 120
      ? `${address} has been on market ${dom} days — at that point the listing itself is telling you the price band, not the other way around.`
      : `${address} has been on market ${dom} days, which usually means the market has already voted on the current price.`
    : `${address} has had extended market time.`

  const mathLines = price
    ? [
        `Here is the screening math we actually run, so you can check it yourself:`,
        `- List price: ${money(price)}`,
        `- Cash-review band our buyers typically underwrite from: ${money(conservative)}–${money(balanced)} (62–72% of list, before repair adjustments)`,
        `- If that band is too far from the payoff, a creative structure (terms over time) or a novation (coordinated retail resale) often closes the gap without a fire-sale price.`,
      ]
    : [
        `We underwrite from screening bands (typically 62–72% of realistic value before repair adjustments) and we show that math up front rather than hiding it behind a lowball.`,
      ]

  return {
    subject: dom ? `${address} — ${dom} days on market: the math nobody showed you` : `${address} — the math nobody showed you`,
    body: [
      agentName ? `Hi ${agentName},` : "Hi,",
      "",
      domLine,
      "",
      ...mathLines,
      "",
      `These are screening numbers, not an appraisal or an offer — condition, payoff, and title change everything, and we say so. If you want the full breakdown (three exit paths, with numbers) reply and we'll send it. No fee, no obligation.`,
    ].join("\n"),
  }
}

// ---- Main ----------------------------------------------------------------------
const sourceFile = latestDraftFile()
if (!sourceFile || !fs.existsSync(sourceFile)) {
  console.error("No stale-listing drafts found in tmp/outreach. Run the stale-listing finder first, or pass --input=path.json")
  process.exit(1)
}
const rows = JSON.parse(fs.readFileSync(sourceFile, "utf8"))
if (!Array.isArray(rows) || !rows.length) {
  console.error(`No rows in ${sourceFile}`)
  process.exit(1)
}

const suppressed = suppressedEmails()
const seen = new Set()
const queue = []
const skipped = { noEmail: 0, badEmail: 0, suppressed: 0, duplicate: 0, freshListing: 0 }

for (const row of rows) {
  if (queue.length >= LIMIT) break
  const email = normalizeEmailAddress(row.agent_email || row.email || "")
  const dom = Number(row.days_on_market || row.dom || 0)
  if (!email) { skipped.noEmail += 1; continue }
  if (getEmailQualityIssue(email) !== null) { skipped.badEmail += 1; continue }
  if (suppressed.has(email)) { skipped.suppressed += 1; continue }
  if (seen.has(email)) { skipped.duplicate += 1; continue }
  if (dom && dom < MIN_DOM) { skipped.freshListing += 1; continue }
  seen.add(email)
  const draft = teardownDraft(row)
  queue.push({
    email,
    address: String(row.address || "").trim(),
    market: String(row.market || "").trim() || null,
    days_on_market: dom || null,
    list_price: row.price || null,
    strategy: "listing-postmortem",
    subject: draft.subject,
    body: draft.body,
  })
}

fs.mkdirSync(OUT_DIR, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, "-")
const csvPath = path.join(OUT_DIR, `postmortem-drafts-${stamp}.csv`)
fs.writeFileSync(
  csvPath,
  `${[
    ["email", "property_address", "market", "days_on_market", "list_price", "strategy", "subject", "body"].join(","),
    ...queue.map((r) => [r.email, r.address, r.market, r.days_on_market, r.list_price, r.strategy, r.subject, r.body].map(csvEscape).join(",")),
  ].join("\n")}\n`,
  "utf8"
)

console.log(`Post-mortem drafts staged (review-first, nothing sent): ${queue.length} (min DOM ${MIN_DOM}, cap ${LIMIT})`)
console.log(`  source: ${path.basename(sourceFile)}`)
console.log(`  skipped -> no email: ${skipped.noEmail}, bad email: ${skipped.badEmail}, suppressed: ${skipped.suppressed}, duplicate: ${skipped.duplicate}, under min DOM: ${skipped.freshListing}`)
console.log(`  CSV: ${csvPath}`)
console.log(`Next: npm run outreach:verify-emails -- --csv=${path.relative(ROOT, csvPath)} then send the -verified.csv via the guarded sender.`)
