/**
 * DealMachine List Builder expansion planner for VestBlock.
 *
 * DealMachine's public API is useful for syncing leads already in the account,
 * but List Builder is the growth surface for new DealMachine leads. This script
 * creates exact smart/static list build instructions by market and strategy so
 * the website work is repeatable instead of improvised.
 *
 * Usage:
 *   node scripts/dealmachine-list-builder-expansion.mjs
 *   node scripts/dealmachine-list-builder-expansion.mjs --markets="Dayton,OH|Akron,OH|Buffalo,NY"
 *   node scripts/dealmachine-list-builder-expansion.mjs --strategies=tax-code-stack|vacant-equity|tired-landlord --mode=smart
 */

import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const getArg = (name) => {
  const hit = [...args].reverse().find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : null
}

const DEFAULT_MARKETS = [
  "Dayton,OH",
  "Akron,OH",
  "Buffalo,NY",
  "Cleveland,OH",
  "Toledo,OH",
  "Milwaukee,WI",
  "Columbus,OH",
  "Cincinnati,OH",
  "Indianapolis,IN",
  "Louisville,KY",
  "Kansas City,MO",
  "Macon,GA",
]

const MODE = normalizeSlug(getArg("mode") || "smart")
const LIMIT_PER_LIST = getArg("limit-per-list") ? Number.parseInt(getArg("limit-per-list"), 10) : 250
const OUT_DIR = path.join(process.cwd(), "tmp", "outreach")

