import fs from "node:fs"
import path from "node:path"
import { Resend } from "resend"

import { getEmailQualityIssue, normalizeEmailAddress } from "./shared-email-quality.mjs"

const args = process.argv.slice(2)
const SEND = args.includes("--send")

function getArg(name, fallback = "") {
  const prefix = `--${name}=`
  const inline = [...args].reverse().find((arg) => arg.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)
  const flag = `--${name}`
  const index = args.lastIndexOf(flag)
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith("--")) return args[index + 1]
  return fallback
}

function intArg(name, fallback, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(getArg(name, ""), 10)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Math.min(parsed, max)
}

function env(name) {
  return String(process.env[name] || "").trim()
}

function sender() {
  return env("OUTREACH_FROM_EMAIL") || env("FROM_EMAIL") || env("RESEND_EMAIL") || "acquisitions@vestblock.io"
}

function mailingAddress() {
  return (
    env("OUTREACH_MAILING_ADDRESS") ||
    env("BUSINESS_MAILING_ADDRESS") ||
    env("COMPANY_MAILING_ADDRESS") ||
    env("PUBLIC_BUSINESS_ADDRESS")
  ).trim()
}

function esc(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`
}

function normalizeAddress(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\b([a-z]{2})\s+\d{5}(?:-\d{4})?\b/g, "$1")
    .replace(/[.,#]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\bstreet\b/g, "st")
    .replace(/\bavenue\b/g, "av")
    .replace(/\broad\b/g, "rd")
    .replace(/\bdrive\b/g, "dr")
    .replace(/\bboulevard\b/g, "blvd")
}

function buildRunStamp() {
  const iso = new Date().toISOString().replace(/[:.]/g, "-")
  const nonce = Math.random().toString(36).slice(2, 8)
  return `${iso}-${process.pid}-${nonce}`
}

function isoDateDaysAgo(days) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString()
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"))
  } catch {
    return fallback
  }
}

const ROOT = process.cwd()
const OUTREACH_DIR = path.join(ROOT, "tmp", "outreach")
const SUPPRESSION_FILE = path.join(ROOT, "data", "outreach-suppressions.json")
const LIMIT = intArg("limit", 150, 1000)
const THROTTLE_MS = intArg("throttle", 1800, 30000)
const MIN_AGE_DAYS = intArg("min-age-days", 2, 30)
const BCC = getArg("bcc", "")
const OLDEST_SENT_AT = getArg("older-than", isoDateDaysAgo(MIN_AGE_DAYS))
const STRATEGY_FILTER = normalizeStrategy(getArg("strategy", ""))
const MARKET_FILTER = String(getArg("market", "")).trim().toLowerCase()

const LAND_WHOLESALE_STRATEGIES = new Set(["land-wholesale", "land-infill-lowball", "vacant-land-wholesale", "developer-land-arbitrage"])
const PORTFOLIO_STRATEGIES = new Set(["portfolio-landlord", "senior-landlord", "out-of-state-landlord", "landlord-portfolio", "small-multifamily-portfolio", "multifamily-portfolio", "portfolio-breakup", "2-20-unit-portfolio"])
const BUILDER_INFILL_STRATEGIES = new Set(["builder-infill-teardown", "infill-builder-teardown", "builder-teardown", "lot-assembly-builder"])
const NOVATION_RETAIL_STRATEGIES = new Set(["novation-retail-spread", "retail-spread-novation", "novation"])
const TAX_CODE_STRATEGIES = new Set(["tax-code-stack", "tax-delinquent-code-violation", "code-tax-stack", "lien-equity", "preforeclosure-equity", "vacant-equity"])

function normalizeStrategy(value) {
  return String(value || "seller-options")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "seller-options"
}

function splitLine(address) {
  return String(address || "").split(",")[0].trim() || "the property"
}

function loadSuppressions() {
  const rows = readJson(SUPPRESSION_FILE, [])
  if (!Array.isArray(rows)) return new Set()
  return new Set(
    rows
      .map((row) => normalizeEmailAddress(typeof row === "string" ? row : row?.email || ""))
      .filter(Boolean)
  )
}

function parseSentAtFromFilename(filename) {
  const match = String(filename || "").match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/)
  if (!match) return null
  return new Date(match[1].replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, "T$1:$2:$3.$4Z"))
}

function loadInitialSends() {
  const latestByEmail = new Map()
  if (!fs.existsSync(OUTREACH_DIR)) return latestByEmail

  for (const file of fs.readdirSync(OUTREACH_DIR)) {
    if (!file.startsWith("dealmachine-export-outreach-results-") || !file.endsWith(".json")) continue
    const fileSentAt = parseSentAtFromFilename(file)
    const rows = readJson(path.join(OUTREACH_DIR, file), [])
    if (!Array.isArray(rows)) continue

    for (const row of rows) {
      if (!row?.ok) continue
      const email = normalizeEmailAddress(row.email)
      if (!email) continue
      const existing = latestByEmail.get(email)
      const candidate = {
        email,
        strategy: normalizeStrategy(row.strategy),
        market: String(row.market || "").trim(),
        subject: String(row.subject || "").trim(),
        property_address_full: String(row.property_address_full || "").trim(),
        dealmachine_id: String(row.dealmachine_id || "").trim(),
        sent_from: String(row.sent_from || "").trim(),
        initial_sent_at: fileSentAt?.toISOString() || "",
        initial_result_file: file,
        command_center_lead_id: row.commandCenter?.leadId || "",
        command_center_message_id: row.commandCenter?.outreachMessageId || "",
      }
      if (!existing || String(candidate.initial_sent_at).localeCompare(String(existing.initial_sent_at)) > 0) {
        latestByEmail.set(email, candidate)
      }
    }
  }

  return latestByEmail
}

function loadFollowupHistory() {
  const alreadyFollowed = new Set()
  if (!fs.existsSync(OUTREACH_DIR)) return alreadyFollowed

  for (const file of fs.readdirSync(OUTREACH_DIR)) {
    if (!file.startsWith("dealmachine-export-followup-results-") || !file.endsWith(".json")) continue
    const rows = readJson(path.join(OUTREACH_DIR, file), [])
    if (!Array.isArray(rows)) continue
    for (const row of rows) {
      if (!row?.ok) continue
      const email = normalizeEmailAddress(row.email)
      if (email) alreadyFollowed.add(email)
    }
  }

  return alreadyFollowed
}

function loadDoNotContactAddresses() {
  const blocks = new Set()
  const rows = readJson(SUPPRESSION_FILE, [])
  if (Array.isArray(rows)) {
    for (const row of rows) {
      const email = normalizeEmailAddress(typeof row === "string" ? row : row?.email || "")
      if (email) blocks.add(normalizeAddress(String(typeof row === "object" ? row?.property_address || "" : "")))
    }
  }
  return blocks
}

function strategyAngle(strategy, propertyLine, market) {
  if (LAND_WHOLESALE_STRATEGIES.has(strategy)) {
    return `If it helps, I can quickly tell you whether ${propertyLine} looks more like a clean land sale, a builder/infill fit, or something that is better left alone.`
  }
  if (PORTFOLIO_STRATEGIES.has(strategy)) {
    return `If that property is part of a rental group, I can also look at whether it makes more sense as a single sale, small portfolio sale, or a slower exit on your timeline.`
  }
  if (BUILDER_INFILL_STRATEGIES.has(strategy)) {
    return `On this one, I would mainly be checking whether there is a realistic builder, teardown, or heavy-value-add angle before wasting your time.`
  }
  if (NOVATION_RETAIL_STRATEGIES.has(strategy)) {
    return `Sometimes a property like this is better handled with a retail-forward path instead of a straight discount sale, and I can tell you honestly if that seems realistic.`
  }
  if (TAX_CODE_STRATEGIES.has(strategy)) {
    return `My goal is not to throw out a blind low offer. I can just tell you whether ${propertyLine}${market ? ` in ${market}` : ""} looks like a real fit for an as-is sale, seller-carry conversation, or another off-market path.`
  }
  return `I am not trying to force a blind offer. I can simply tell you whether ${propertyLine} looks like a real fit for an as-is sale, seller-carry conversation, or another off-market option.`
}

function followupTimingLine(initialSentAt) {
  const sentAt = new Date(initialSentAt)
  if (Number.isNaN(sentAt.getTime())) return "I reached out earlier about"
  const ageDays = Math.max(0, Math.floor((Date.now() - sentAt.getTime()) / (24 * 60 * 60 * 1000)))
  if (ageDays <= 4) return "I reached out earlier this week about"
  if (ageDays <= 10) return "I reached out recently about"
  return "I reached out a little while back about"
}

function buildFollowup(copy) {
  const line = splitLine(copy.property_address_full)
  const marketLabel = copy.market ? copy.market.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()) : ""
  const angle = strategyAngle(copy.strategy, line, marketLabel)
  const subject = `Following up on ${line}`
  const timingLine = followupTimingLine(copy.initial_sent_at)
  const body = [
    "Hi,",
    "",
    `${timingLine} ${line}, and I wanted to follow up once before I close the file on my side.`,
    "",
    angle,
    "",
    "If you would be open to a quick conversation, just reply yes and I can send over a few practical options. If not, no problem at all.",
    "",
    "Best,",
    "Robert Sanders",
    "VestBlock",
    "acquisitions@vestblock.io",
    "(414) 687-6923",
    "",
    "VestBlock routes real estate conversations and is not a brokerage, lender, or closing agent. We do not guarantee offers, sale timelines, closing, or transaction outcomes.",
    'If this is not relevant, reply "unsubscribe" or "do not contact" and we will remove you from future outreach.',
    mailingAddress(),
  ]
    .join("\n")

  return { subject, body }
}

async function sendWithResend(resend, draft) {
  const payload = {
    from: sender(),
    to: draft.email,
    subject: draft.subject,
    text: draft.body,
  }
  if (BCC) payload.bcc = BCC
  const { data, error } = await resend.emails.send(payload)
  if (error) return { ok: false, error: error.message || "Resend send failed." }
  return { ok: true, id: data?.id || null }
}

async function main() {
  if (!mailingAddress()) throw new Error("Missing OUTREACH_MAILING_ADDRESS or BUSINESS_MAILING_ADDRESS.")
  if (SEND && !env("RESEND_API_KEY")) throw new Error("Missing RESEND_API_KEY.")

  const suppressions = loadSuppressions()
  const followed = loadFollowupHistory()
  const initial = loadInitialSends()
  const blockedAddresses = loadDoNotContactAddresses()
  const cutoff = new Date(OLDEST_SENT_AT)
  if (Number.isNaN(cutoff.getTime())) throw new Error(`Invalid --older-than date: ${OLDEST_SENT_AT}`)

  const eligible = []
  const skipped = []

  for (const row of initial.values()) {
    const email = normalizeEmailAddress(row.email)
    const addressKey = normalizeAddress(row.property_address_full)
    const emailIssue = getEmailQualityIssue(email)
    if (STRATEGY_FILTER && normalizeStrategy(row.strategy) !== STRATEGY_FILTER) {
      skipped.push({ email, property_address_full: row.property_address_full, reason: "strategy_filter_mismatch" })
      continue
    }
    if (MARKET_FILTER && String(row.market || "").trim().toLowerCase() !== MARKET_FILTER) {
      skipped.push({ email, property_address_full: row.property_address_full, reason: "market_filter_mismatch" })
      continue
    }
    if (emailIssue) {
      skipped.push({ email, property_address_full: row.property_address_full, reason: `email_quality:${emailIssue}` })
      continue
    }
    if (!row.initial_sent_at || new Date(row.initial_sent_at) > cutoff) {
      skipped.push({ email, property_address_full: row.property_address_full, reason: "too_recent_for_followup" })
      continue
    }
    if (suppressions.has(email)) {
      skipped.push({ email, property_address_full: row.property_address_full, reason: "suppressed_email" })
      continue
    }
    if (followed.has(email)) {
      skipped.push({ email, property_address_full: row.property_address_full, reason: "already_sent_followup" })
      continue
    }
    if (addressKey && blockedAddresses.has(addressKey)) {
      skipped.push({ email, property_address_full: row.property_address_full, reason: "suppressed_property_address" })
      continue
    }
    eligible.push({ ...row, ...buildFollowup(row) })
  }

  eligible.sort((a, b) => String(b.initial_sent_at).localeCompare(String(a.initial_sent_at)))
  const selected = eligible.slice(0, LIMIT)

  fs.mkdirSync(OUTREACH_DIR, { recursive: true })
  const stamp = buildRunStamp()
  const draftsJson = path.join(OUTREACH_DIR, `dealmachine-export-followup-drafts-${stamp}.json`)
  const draftsTxt = path.join(OUTREACH_DIR, `dealmachine-export-followup-drafts-${stamp}.txt`)
  const previewJson = path.join(OUTREACH_DIR, `dealmachine-export-followup-preview-${stamp}.json`)
  const resultsJson = path.join(OUTREACH_DIR, `dealmachine-export-followup-results-${stamp}.json`)
  const selectedCsv = path.join(OUTREACH_DIR, `dealmachine-export-followup-selected-${stamp}.csv`)

  const csvCols = [
    "email",
    "strategy",
    "market",
    "property_address_full",
    "dealmachine_id",
    "initial_sent_at",
    "initial_result_file",
    "subject",
  ]
  fs.writeFileSync(selectedCsv, [csvCols.join(","), ...selected.map((row) => csvCols.map((col) => esc(row[col])).join(","))].join("\n"))
  fs.writeFileSync(draftsJson, `${JSON.stringify(selected, null, 2)}\n`)
  fs.writeFileSync(
    draftsTxt,
    selected
      .map(
        (draft, index) =>
          `#${index + 1} ${draft.property_address_full} <${draft.email}>\nINITIAL: ${draft.initial_sent_at}\nSUBJECT: ${draft.subject}\n\n${draft.body}\n\n${"=".repeat(80)}\n`
      )
      .join("\n")
  )

  const preview = {
    ok: true,
    dryRun: !SEND,
    olderThan: cutoff.toISOString(),
    limit: LIMIT,
    throttleMs: THROTTLE_MS,
    strategyFilter: STRATEGY_FILTER || null,
    marketFilter: MARKET_FILTER || null,
    totalInitialCandidates: initial.size,
    eligible: eligible.length,
    selected: selected.length,
    skipped: skipped.length,
    skippedByReason: skipped.reduce((acc, row) => {
      acc[row.reason] = (acc[row.reason] || 0) + 1
      return acc
    }, {}),
    draftsJson,
    draftsTxt,
    selectedCsv,
    sample: selected.slice(0, 20).map((row) => ({
      email: row.email,
      strategy: row.strategy,
      market: row.market,
      property_address_full: row.property_address_full,
      initial_sent_at: row.initial_sent_at,
      subject: row.subject,
    })),
  }
  fs.writeFileSync(previewJson, `${JSON.stringify(preview, null, 2)}\n`)

  console.log("=== DealMachine export follow-up ===")
  console.log(`Mode:              ${SEND ? "LIVE SEND (Resend)" : "DRY RUN"}`)
  console.log(`Initial candidates:${initial.size}`)
  console.log(`Eligible:          ${eligible.length}`)
  console.log(`Selected:          ${selected.length}`)
  console.log(`Preview:           ${previewJson}`)
  console.log(`Draft review:      ${draftsTxt}`)

  if (!SEND || !selected.length) {
    console.log(SEND ? "No follow-up emails selected." : "Dry run only. Re-run with --send to deliver the selected follow-up batch.")
    return
  }

  const resend = new Resend(env("RESEND_API_KEY"))
  const results = []
  for (let index = 0; index < selected.length; index++) {
    const draft = selected[index]
    const result = await sendWithResend(resend, draft)
    results.push({
      email: draft.email,
      strategy: draft.strategy,
      market: draft.market,
      property_address_full: draft.property_address_full,
      dealmachine_id: draft.dealmachine_id,
      initial_sent_at: draft.initial_sent_at,
      initial_result_file: draft.initial_result_file,
      subject: draft.subject,
      sent_from: sender(),
      original_command_center_lead_id: draft.command_center_lead_id || "",
      original_command_center_message_id: draft.command_center_message_id || "",
      ...result,
    })
    console.log(`${result.ok ? "ok" : "failed"} ${index + 1}/${selected.length} ${draft.property_address_full} ${result.ok ? result.id : result.error}`)
    if (index < selected.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, THROTTLE_MS))
    }
  }

  fs.writeFileSync(resultsJson, `${JSON.stringify(results, null, 2)}\n`)
  const sent = results.filter((row) => row.ok).length
  console.log(`Done. Sent ${sent}/${results.length}; failed ${results.length - sent}.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
