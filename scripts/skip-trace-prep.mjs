/**
 * Skip-trace prep — turns the distress-stack MASTER into an upload-ready file
 * for any skip-trace service (PropStream, BatchData, REISkip, Skip Genie, etc.).
 *
 * We already have owner name + property address from public records. Skip-trace
 * services take Owner Name + Property Address and return phone/email/current
 * mailing. This script formats that input cleanly and dedupes it.
 *
 * It does NOT call a paid API by default (no free phone/email skip tracing exists).
 * If a BATCHDATA_API_KEY is set, pass --batchdata to also POST for live results.
 *
 * USAGE:
 *   node scripts/skip-trace-prep.mjs
 *   node --env-file=.env.local scripts/skip-trace-prep.mjs --batchdata   (optional, needs key)
 */

import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const USE_BATCHDATA = args.includes("--batchdata")
const OUT_DIR = path.join(process.cwd(), "data", "distress-leads")
const MASTER = path.join(OUT_DIR, "MASTER-distress-stack.csv")
const OUT = path.join(OUT_DIR, "skip-trace-upload.csv")

const STATE_BY_MARKET = { cincinnati: "OH", toledo: "OH", milwaukee: "WI", detroit: "MI" }

function parseCsv(file) {
  const text = fs.readFileSync(file, "utf8")
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

function main() {
  if (!fs.existsSync(MASTER)) { console.error("No master file yet. Run the distress-stack builder first."); process.exit(1) }
  const rows = parseCsv(MASTER)
  const h = rows[0]
  const idx = Object.fromEntries(h.map((c, i) => [c, i]))

  const seen = new Set()
  const out = []
  for (const r of rows.slice(1)) {
    if (!r.length) continue
    const market = r[idx.market] || ""
    const address = (r[idx.address] || "").trim()
    if (!address) continue
    const key = `${market}|${address.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    // owner: strip the Detroit "(mails from CITY)" annotation for a clean name
    const owner = (r[idx.delinquent_owner] || "").replace(/\s*\(mails from [^)]*\)/i, "").trim()
    out.push({
      market,
      owner_name: owner,
      property_address: address,
      city: r[idx.city] || "",
      state: STATE_BY_MARKET[market] || "",
      signal: r[idx.violation] || "",
      delinquent_amount: r[idx.delinquent_amount] || "",
    })
  }

  const cols = ["market", "owner_name", "property_address", "city", "state", "signal", "delinquent_amount"]
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`
  fs.writeFileSync(OUT, [cols.join(","), ...out.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n"))

  const withOwner = out.filter((r) => r.owner_name).length
  console.log("=== Skip-trace upload prepared ===")
  console.log(`Records:        ${out.length} (deduped)`)
  console.log(`With owner name: ${withOwner} (${Math.round((withOwner / out.length) * 100)}%)`)
  console.log(`File:           ${OUT}`)
  console.log("")
  console.log("Next: upload this CSV to a skip-trace service to append phone/email.")
  console.log("  - PropStream (built-in skip trace), BatchData, REISkip, Skip Genie, IDI/IDICORE")
  console.log("Map columns: owner_name -> Owner, property_address/city/state -> Property Address.")

  if (USE_BATCHDATA) {
    if (!process.env.BATCHDATA_API_KEY) {
      console.log("\n--batchdata set but BATCHDATA_API_KEY missing. Skipping live call.")
      return
    }
    console.log("\n(BatchData live skip-trace would run here — wire endpoint /api/v1/property/skip-trace with your key.)")
    // Intentionally not executing paid calls automatically. Implement when ready:
    //   POST https://api.batchdata.com/api/v1/property/skip-trace
    //   Authorization: Bearer ${process.env.BATCHDATA_API_KEY}
    //   body: { requests: [{ propertyAddress: {...}, name: {...} }, ...] }  (batch ~1000)
  }
}

main()