const STRATEGIES = [
  {
    key: "divorce-separation",
    label: "Divorce / separation quiet exit",
    priority: "medium",
    filters: [
      "Divorce OR court/legal distress signals when available",
      "High Equity OR Free and Clear",
      "Off Market",
      "Owner occupied optional when list is too small",
    ],
    notes:
      "Use discreet tone and privacy-first copy. Best where timing pressure is obvious but public foreclosure language would miss the situation.",
  },
  {
    key: "relocation-job-transfer",
    label: "Relocation / job transfer timing",
    priority: "medium",
    filters: [
      "Out-of-State Owners OR absentee owners",
      "Off Market",
      "High Equity optional when list is too broad",
      "Ownership length 5+ years when available",
    ],
    notes:
      "Good for timing-sensitive sellers likely deciding between renting and selling. Keep the tone practical, not distressed.",
  },
  {
    key: "out-of-state-heir",
    label: "Out-of-state heir / remote inherited owner",
    priority: "high",
    filters: [
      "Probates OR inherited-owner signals",
      "Out-of-State Owners",
      "Off Market",
      "High Equity OR Free and Clear",
    ],
    notes:
      "Remote heir lane should stay separate from general probate because distance is the real pressure amplifier.",
  },
  {
    key: "senior-downsizing-medical",
    label: "Senior downsizing / medical hardship",
    priority: "medium",
    filters: [
      "Senior Owners OR long ownership",
      "High Equity OR Free and Clear",
      "Off Market",
      "Owner occupied optional",
    ],
    notes:
      "Use softer simplicity and flexibility language. Avoid hard-pressure investor framing.",
  },
  {
    key: "fire-storm-damage",
    label: "Fire / storm / insurance damage",
    priority: "high",
    filters: [
      "Fire damaged OR severe condition signals",
      "Off Market",
      "Absentee Owners OR High Equity",
      "Exclude Bank Owned",
    ],
    notes:
      "Strong as-is distress lane when repair burden or insurance friction is likely the main seller driver.",
  },
  {
    key: "problem-tenant-eviction",
    label: "Problem tenant / eviction relief",
    priority: "high",
    filters: [
      "Tired Landlords OR eviction/tenant distress signals",
      "Absentee Owners",
      "Off Market",
      "High Equity optional",
    ],
    notes:
      "Keep this distinct from generic landlord fatigue so copy can center on occupancy pain, not just portfolio cleanup.",
  },
  {
    key: "seller-finance-equity",
    label: "Seller finance / owner-carry equity",
    priority: "high",
    filters: [
      "High Equity OR Free and Clear",
      "Absentee Owners OR Out-of-State Owners OR Landlords",
      "Off Market",
      "Ownership length 7+ years when available",
    ],
    notes:
      "Use when a flexible monthly-payment path may outperform a straight cash angle. Best for higher-equity owners, landlords, and longer-term holds.",
  },
  {
    key: "tax-code-stack",
    label: "Tax delinquent + code pressure",
    priority: "highest",
    filters: [
      "Tax Delinquent",
      "High Equity",
      "Off Market",
      "Absentee Owners OR Out-of-State Owners",
      "Exclude Bank Owned",
      "Exclude MLS Sold",
    ],
    notes:
      "Best for fast cash or creative seller-options outreach. If results are too thin, remove High Equity first, not Tax Delinquent.",
  },
  {
    key: "vacant-equity",
    label: "Vacant + high equity",
    priority: "high",
    filters: [
      "Vacant Homes",
      "High Equity",
      "Off Market",
      "Absentee Owners OR Corporate Owners",
      "Exclude Bank Owned",
    ],
    notes:
      "Strong builder/rehab lane. Add minimum assessed value or square footage only if the list is too broad.",
  },
  {
    key: "land-wholesale",
    label: "Land wholesale / developer activity",
    priority: "highest",
    filters: [
      "Vacant Land OR Vacant Homes",
      "High Equity OR Free and Clear",
      "Off Market",
      "Absentee Owners OR Corporate Owners",
      "Lot size / zoning filters when available",
      "Exclude Bank Owned",
      "Exclude MLS Sold",
    ],
    notes:
      "Use for 30-50% conditional land/infill cash reviews. Cross-check against developer activity, nearby new construction, permits, builder buy boxes, utilities, access, zoning, liens, and buildability before quoting final numbers.",
  },
  {
    key: "vacant-property-refresh",
    label: "Vacant property refresh",
    priority: "high",
    filters: [
      "Vacant Homes",
      "Off Market",
      "Absentee Owners OR Out-of-State Owners",
      "High Equity optional when list is too broad",
      "Exclude Bank Owned",
    ],
    notes:
      "Soft-touch as-is lane for owners who may simply be done with a vacant property. Keep this separate from teardown/developer language.",
  },
  {
    key: "tired-landlord",
    label: "Tired landlord / senior absentee",
    priority: "high",
    filters: [
      "Tired Landlords OR Senior Owners",
      "Absentee Owners",
      "High Equity OR Free and Clear",
      "Off Market",
      "Ownership length 10+ years when available",
    ],
    notes:
      "Best for portfolio breakup, small multifamily, and creative finance copy. Keep tone softer than tax/code copy.",
  },
  {
    key: "code-violation-distress",
    label: "Code violation / city-pressure",
    priority: "high",
    filters: [
      "Code Violations OR property condition problems",
      "Off Market",
      "Absentee Owners OR High Equity",
      "Exclude Bank Owned",
    ],
    notes:
      "Use direct but not aggressive city-pressure copy. Good for repair burden, citations, nuisance, and boarded-condition situations.",
  },
  {
    key: "tax-delinquent-cure",
    label: "Tax delinquent cure path",
    priority: "high",
    filters: [
      "Tax Delinquent",
      "Off Market",
      "High Equity OR Free and Clear",
      "Absentee Owners optional when volume is too broad",
      "Exclude Bank Owned",
    ],
    notes:
      "Cleaner tax-only lane when code data is missing. Use a burden-relief angle rather than a heavy distress tone.",
  },
  {
    key: "fsbo-conversion",
    label: "FSBO conversion",
    priority: "medium",
    filters: [
      "FSBO OR owner-listed signals when available",
      "Off Market or owner-listed only",
      "High Equity optional",
      "Exclude Bank Owned",
    ],
    notes:
      "Fast-turn lane for sellers already trying to move a property. Use real-buyer, no-tire-kicker language.",
  },
  {
    key: "failed-flipper-stuck-rehab",
    label: "Failed flipper / stuck rehab",
    priority: "medium",
    filters: [
      "Investor-owned OR absentee owners",
      "Condition distress OR rehab signals",
      "Off Market",
      "High Equity optional",
    ],
    notes:
      "Use investor-to-investor copy. Focus on time, carrying costs, and unfinished scope.",
  },
  {
    key: "hoa-delinquent",
    label: "HOA delinquent / association pressure",
    priority: "medium",
    filters: [
      "HOA lien OR association lien signals",
      "High Equity",
      "Off Market",
      "Exclude Bank Owned",
    ],
    notes:
      "Especially useful in HOA-heavy Sunbelt markets where dues pressure can create real urgency.",
  },
  {
    key: "reverse-mortgage-exit",
    label: "Reverse mortgage exit",
    priority: "medium",
    filters: [
      "Senior Owners OR inherited-owner signals",
      "High Equity OR reverse-mortgage indicators",
      "Off Market",
      "Owner occupied optional",
    ],
    notes:
      "Use carefully around heirs and aging owners. This lane is about clarity and timing, not aggressive pricing.",
  },
  {
    key: "title-issue-cloud",
    label: "Title issue / cloud on title",
    priority: "medium",
    filters: [
      "Probates OR inherited-owner signals",
      "High Equity OR Free and Clear",
      "Off Market",
      "Vacant Homes optional",
    ],
    notes:
      "Best when combined with manual title/O SINT review, because the real edge is being willing to clear problems others avoid.",
  },
  {
    key: "post-auction-backup-buyer",
    label: "Post-auction / backup buyer",
    priority: "medium",
    filters: [
      "Preforeclosures OR auction distress signals",
      "High Equity optional",
      "Off Market",
      "Exclude Bank Owned",
    ],
    notes:
      "Timing-window lane for postponed, cancelled, or fallback auction situations. Keep it separate from standard preforeclosure messaging.",
  },
  {
    key: "preforeclosure-equity",
    label: "Preforeclosure + equity",
    priority: "high",
    filters: [
      "Preforeclosures",
      "High Equity",
      "Off Market",
      "Exclude Bank Owned",
      "Exclude Recently Sold",
    ],
    notes:
      "Use careful rescue/options copy. Do not imply legal/tax advice. Push quick analysis, not a blind offer.",
  },
  {
    key: "probate-inheritance",
    label: "Probate / inheritance soft-touch",
    priority: "medium",
    filters: [
      "Probates OR inherited-owner signals",
      "High Equity OR Free and Clear",
      "Off Market",
      "Vacant Homes optional when available",
    ],
    notes:
      "Use respectful estate/inheritance language. Aim for simplicity and as-is relief, not urgency pressure.",
  },
  {
    key: "probate-equity",
    label: "Probate + equity",
    priority: "medium",
    filters: [
      "Probates",
      "High Equity OR Free and Clear",
      "Off Market",
      "Absentee Owners when available",
    ],
    notes:
      "Use respectful estate-settlement copy. This is lower volume but can produce larger assignment fees.",
  },
  {
    key: "zombie-vacant",
    label: "Zombie / vacant distress",
    priority: "medium",
    filters: [
      "Zombie Properties",
      "Vacant Homes",
      "High Equity",
      "Off Market",
      "Exclude Bank Owned",
    ],
    notes:
      "Good teardown/infill lane. If volume is too low, use Vacant + High Equity as the broader parent list.",
  },
  {
    key: "expired-stale-listing",
    label: "Expired/stale listing cash review",
    priority: "medium",
    filters: [
      "Expired Listings OR MLS Active",
      "Days on Market 30+ when available",
      "Price max $450k unless market requires higher",
      "High Equity",
      "Exclude Bank Owned",
    ],
    notes:
      "Use agent-friendly conditional lowball copy. This should stay separate from off-market seller outreach.",
  },
  {
    key: "active-stale-lowball",
    label: "Active stale listing / conditional lowball",
    priority: "medium",
    filters: [
      "MLS Active",
      "Days on Market 45+",
      "High Equity OR price reductions when available",
      "Exclude Bank Owned",
    ],
    notes:
      "Keep this distinct from expired listings: it is an active-listing, agent-friendly backup-offer lane.",
  },
  {
    key: "lien-equity",
    label: "Lien + equity resolution",
    priority: "high",
    filters: [
      "Tax, judgment, mechanic, or other lien signals",
      "High Equity",
      "Off Market",
      "Exclude Bank Owned",
    ],
    notes:
      "Use a resolution-first angle and verify lien type and payoff before underwriting; do not combine with general tax-only leads.",
  },
  {
    key: "portfolio-landlord",
    label: "Portfolio landlord / rental portfolio exit",
    priority: "high",
    filters: [
      "Owners with 3+ properties OR corporate owners",
      "Absentee Owners",
      "High Equity OR Free and Clear",
      "Off Market",
    ],
    notes:
      "Keep portfolio owners separate from single-property tired landlords so pricing and disposition can be evaluated at portfolio scale.",
  },
]

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function parseList(value, fallback) {
  const raw = String(value || "").trim()
  if (!raw) return fallback
  return raw.split(/[|;]/).map((item) => item.trim()).filter(Boolean)
}

