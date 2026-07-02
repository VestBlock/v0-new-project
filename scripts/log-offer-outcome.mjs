#!/usr/bin/env node
// Offer outcome logger: closes the Offer Accuracy Loop.
//
// The analyzer stores ARV/MAO/offers, but accepted/rejected/countered outcomes were
// never recorded, so the command center could not learn which offers convert.
// This CLI writes a `lead_outcome` event to command_center_events (read by the
// Outcome Learning panel) plus a local trail that works offline.
//
// Usage:
//   npm run outreach:log-offer-outcome -- --address="244 Vermont Ave, Dayton, OH" --outcome=countered \
//     --seller-ask=95000 --cash-offer=61000 --counter=80000 --arv=145000 --mao=68000 --note="wants 80k, motivated by taxes"
//   Outcomes: interested | qualified | accepted | rejected | countered | followup | do_not_contact
//   Optional: --email=owner@x.com --creative-offer=... --buyer="landlord buy box" --dry-run

import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

const OUTCOMES = new Set(["interested", "qualified", "accepted", "rejected", "countered", "followup", "do_not_contact"])
const LOCAL_TRAIL = path.join(process.cwd(), "data", "operating-loops", "offer-outcomes.jsonl")

function arg(name, fallback = "") {
  const prefix = `--${name}=`
  const hit = process.argv.filter((piece) => piece.startsWith(prefix)).pop()
  return hit ? hit.slice(prefix.length) : fallback
}
const numArg = (name) => {
  const raw = arg(name).replace(/[$,]/g, "")
  const value = Number(raw)
  return raw && Number.isFinite(value) ? value : null
}

const address = arg("address").trim()
const outcome = arg("outcome").trim().toLowerCase()
const email = arg("email").trim().toLowerCase()
const note = arg("note").trim()
const buyer = arg("buyer").trim()
const dryRun = process.argv.includes("--dry-run")

if (!address) {
  console.error("log-offer-outcome: pass --address=...")
  process.exit(1)
}
if (!OUTCOMES.has(outcome)) {
  console.error(`log-offer-outcome: --outcome must be one of: ${[...OUTCOMES].join(", ")}`)
  process.exit(1)
}

const now = new Date().toISOString()
const economics = {
  arv: numArg("arv"),
  mao: numArg("mao"),
  cash_offer: numArg("cash-offer"),
  creative_offer: numArg("creative-offer"),
  seller_ask: numArg("seller-ask"),
  counter: numArg("counter"),
}

// Spread math where the inputs allow it — the learning value of this loop.
const derived = {}
if (economics.mao !== null && economics.seller_ask !== null) {
  derived.ask_over_mao = economics.seller_ask - economics.mao
}
if (economics.counter !== null && economics.cash_offer !== null) {
  derived.counter_gap = economics.counter - economics.cash_offer
}

const event = {
  event_type: "lead_outcome",
  entity_type: "property",
  entity_id: address.toLowerCase(),
  source: "operator_cli",
  title: `Offer ${outcome}: ${address}`,
  summary: note || `Offer outcome ${outcome} recorded for ${address}.`,
  priority: "info",
  status: "resolved",
  occurred_at: now,
  metadata_json: {
    status: outcome, // read by outcomeStatus() in the Outcome Learning panel
    property_address: address,
    lead_email: email || null,
    buyer_match: buyer || null,
    ...economics,
    ...derived,
    note: note || null,
  },
}

function appendLocalTrail() {
  fs.mkdirSync(path.dirname(LOCAL_TRAIL), { recursive: true })
  fs.appendFileSync(LOCAL_TRAIL, `${JSON.stringify({ at: now, ...event.metadata_json })}\n`, "utf8")
}

async function main() {
  if (dryRun) {
    console.log("[dry-run] Would insert command_center_events row:", JSON.stringify(event, null, 2))
    return
  }

  appendLocalTrail()
  console.log(`Offer outcome logged locally: ${LOCAL_TRAIL}`)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.warn("Supabase admin credentials missing; command-center event NOT written. Rerun with env when available.")
    return
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await admin.from("command_center_events").insert(event)
  if (error) throw error
  console.log(`Command-center event written: lead_outcome / ${outcome} for ${address}`)
  console.log("The Outcome Learning panel and Offer Accuracy Loop pick this up on next command-center load.")
}

main().catch((error) => {
  console.error(`log-offer-outcome failed: ${error?.message || error}`)
  process.exit(1)
})
