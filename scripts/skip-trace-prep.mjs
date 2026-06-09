/**
 * Skip-trace prep — turns the distress-stack MASTER into an upload-ready file
 * for DealMachine or any other skip-trace service.
 *
 * We already have owner name + property address from public records.
 * Upload this file to DealMachine → Lists → Import to run skip-trace,
 * then export the Contacts CSV from DealMachine and place it in data/dm-exports/.
 *
 * USAGE:
 *   node scripts/skip-trace-prep.mjs
 *   node scripts/skip-trace-prep.mjs --market=philadelphia
 */

import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const getArg = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : null
}
const MARKET_FILTER = (getArg("market") || "").toLowerCase().trim()

const OUT_DIR = path.join(process.cwd(), "data", "distress-leads")
const MASTER = path.join(OUT_DIR, "MASTER-distress-stack.csv")
const OUT = path.join(OUT_DIR, "skip-trace-upload.csv")

const STATE_BY_MARKET = { cincinnati: "OH", toledo: "OH", milwaukee: "WI", detroit: "MI", columbus: "OH" }

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
    const market = (r[idx.market] || "").trim().toLowerCase()
    const address = (r[idx.address] || "").trim()
    if (!address || !market) continue
    if (MARKET_FILTER && !market.includes(MARKET_FILTER)) continue
    const key = `${market}|${address.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
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
  console.log(`Records:         ${out.length} (deduped${MARKET_FILTER ? `, ${MARKET_FILTER} only` : ""})`)
  console.log(`With owner name: ${withOwner} (${Math.round((withOwner / out.length) * 100)}%)`)
  console.log(`File:            ${OUT}`)
  console.log("")
  console.log("Next steps (DealMachine):")
  console.log("  1. Go to DealMachine → Lists → Import List")
  console.log("  2. Upload: data/distress-leads/skip-trace-upload.csv")
  console.log("  3. Map: owner_name → Owner Name, property_address → Street Address,")
  console.log("          city → City, state → State")
  console.log("  4. Let DealMachine skip-trace the list (included in your plan)")
  console.log("  5. Export → Contacts → save to: data/dm-exports/<market>-YYYY-MM-DD.csv")
  console.log("  6. Run: npm run distress:dealmachine:ingest-export")
  console.log("  7. Then send: npm run distress:dealmachine:export-outreach -- --send")
}

main()