function parseStrategies(value) {
  const requested = parseList(value, STRATEGIES.map((strategy) => strategy.key)).map(normalizeSlug)
  return STRATEGIES.filter((strategy) => requested.includes(strategy.key))
}

function parseMarkets(value) {
  return parseList(value, DEFAULT_MARKETS)
    .map((market) => {
      const [city, state] = market.split(",").map((part) => part.trim())
      return city && state ? { city, state: state.toUpperCase(), slug: normalizeSlug(`${city}-${state}`) } : null
    })
    .filter(Boolean)
}

function dateStamp(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function esc(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`
}

function buildRows(markets, strategies) {
  const today = dateStamp()
  const rows = []
  for (const market of markets) {
    for (const strategy of strategies) {
      const listName = `VB ${strategy.key} ${market.slug} ${today}`
      rows.push({
        list_name: listName,
        mode: MODE === "static" ? "Static snapshot" : "Smart List",
        market: `${market.city}, ${market.state}`,
        market_slug: market.slug,
        strategy_key: strategy.key,
        strategy_name: strategy.label,
        priority: strategy.priority,
        target_count: LIMIT_PER_LIST,
        filters: strategy.filters.join(" | "),
        notes: strategy.notes,
        website_steps:
          `Map tab -> List Builder -> geography ${market.city}, ${market.state} -> apply filters -> Build List -> name "${listName}" -> export Contacts.`,
      })
    }
  }
  return rows
}

function writeOutputs(rows) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const csvPath = path.join(OUT_DIR, `dealmachine-list-builder-expansion-${stamp}.csv`)
  const mdPath = path.join(OUT_DIR, `dealmachine-list-builder-expansion-${stamp}.md`)
  const jsonPath = path.join(OUT_DIR, `dealmachine-list-builder-expansion-${stamp}.json`)
  const columns = [
    "list_name",
    "mode",
    "market",
    "market_slug",
    "strategy_key",
    "strategy_name",
    "priority",
    "target_count",
    "filters",
    "notes",
    "website_steps",
  ]

  fs.writeFileSync(csvPath, [columns.join(","), ...rows.map((row) => columns.map((col) => esc(row[col])).join(","))].join("\n"))
  fs.writeFileSync(jsonPath, JSON.stringify({ createdAt: new Date().toISOString(), rows }, null, 2))
  fs.writeFileSync(
    mdPath,
    [
      "# DealMachine List Builder Expansion",
      "",
      `Created: ${new Date().toISOString()}`,
      `Lists to build: ${rows.length}`,
      `Mode: ${MODE === "static" ? "Static snapshot" : "Smart List"}`,
      "",
      "## Operating Rule",
      "",
      "DealMachine List Builder is the expansion surface. The public API syncs and audits leads already in the account; it does not reliably expose every List Builder filter or every contact field. Build the lead lists in the website, then export Contacts and ingest the CSV.",
      "",
      "## Export Settings",
      "",
      "- Export type: Contacts",
      "- Associated contacts: Likely Property Owners",
      "- Scrub DNC: on",
      "- Scrub Landline: on",
      "- Scrub Wireless: off",
      "- Deduplicate Contacts: on",
      "- Include contacts without phone numbers: on",
      "",
      "## Lists",
      "",
      ...rows.map((row, index) => [
        `### ${index + 1}. ${row.list_name}`,
        "",
        `- Market: ${row.market}`,
        `- Strategy: ${row.strategy_name}`,
        `- Priority: ${row.priority}`,
        `- Target count: ${row.target_count}`,
        `- Filters: ${row.filters}`,
        `- Notes: ${row.notes}`,
        `- Steps: ${row.website_steps}`,
        "",
      ].join("\n")),
      "## After Export",
      "",
      "```bash",
      "pnpm run distress:dealmachine:ingest-export:apply -- --file=/path/to/dealmachine-contacts.csv --split-by-market",
      "pnpm run distress:dealmachine:export-request:all",
      "pnpm run distress:dealmachine:export-outreach -- --strategy=<strategy-key> --config-file=<config.json> --limit=100 --send",
      "```",
      "",
    ].join("\n")
  )

  return { csvPath, mdPath, jsonPath }
}

function main() {
  const markets = parseMarkets(getArg("markets"))
  const strategies = parseStrategies(getArg("strategies"))
  const rows = buildRows(markets, strategies)
  const outputs = writeOutputs(rows)

  console.log("=== DealMachine List Builder expansion ===")
  console.log(`Markets:     ${markets.map((market) => `${market.city}, ${market.state}`).join(" | ")}`)
  console.log(`Strategies:  ${strategies.map((strategy) => strategy.key).join(" | ")}`)
  console.log(`Lists:       ${rows.length}`)
  console.log(`Mode:        ${MODE === "static" ? "Static snapshot" : "Smart List"}`)
  console.log(`CSV:         ${outputs.csvPath}`)
  console.log(`Guide:       ${outputs.mdPath}`)
  console.log(`JSON:        ${outputs.jsonPath}`)
  console.log("")
  console.log("Next: build these lists in DealMachine List Builder, export Contacts, then ingest with --split-by-market.")
}

main()
