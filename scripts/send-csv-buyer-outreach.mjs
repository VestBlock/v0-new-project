/**
 * VestBlock — CSV outreach via Resend.
 *
 * DRY RUN BY DEFAULT. Nothing sends unless you pass --send.
 *   node --env-file=.env.local scripts/send-csv-buyer-outreach.mjs --csv=data/partnership-targets-enriched.csv
 *   node --env-file=.env.local scripts/send-csv-buyer-outreach.mjs --csv=data/partnership-targets-enriched.csv --send --bcc=vestblockio@gmail.com
 *   ...optional: --limit=10  --only=lender,reia  --throttle=1500  --no-skip-sent
 *
 * Reads a CSV (market, company_name, buyer_type, contact_title, email, website, notes...),
 * segments by buyer_type, writes review files to tmp/outreach/, dedupes against prior
 * sends, and (with --send) delivers throttled via Resend with a CAN-SPAM-aware footer.
 */

import { Resend } from "resend"
import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const SEND = args.includes("--send")
const getArg = (n) => { const h = args.find((a) => a.startsWith(`--${n}=`)); return h ? h.split("=").slice(1).join("=") : null }
const CSV_PATH = getArg("csv") || "data/partnership-targets-enriched.csv"
const LIMIT = getArg("limit") ? parseInt(getArg("limit"), 10) : null
const ONLY = getArg("only") ? getArg("only").split(",").map((s) => s.trim().toLowerCase()) : null
const THROTTLE_MS = getArg("throttle") ? parseInt(getArg("throttle"), 10) : 1500
const BCC = getArg("bcc") || null
const SKIP_SENT = !args.includes("--no-skip-sent")

const SIGNATURE = "Robert Sanders\nVestBlock\ncontact@vestblock.io\n(414) 687-6923"
const FOOTER =
  'VestBlock connects sellers, buyers, and lenders around real estate opportunities and is not a lender, broker, or closing agent. ' +
  'We present opportunities based on fit and truthful information and do not promise guaranteed deal volume, funding, or outcomes. ' +
  'If you would prefer not to receive these messages, reply "unsubscribe" and we will remove you.'

function parseCsv(text) {
  const rows = []; let row = [], f = "", q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1]
    if (q) { if (c === '"' && n === '"') { f += '"'; i++ } else if (c === '"') q = false; else f += c }
    else if (c === '"') q = true
    else if (c === ",") { row.push(f); f = "" }
    else if (c === "\n" || c === "\r") { if (c === "\r" && n === "\n") i++; if (f !== "" || row.length) { row.push(f); rows.push(row); row = []; f = "" } }
    else f += c
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row) }
  return rows
}
const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

function classify(buyerType) {
  const t = (buyerType || "").toLowerCase()
  if (t.includes("reia")) return "reia"
  if (t.includes("hard money") || t.includes("lend") || t.includes("bridge") || t.includes("dscr")) return "lender"
  if (t.includes("software") || t.includes("platform") || t.includes("referral")) return "partner"
  return "buyer"
}

function buildMessage(seg, c) {
  const company = c.company || "your team"
  const market = c.market ? ` in the ${c.market} market` : ""
  const greeting = `Hi ${company} team,`
  const t = {
    buyer: {
      subject: `Off-market deal flow for ${company}${c.market ? ` (${c.market})` : ""}`,
      body: `${greeting}\n\nI'm reaching out from VestBlock. We organize off-market seller and distressed-property opportunities before they're broadly shopped, and connect them with local buyers who can actually move${market}.\n\nRather than blasting mismatched inventory, we'd rather share a few opportunities that fit your real buy box on market, price range, and condition. If you're open to outside opportunities, I'd like to learn your criteria and send matches when they line up.\n\nIf there's a better contact or intake path, I'd appreciate the pointer.\n\nThanks,\n${SIGNATURE}\n\n—\n${FOOTER}`,
    },
    lender: {
      subject: `Local borrower deals that match ${company}'s lending box`,
      body: `${greeting}\n\nI'm with VestBlock. We connect real estate borrower and deal opportunities to local lenders based on their actual lending box — states, loan size, asset type, and borrower fit — instead of sending volume that doesn't match.\n\nIf you share the criteria you actually want${market}, we can route better-fit deals to your team for review as they come through our seller and operator pipeline. Fewer, cleaner conversations, not noise.\n\nIf there's a preferred contact or intake format for new deal flow, I'd appreciate it.\n\nBest,\n${SIGNATURE}\n\n—\n${FOOTER}`,
    },
    reia: {
      subject: `A partnership idea for ${company} members`,
      body: `${greeting}\n\nI'm reaching out from VestBlock. We connect sellers, buyers, and lenders around real estate opportunities, plus DealVault — a way to keep clean, verifiable records of agreements, payouts, and milestones.\n\nYour members are exactly who this serves${market}: cleaner off-market deal flow, a simple intake so opportunities get matched, and proof records when accountability matters. I'd love to explore whether a member benefit, vendor relationship, or a short session for your group makes sense.\n\nIf you handle partnerships or speakers, I'd appreciate being pointed to the right person.\n\nBest,\n${SIGNATURE}\n\n—\n${FOOTER}`,
    },
    partner: {
      subject: `Partnership: VestBlock + ${company}`,
      body: `${greeting}\n\nI'm with VestBlock — we connect sellers, buyers, and lenders around real estate opportunities, with a DealVault proof layer for agreements and payouts.\n\nGiven what ${company} does${market}, there may be a natural partnership or referral fit. I'd like to compare notes and see if connecting deal flow between us makes sense.\n\nIf there's a better contact for partnerships, I'd appreciate the pointer.\n\nBest,\n${SIGNATURE}\n\n—\n${FOOTER}`,
    },
  }
  return t[seg] || t.buyer
}

