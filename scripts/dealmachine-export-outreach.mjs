/**
 * DealMachine export outreach for VestBlock.
 *
 * Matches Atlas-exported DealMachine contact CSVs against ranked market queues,
 * builds property-specific owner outreach, sends email through Resend, and
 * writes a DNC-aware phone queue for Messages.
 *
 * Usage:
 *   node --env-file=.env.local scripts/dealmachine-export-outreach.mjs
 *   node --env-file=.env.local scripts/dealmachine-export-outreach.mjs --limit=150 --send
 */

import { Resend } from "resend"
import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const SEND = args.includes("--send")
const getArg = (name) => {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : null
}

const LIMIT = getArg("limit") ? Number.parseInt(getArg("limit"), 10) : 150
const THROTTLE_MS = getArg("throttle") ? Number.parseInt(getArg("throttle"), 10) : 1800
const OUT_DIR = path.join(process.cwd(), "data", "distress-leads")
const OUTREACH_DIR = path.join(process.cwd(), "tmp", "outreach")
const BCC = getArg("bcc") || ""
const CONFIG_FILE = getArg("config-file")

const DEFAULT_MARKET_CONFIGS = [
  {
    market: "milwaukee",
    queueCsv: path.join(OUT_DIR, "dealmachine-api-milwaukee-wi-atlas-export-needed.csv"),
    exportCsv: "/Users/mrsanders/Downloads/dealmachine-contacts-2026-06-05-130846.csv",
  },
  {
    market: "toledo",
    queueCsv: path.join(OUT_DIR, "dealmachine-api-toledo-oh-atlas-export-needed.csv"),
    exportCsv: "/Users/mrsanders/Downloads/dealmachine-contacts-2026-06-05-123802.csv",
  },
]

function loadMarketConfigs() {
  if (!CONFIG_FILE) return DEFAULT_MARKET_CONFIGS
  const file = path.resolve(CONFIG_FILE)
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"))
  if (!Array.isArray(parsed)) throw new Error("Config file must be a JSON array.")
  return parsed.map((entry) => ({
    market: String(entry.market || "").trim(),
    queueCsv: String(entry.queueCsv || "").trim(),
    exportCsv: String(entry.exportCsv || "").trim(),
  }))
}

function env(name) {
  return String(process.env[name] || "").trim()
}

function sender() {
  return env("FROM_EMAIL") || "contact@vestblock.io"
}

function mailingAddress() {
  return (
    env("OUTREACH_MAILING_ADDRESS") ||
    env("BUSINESS_MAILING_ADDRESS") ||
    env("COMPANY_MAILING_ADDRESS") ||
    env("PUBLIC_BUSINESS_ADDRESS")
  )
}

