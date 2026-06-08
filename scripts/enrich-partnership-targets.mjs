/**
 * Enrich + dedupe partnership targets (read-only, curl-based).
 *
 * Reads data/partnership-targets.csv, finds public emails from each site,
 * then removes ANY repeats:
 *   - internal duplicate emails
 *   - emails already present in the original buyers CSV (already-known)
 *   - companies already present (by normalized name) in the original buyers CSV
 *
 * Outputs:
 *   data/partnership-targets-enriched.csv  (clean, send-ready, unique only)
 *   prints a report of what was found and what was removed as a repeat.
 *
 * USAGE: node scripts/enrich-partnership-targets.mjs
 */

import fs from "node:fs"
import path from "node:path"
import { execFile } from "node:child_process"

const IN_CSV = path.join(process.cwd(), "data", "partnership-targets.csv")
const OUT_CSV = path.join(process.cwd(), "data", "partnership-targets-enriched.csv")
const KNOWN_CSV =
  "/Users/mrsanders/Library/Mobile Documents/com~apple~CloudDocs/vestblock_expansion_buyers_all_markets.csv"

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const JUNK = [
  "example.com", "sentry", "wixpress", "wix.com", "squarespace", "godaddy", "cloudflare",
  "schema.org", "w3.org", "googleapis", "gstatic", "fontawesome", "jquery", "bootstrapcdn",
  "youtube", "facebook", "twitter", "instagram", "linkedin", ".png", ".jpg", ".jpeg", ".gif",
  ".svg", ".webp", "core.windows.net", "domain.com", "email.com", "yourdomain", "sentry.io",
]
const JUNK_LOCAL = /^(your|yourname|jane|john|test|name|sample|example|firstname|lastname|user|email)$/i

function parseCsv(text) {
  const rows = []
  let row = [], f = "", q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1]
    if (q) {
      if (c === '"' && n === '"') { f += '"'; i++ }
      else if (c === '"') q = false
      else f += c
    } else if (c === '"') q = true
    else if (c === ",") { row.push(f); f = "" }
    else if (c === "\n" || c === "\r") { if (c === "\r" && n === "\n") i++; if (f !== "" || row.length) { row.push(f); rows.push(row); row = []; f = "" } }
    else f += c
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row) }
  return rows
}