function getSender() { return process.env.FROM_EMAIL || "contact@vestblock.io" }
async function sendWithResend(resend, { recipient, subject, body }) {
  const payload = { from: getSender(), to: recipient, subject, text: body }
  if (BCC) payload.bcc = BCC
  const { data, error } = await resend.emails.send(payload)
  if (error) return { ok: false, error: error.message || "Resend send failed." }
  return { ok: true, id: data?.id || null }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function loadAlreadyContacted(outDir) {
  const set = new Set()
  if (!fs.existsSync(outDir)) return set
  for (const f of fs.readdirSync(outDir).filter((x) => x.startsWith("csv-outreach-results-") && x.endsWith(".json"))) {
    try { JSON.parse(fs.readFileSync(path.join(outDir, f), "utf8")).forEach((r) => { if (r.ok && r.email) set.add(r.email.toLowerCase()) }) } catch {}
  }
  return set
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) { console.error(`CSV not found: ${CSV_PATH}`); process.exit(1) }
  const rows = parseCsv(fs.readFileSync(CSV_PATH, "utf8"))
  const h = rows[0].map((x) => x.trim().toLowerCase())
  const ci = (n) => h.indexOf(n)
  const outDir = path.join(process.cwd(), "tmp", "outreach")
  const already = SKIP_SENT ? loadAlreadyContacted(outDir) : new Set()

  const seen = new Set()
  const contacts = []
  let skippedAlready = 0
  for (const r of rows.slice(1)) {
    if (!r || r.length < h.length) continue
    const email = (r[ci("email")] || "").trim().toLowerCase()
    if (!email || !isEmail(email)) continue
    if (seen.has(email)) continue
    seen.add(email)
    if (already.has(email)) { skippedAlready++; continue }
    const seg = classify(r[ci("buyer_type")])
    if (ONLY && !ONLY.includes(seg)) continue
    contacts.push({ email, company: (r[ci("company_name")] || "").trim(), market: (r[ci("market")] || "").trim(), seg })
  }

  const selected = LIMIT ? contacts.slice(0, LIMIT) : contacts
  const drafts = selected.map((c) => { const m = buildMessage(c.seg, c); return { ...c, subject: m.subject, body: m.body } })
  const bySeg = drafts.reduce((a, d) => { a[d.seg] = (a[d.seg] || 0) + 1; return a }, {})

  fs.mkdirSync(outDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  fs.writeFileSync(path.join(outDir, `csv-outreach-${stamp}.json`), JSON.stringify(drafts, null, 2))
  fs.writeFileSync(path.join(outDir, `csv-outreach-${stamp}.txt`), drafts.map((d, i) => `#${i + 1} [${d.seg}] ${d.company} <${d.email}>\nSUBJECT: ${d.subject}\n\n${d.body}\n\n${"=".repeat(80)}\n`).join("\n"))

  console.log("VestBlock CSV Outreach")
  console.log("======================")
  console.log(`CSV:            ${CSV_PATH}`)
  console.log(`Mode:           ${SEND ? "LIVE SEND (Resend)" : "DRY RUN (no emails sent)"}`)
  console.log(`Recipients:     ${drafts.length}${LIMIT ? ` (capped at ${LIMIT})` : ""}`)
  console.log(`Skipped (sent): ${skippedAlready}`)
  console.log(`BCC copy:       ${BCC || "none"}`)
  console.log(`By segment:     ${JSON.stringify(bySeg)}`)

  if (!SEND) {
    console.log(`\nDRY RUN complete. Review tmp/outreach/csv-outreach-${stamp}.txt, then re-run with --send.`)
    return
  }
  if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) { console.error("\nMissing RESEND_API_KEY or FROM_EMAIL."); process.exit(1) }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const results = []
  console.log(`\nSending from: ${getSender()} | throttle: ${THROTTLE_MS}ms\n`)
  for (let i = 0; i < drafts.length; i++) {
    const d = drafts[i]
    const res = await sendWithResend(resend, { recipient: d.email, subject: d.subject, body: d.body })
    results.push({ email: d.email, company: d.company, segment: d.seg, ...res })
    console.log(`${res.ok ? "✓" : "✗"} ${i + 1}/${drafts.length} ${d.company} <${d.email}> ${res.ok ? res.id : res.error}`)
    if (i < drafts.length - 1) await sleep(THROTTLE_MS)
  }
  const sent = results.filter((r) => r.ok).length
  fs.writeFileSync(path.join(outDir, `csv-outreach-results-${stamp}.json`), JSON.stringify(results, null, 2))
  console.log(`\nDone. Sent: ${sent} | Failed: ${results.length - sent}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