function esc(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`
}

function parseCsvText(text) {
  const rows = []
  let row = []
  let field = ""
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ",") {
      row.push(field)
      field = ""
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && next === "\n") i++
      if (field !== "" || row.length) {
        row.push(field)
        rows.push(row)
        row = []
        field = ""
      }
    } else {
      field += char
    }
  }
  if (field !== "" || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function loadCsv(file) {
  const rows = parseCsvText(fs.readFileSync(file, "utf8"))
  const header = rows[0] || []
  return rows.slice(1).map((values) => Object.fromEntries(header.map((col, index) => [String(col || "").trim(), String(values[index] || "").trim()])))
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

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim())
}

function isUsableOwnerEmail(value) {
  const email = String(value || "").trim().toLowerCase()
  if (!isEmail(email)) return false
  if (/@vestblock\.io$/i.test(email)) return false
  if (/(^|@)(example\.com|email\.com|address\.com)$/i.test(email)) return false
  return true
}

function firstNameFromOwnerName(ownerName) {
  if (/\b(llc|inc|corp|corporation|company|co\.|partners|holdings|trust|church|city|county|fund|lp)\b/i.test(String(ownerName || ""))) {
    return "there"
  }
  const first = String(ownerName || "")
    .trim()
    .split(/\s+/)
    .find((part) => /[a-z]/i.test(part))
  if (!first || first.length < 2) return "there"
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
}

function pathLabelList(value) {
  const labels = String(value || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((path) => {
      if (path === "fast_cash") return "a fast cash review"
      if (path === "creative_structure") return "a creative structure"
      if (path === "novation") return "a market-assisted sale"
      if (path === "rental_hold") return "a rental-buyer review"
      if (path === "lender_review") return "funding partner review"
      return path.replace(/_/g, " ")
    })

  return [...new Set(labels)].filter((label) => label !== "manual review").slice(0, 4).join(", ")
}

function buildEmail(contact) {
  const property = contact.property_address_full
  const pathLine = pathLabelList(contact.suggested_exit_paths)
  const subject = `Question about ${property.split(",")[0]}`
  const body = [
    `Hi ${contact.first_name},`,
    "",
    `I'm Robert with VestBlock. I wanted to ask about ${property}.`,
    "",
    `I came across this property while reviewing local off-market and distress opportunities in ${contact.market_label}.`,
    contact.tax_delinquent === "Yes"
      ? "I also see a tax-delinquent signal on the file, which is one reason it landed on my review list."
      : "The property came through my review list, so I wanted to ask directly instead of assuming anything.",
    "",
    "If it would help, I can review this specific property and walk through several options. I am not sending a blind offer or promising a closing; I only want to see whether one of those options is realistic for this property.",
    pathLine ? `For this address, the review may include ${pathLine}.` : "",
    "",
    `Would you be open to a quick conversation about ${property.split(",")[0]}, or is this not something you want to discuss right now?`,
    "",
    "Best,",
    "Robert Sanders",
    "VestBlock",
    "contact@vestblock.io",
    "(414) 687-6923",
    "",
    "VestBlock routes real estate conversations and is not a brokerage, lender, or closing agent. We do not guarantee funding, approvals, sale timelines, or transaction outcomes.",
    'If this is not relevant, reply "unsubscribe" or "do not contact" and we will remove you from future outreach.',
    mailingAddress(),
  ]
    .filter(Boolean)
    .join("\n")
  return { subject, body }
}

function buildText(contact) {
  const line = contact.property_address_full.split(",")[0]
  const pathLine = pathLabelList(contact.suggested_exit_paths)
  return `Hi, this is Robert with VestBlock. I wanted to ask whether you would consider options for ${line}${pathLine ? `, including ${pathLine}` : ""}. Reply STOP and I will not message again.`
}

function isTextablePhone(phone) {
  const type = String(phone?.type || "").trim().toLowerCase()
  const dnc = String(phone?.dnc || "").trim().toLowerCase()
  if (/do not call/.test(dnc)) return false
  if (type === "landline") return false
  if (!/(mobile|wireless|cell)/.test(type)) return false
  return Boolean(String(phone?.number || "").trim())
}

function loadAlreadySent() {
  const sent = new Set()
  if (!fs.existsSync(OUTREACH_DIR)) return sent
  for (const file of fs.readdirSync(OUTREACH_DIR)) {
    if (!file.startsWith("dealmachine-export-outreach-results-") || !file.endsWith(".json")) continue
    try {
      const rows = JSON.parse(fs.readFileSync(path.join(OUTREACH_DIR, file), "utf8"))
      if (!Array.isArray(rows)) continue
      for (const row of rows) {
        if (row?.ok && row?.email) sent.add(String(row.email).toLowerCase())
      }
    } catch {}
  }
  return sent
}