const normName = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "")
const rootDomain = (site) => {
  try { const h = new URL(site.startsWith("http") ? site : "https://" + site).hostname.replace(/^www\./, ""); const p = h.split("."); return p.length >= 2 ? p.slice(-2).join(".") : h } catch { return "" }
}
function curl(url) {
  return new Promise((res) => execFile("curl", ["-sL", "--max-time", "15", "--max-redirs", "5", "-A", UA, url], { maxBuffer: 5 * 1024 * 1024 }, (e, out) => res(e ? "" : out || "")))
}
function extractEmails(html, dom) {
  if (!html) return []
  const found = new Set()
  let m; const re = /mailto:([^"'?>\s]+)/gi
  while ((m = re.exec(html))) { const e = decodeURIComponent(m[1]).trim().toLowerCase(); if (e.includes("@")) found.add(e) }
  ;(html.match(EMAIL_RE) || []).forEach((e) => found.add(e.trim().toLowerCase()))
  return [...found].filter((e) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return false
    if (e.length > 60) return false
    if (JUNK.some((j) => e.includes(j))) return false
    if (JUNK_LOCAL.test(e.split("@")[0])) return false
    if (/\.(png|jpe?g|gif|svg|webp|css|js|woff2?)$/i.test(e)) return false
    if (/^[a-f0-9]{16,}@/.test(e)) return false
    return true
  })
}
function rank(emails, dom) {
  const score = (e) => {
    const [l, d] = e.split("@"); let s = 0
    if (dom && d.includes(dom)) s += 50
    if (/acquisition|acq|deals?|invest|buy|offers?|loans?|lending/.test(l)) s += 30
    else if (/^(info|contact|hello|hi|team|admin|office)$/.test(l)) s += 20
    else if (/^(sales|support|help)$/.test(l)) s += 10
    else if (/^[a-z]+\.?[a-z]*$/.test(l)) s += 8
    if (/noreply|no-reply|donotreply|postmaster|abuse|privacy|legal|webmaster/.test(l)) s -= 40
    return s
  }
  return [...emails].sort((a, b) => score(b) - score(a))
}

async function enrichOne(entry) {
  const base = (entry.website || "").startsWith("http") ? entry.website : "https://" + entry.website
  const dom = rootDomain(base)
  const pages = [base, `${base}/contact`, `${base}/contact-us`, `${base}/about`, `${base}/about-us`]
  const set = new Set(); let src = ""
  for (const p of pages) {
    const emails = extractEmails(await curl(p), dom)
    if (emails.length && !src) src = p
    emails.forEach((e) => set.add(e))
    if (set.size >= 3 && p.includes("/contact")) break
  }
  const ranked = rank([...set], dom)
  const best = ranked[0] || ""
  return { ...entry, email: best, sameDomain: best ? best.split("@")[1]?.includes(dom) : false, source: src }
}

async function main() {
  // load targets
  const rows = parseCsv(fs.readFileSync(IN_CSV, "utf8"))
  const h = rows[0].map((x) => x.trim().toLowerCase())
  const ci = (n) => h.indexOf(n)
  const targets = rows.slice(1).filter((r) => r.length >= h.length).map((r) => ({
    market: r[ci("market")], company: r[ci("company_name")], buyer_type: r[ci("buyer_type")],
    role: r[ci("contact_title")], website: r[ci("website")], category: r[ci("estimated_volume")], notes: r[ci("notes")],
  }))

  // known set from original CSV
  const known = { emails: new Set(), names: new Set() }
  if (fs.existsSync(KNOWN_CSV)) {
    const kr = parseCsv(fs.readFileSync(KNOWN_CSV, "utf8"))
    const kh = kr[0].map((x) => x.trim().toLowerCase())
    const kci = (n) => kh.indexOf(n)
    for (const r of kr.slice(1)) {
      const e = (r[kci("email")] || "").trim().toLowerCase()
      const c = r[kci("company_name")] || ""
      if (e) known.emails.add(e)
      if (c) known.names.add(normName(c))
    }
  }

  console.log(`Enriching ${targets.length} targets (read-only)...  known emails: ${known.emails.size}, known names: ${known.names.size}\n`)

  const enriched = []
  const CONC = 6
  let idx = 0
  await Promise.all(Array.from({ length: CONC }, async () => {
    while (idx < targets.length) { const i = idx++; enriched[i] = await enrichOne(targets[i]) }
  }))

  // dedupe
  const seen = new Set()
  const clean = [], repeats = [], noEmail = []
  for (const e of enriched) {
    if (!e.email) { noEmail.push(e); continue }
    const em = e.email.toLowerCase()
    if (known.emails.has(em)) { repeats.push({ ...e, reason: "email already contacted" }); continue }
    if (known.names.has(normName(e.company))) { repeats.push({ ...e, reason: "company already in list" }); continue }
    if (seen.has(em)) { repeats.push({ ...e, reason: "duplicate in this batch" }); continue }
    seen.add(em)
    clean.push(e)
  }

  // write clean send-ready CSV (outreach schema)
  const cols = ["market", "region", "company_name", "buyer_type", "contact_person", "contact_title", "phone", "email", "website", "estimated_volume", "wholesale_friendly", "notes"]
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`
  const out = clean.map((e) => ({ market: e.market, region: "", company_name: e.company, buyer_type: e.buyer_type, contact_person: "", contact_title: e.role, phone: "", email: e.email, website: e.website, estimated_volume: e.category, wholesale_friendly: "", notes: e.notes }))
  fs.writeFileSync(OUT_CSV, [cols.join(","), ...out.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n"))

  console.log("=== CLEAN (unique, send-ready) ===")
  clean.forEach((e, i) => console.log(`${String(i + 1).padStart(2)}. [${e.sameDomain ? "high" : "med"}] ${e.company} <${e.email}>`))
  console.log(`\n=== REPEATS REMOVED (${repeats.length}) ===`)
  repeats.forEach((e) => console.log(`  - ${e.company} <${e.email}> (${e.reason})`))
  console.log(`\n=== NO EMAIL FOUND (${noEmail.length}) ===`)
  noEmail.forEach((e) => console.log(`  - ${e.company} (${e.website})`))
  console.log(`\nSummary: ${clean.length} unique  |  ${repeats.length} repeats removed  |  ${noEmail.length} no-email`)
  console.log(`Wrote: ${OUT_CSV}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
