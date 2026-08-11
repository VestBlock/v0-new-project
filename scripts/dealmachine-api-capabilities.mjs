/**
 * DealMachine API capability check.
 *
 * This intentionally never prints the API key. It checks both DealMachine API
 * families we use:
 * - public v1: legacy lead harvest/push API
 * - api.v2/v1: documented list/export API requiring dm_sk_live/dm_at_live token
 *
 * Usage:
 *   node --env-file=.env.local scripts/dealmachine-api-capabilities.mjs
 */

import fs from "node:fs"
import path from "node:path"

const OUT_DIR = path.join(process.cwd(), "data", "operating-loops")
const SUMMARY_FILE = path.join(OUT_DIR, "dealmachine-api-capabilities-summary.json")
const KEY = String(process.env.DEALMACHINE_API_KEY || process.env.DEALMACHINE_V2_API_KEY || "").trim()

function maskToken(value) {
  if (!value) return "missing"
  if (value.length <= 10) return `${value.slice(0, 2)}...${value.slice(-2)}`
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

async function probe({ label, url, headers = {} }) {
  const started = Date.now()
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...headers,
      },
    })
    const text = await res.text()
    let body = null
    try {
      body = JSON.parse(text)
    } catch {
      body = { message: text.slice(0, 160) }
    }
    const message =
      body?.error?.message ||
      body?.message ||
      body?.detail ||
      (Array.isArray(body?.data) ? `data:${body.data.length}` : "") ||
      (Array.isArray(body?.results) ? `results:${body.results.length}` : "") ||
      Object.keys(body || {}).slice(0, 8).join(",")

    return {
      label,
      ok: res.ok,
      status: res.status,
      message,
      latencyMs: Date.now() - started,
    }
  } catch (error) {
    return {
      label,
      ok: false,
      status: 0,
      message: error?.message || String(error),
      latencyMs: Date.now() - started,
    }
  }
}

function classify(results) {
  const publicLeadHarvest = Boolean(results.find((row) => row.label === "public_v1_leads")?.ok)
  const v2Lists = Boolean(results.find((row) => row.label === "v2_lists")?.ok)
  const v2Exports = Boolean(results.find((row) => row.label === "v2_exports")?.ok)
  const tokenLooksLikeV2 = /^(dm_sk|dm_at)_(live|test)_/i.test(KEY)

  return {
    publicLeadHarvest,
    apiListExport: v2Lists && v2Exports,
    tokenLooksLikeV2,
    recommendedMode: v2Lists && v2Exports
      ? "api_list_export"
      : publicLeadHarvest
        ? "public_v1_harvest_plus_browser_or_private_export_fallback"
        : "not_configured_or_invalid",
    blocker: v2Lists && v2Exports
      ? null
      : tokenLooksLikeV2
        ? "The v2-shaped token did not get list/export access. Ask DealMachine to enable list/export API scopes."
        : "The configured key works as a public v1 harvest key, but the documented list/export API requires a dm_sk_live... API key or dm_at_live... OAuth token.",
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const auth = KEY ? { Authorization: `Bearer ${KEY}` } : {}
  const results = KEY
    ? await Promise.all([
        probe({
          label: "public_v1_leads",
          url: "https://api.dealmachine.com/public/v1/leads/?page=1&page_size=1",
          headers: auth,
        }),
        probe({
          label: "v2_account",
          url: "https://api.v2.dealmachine.com/v1/account",
          headers: auth,
        }),
        probe({
          label: "v2_lists",
          url: "https://api.v2.dealmachine.com/v1/lists?limit=1",
          headers: auth,
        }),
        probe({
          label: "v2_exports",
          url: "https://api.v2.dealmachine.com/v1/exports?limit=1",
          headers: auth,
        }),
      ])
    : []

  const summary = {
    generatedAt: new Date().toISOString(),
    keyPresent: Boolean(KEY),
    keyFingerprint: maskToken(KEY),
    capabilities: classify(results),
    probes: results,
  }

  fs.writeFileSync(SUMMARY_FILE, JSON.stringify(summary, null, 2))
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(error?.message || String(error))
  process.exit(1)
})