function loadMatches() {
  const contacts = []
  for (const config of loadMarketConfigs()) {
    if (!fs.existsSync(config.queueCsv) || !fs.existsSync(config.exportCsv)) continue
    const queueRows = loadCsv(config.queueCsv)
    const exportRows = loadCsv(config.exportCsv)
    const byAddress = new Map()
    for (const row of exportRows) {
      const key = normalizeAddress(row.associated_property_address_full)
      if (!key) continue
      const bucket = byAddress.get(key) || []
      bucket.push(row)
      byAddress.set(key, bucket)
    }

    for (const queue of queueRows) {
      const hits = byAddress.get(normalizeAddress(queue.property_address_full)) || []
      if (!hits.length) continue

      const marketLabel = `${queue.market_city}, ${queue.market_state}`
      for (const hit of hits) {
        const ownerName = `${hit.first_name || ""} ${hit.last_name || ""}`.trim() || queue.owner_name
        const firstName = hit.first_name || firstNameFromOwnerName(ownerName)
        const emails = [hit.email_address_1, hit.email_address_2, hit.email_address_3].filter(isUsableOwnerEmail)
        const phones = [1, 2, 3]
          .map((index) => ({
            number: String(hit[`phone_${index}`] || "").trim(),
            dnc: String(hit[`phone_${index}_do_not_call`] || "").trim(),
            type: String(hit[`phone_${index}_type`] || "").trim(),
          }))
          .filter((entry) => entry.number)

        contacts.push({
          market: config.market,
          market_label: marketLabel,
          property_address_full: queue.property_address_full,
          owner_name: ownerName,
          first_name: firstName || "there",
          tax_delinquent: queue.tax_delinquent,
          estimated_value: queue.estimated_value,
          rent_estimate: queue.rent_estimate,
          estimated_ltv: queue.estimated_ltv,
          cash_review_low: queue.cash_review_low,
          cash_review_high: queue.cash_review_high,
          suggested_exit_paths: queue.suggested_exit_paths,
          buyer_packet_summary: queue.buyer_packet_summary,
          lender_packet_summary: queue.lender_packet_summary,
          distress_score: Number.parseInt(queue.distress_score || "0", 10) || 0,
          dealmachine_id: queue.dealmachine_id,
          emails,
          phones,
        })
      }
    }
  }
  return contacts
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function main() {
  if (SEND && !env("RESEND_API_KEY")) throw new Error("Missing RESEND_API_KEY.")
  if (SEND && !mailingAddress()) throw new Error("Missing OUTREACH_MAILING_ADDRESS or BUSINESS_MAILING_ADDRESS.")

  fs.mkdirSync(OUTREACH_DIR, { recursive: true })
  const alreadySent = loadAlreadySent()
  const rawContacts = loadMatches().sort((a, b) => b.distress_score - a.distress_score || a.property_address_full.localeCompare(b.property_address_full))

  const emailDrafts = []
  const phoneQueue = []
  const seenEmail = new Set()
  const seenPhone = new Set()

  for (const contact of rawContacts) {
    for (const email of contact.emails) {
      const key = `${contact.property_address_full}|${email.toLowerCase()}`
      if (seenEmail.has(key) || alreadySent.has(email.toLowerCase())) continue
      seenEmail.add(key)
      emailDrafts.push({
        market: contact.market,
        property_address_full: contact.property_address_full,
        owner_name: contact.owner_name,
        dealmachine_id: contact.dealmachine_id,
        email: email.toLowerCase(),
        first_name: contact.first_name,
        tax_delinquent: contact.tax_delinquent,
        estimated_value: contact.estimated_value,
        rent_estimate: contact.rent_estimate,
        estimated_ltv: contact.estimated_ltv,
        cash_review_low: contact.cash_review_low,
        cash_review_high: contact.cash_review_high,
        suggested_exit_paths: contact.suggested_exit_paths,
        buyer_packet_summary: contact.buyer_packet_summary,
        lender_packet_summary: contact.lender_packet_summary,
        distress_score: contact.distress_score,
        ...buildEmail(contact),
      })
    }

    for (const phone of contact.phones) {
      const key = `${contact.property_address_full}|${phone.number}`
      if (seenPhone.has(key)) continue
      seenPhone.add(key)
      if (!isTextablePhone(phone)) continue
      phoneQueue.push({
        market: contact.market,
        property_address_full: contact.property_address_full,
        owner_name: contact.owner_name,
        dealmachine_id: contact.dealmachine_id,
        phone: phone.number,
        do_not_call: phone.dnc,
        phone_type: phone.type,
        can_text: isTextablePhone(phone) ? "true" : "false",
        suggested_exit_paths: contact.suggested_exit_paths,
        buyer_packet_summary: contact.buyer_packet_summary,
        lender_packet_summary: contact.lender_packet_summary,
        distress_score: contact.distress_score,
        text_message: buildText(contact),
      })
    }
  }

  const selectedDrafts = emailDrafts.slice(0, LIMIT)
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const emailCsv = path.join(OUT_DIR, `dealmachine-export-owner-email-ready-${stamp}.csv`)
  const phoneCsv = path.join(OUT_DIR, `dealmachine-export-phone-queue-${stamp}.csv`)
  const draftsJson = path.join(OUTREACH_DIR, `dealmachine-export-outreach-drafts-${stamp}.json`)
  const draftsTxt = path.join(OUTREACH_DIR, `dealmachine-export-outreach-drafts-${stamp}.txt`)

  const emailCols = [
    "market",
    "property_address_full",
    "owner_name",
    "dealmachine_id",
    "email",
    "first_name",
    "tax_delinquent",
    "estimated_value",
    "rent_estimate",
    "estimated_ltv",
    "cash_review_low",
    "cash_review_high",
    "suggested_exit_paths",
    "buyer_packet_summary",
    "lender_packet_summary",
    "distress_score",
    "subject",
    "body",
  ]
  fs.writeFileSync(emailCsv, [emailCols.join(","), ...selectedDrafts.map((row) => emailCols.map((col) => esc(row[col])).join(","))].join("\n"))

  const phoneCols = [
    "market",
    "property_address_full",
    "owner_name",
    "dealmachine_id",
    "phone",
    "do_not_call",
    "phone_type",
    "can_text",
    "suggested_exit_paths",
    "buyer_packet_summary",
    "lender_packet_summary",
    "distress_score",
    "text_message",
  ]
  fs.writeFileSync(phoneCsv, [phoneCols.join(","), ...phoneQueue.map((row) => phoneCols.map((col) => esc(row[col])).join(","))].join("\n"))

  fs.writeFileSync(draftsJson, JSON.stringify(selectedDrafts, null, 2))
  fs.writeFileSync(
    draftsTxt,
    selectedDrafts
      .map((draft, index) => `#${index + 1} ${draft.property_address_full} <${draft.email}>\nSUBJECT: ${draft.subject}\n\n${draft.body}\n\n${"=".repeat(80)}\n`)
      .join("\n")
  )

  console.log("=== DealMachine export outreach ===")
  console.log(`Mode:           ${SEND ? "LIVE SEND (Resend)" : "DRY RUN"}`)
  console.log(`Matched emails: ${emailDrafts.length}`)
  console.log(`Selected send:  ${selectedDrafts.length}`)
  console.log(`Phone queue:    ${phoneQueue.length}`)
  console.log(`Email CSV:      ${emailCsv}`)
  console.log(`Phone CSV:      ${phoneCsv}`)
  console.log(`Draft review:   ${draftsTxt}`)

  if (!SEND || !selectedDrafts.length) {
    console.log(SEND ? "No selected drafts to send." : "Dry run only. Re-run with --send to deliver through Resend.")
    return
  }

  const resend = new Resend(env("RESEND_API_KEY"))
  const results = []
  for (let index = 0; index < selectedDrafts.length; index++) {
    const draft = selectedDrafts[index]
    const result = await sendWithResend(resend, draft)
    results.push({
      email: draft.email,
      property_address_full: draft.property_address_full,
      dealmachine_id: draft.dealmachine_id,
      ...result,
    })
    console.log(`${result.ok ? "ok" : "failed"} ${index + 1}/${selectedDrafts.length} ${draft.property_address_full} ${result.ok ? result.id : result.error}`)
    if (index < selectedDrafts.length - 1) await sleep(THROTTLE_MS)
  }

  fs.writeFileSync(path.join(OUTREACH_DIR, `dealmachine-export-outreach-results-${stamp}.json`), JSON.stringify(results, null, 2))
  const sent = results.filter((row) => row.ok).length
  console.log(`Done. Sent ${sent}/${results.length}; failed ${results.length - sent}.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
