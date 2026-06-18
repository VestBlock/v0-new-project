/**
 * Probe whether DealMachine contact fields can be reached directly from the
 * logged-in Chrome session without waiting for a CSV export email.
 *
 * The probe writes masked summaries only. It verifies that saved-list rows
 * expose deal IDs and that property payloads expose contact/DNC fields.
 */

import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { execFileSync } from "node:child_process"

const args = process.argv.slice(2)
const ROOT = process.cwd()
const OUT_DIR = path.join(ROOT, "tmp", "outreach")
const RUN_ID = `vb-dm-direct-contact-probe-${new Date().toISOString().replace(/[:.]/g, "-")}`

function getArg(name) {
  const hit = [...args].reverse().find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : null
}

function parseList(value) {
  return String(value || "")
    .split(/[|,;]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function absoluteFile(file) {
  return path.isAbsolute(file) ? file : path.join(ROOT, file)
}

function defaultFiles() {
  if (!fs.existsSync(OUT_DIR)) return []
  return fs
    .readdirSync(OUT_DIR)
    .filter((name) => /^dealmachine-(upgrade-list-builder|website-list-builder)-.*\.json$/i.test(name))
    .map((name) => path.join(OUT_DIR, name))
    .sort()
    .slice(-1)
}

function selectedFiles() {
  const requested = parseList(getArg("files") || getArg("file") || "")
  return requested.length ? requested.map(absoluteFile) : defaultFiles()
}

function loadBuiltLists(files) {
  const seen = new Set()
  const lists = []
  for (const file of files) {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"))
    for (const row of parsed.built || parsed.builtLists || []) {
      const list = row.list || {}
      const listId = list.id || list.value || row.listId || row.id
      if (!listId || seen.has(String(listId))) continue
      seen.add(String(listId))
      lists.push({
        sourceFile: path.relative(ROOT, file),
        listId,
        title: row.title || list.title || list.label || `VestBlock DealMachine List ${listId}`,
        market: row.market || [row.city, row.state].filter(Boolean).join(", "),
        strategyKey: row.strategyKey || "",
        strategy: row.strategy || row.strategyKey || "",
        variant: row.variant || "",
        estimatedCount: Number(row.count || list.estimated_count || list.lead_count || 0),
      })
    }
  }
  return lists
}

function explicitLists() {
  return parseList(getArg("list-ids") || getArg("list-id") || "").map((listId) => ({
    sourceFile: "manual",
    listId,
    title: `Manual DealMachine List ${listId}`,
    market: "",
    strategyKey: "manual",
    strategy: "manual",
    variant: "",
    estimatedCount: 0,
  }))
}

function chromeJavascript(source) {
  const jsPath = path.join(os.tmpdir(), `${RUN_ID}-${Math.random().toString(36).slice(2)}.js`)
  const osaPath = path.join(os.tmpdir(), `${RUN_ID}-${Math.random().toString(36).slice(2)}.applescript`)
  fs.writeFileSync(jsPath, source)
  fs.writeFileSync(
    osaPath,
    [
      "on run argv",
      "  set jsPath to item 1 of argv",
      "  set jsSource to read POSIX file jsPath as «class utf8»",
      "  tell application \"Google Chrome\"",
      "    if (count windows) is 0 then error \"Google Chrome is not open\"",
      "    tell active tab of front window to execute javascript jsSource",
      "  end tell",
      "end run",
    ].join("\n")
  )
  try {
    return execFileSync("osascript", [osaPath, jsPath], { encoding: "utf8", maxBuffer: 25 * 1024 * 1024 }).trim()
  } finally {
    fs.rmSync(jsPath, { force: true })
    fs.rmSync(osaPath, { force: true })
  }
}

function browserProbePayload(lists, samplePerList, rowLimit) {
  return `(() => {
  const DM_CLIENT_KEY = "dM9xQ4wLpR7vKj2sYnBz8TfHcA6eUgW3"
  const runId = ${JSON.stringify(RUN_ID)}
  const token = localStorage.getItem("token")
  const lists = ${JSON.stringify(lists)}
  const samplePerList = ${JSON.stringify(samplePerList)}
  const rowLimit = ${JSON.stringify(rowLimit)}
  const keysOf = (value) => value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value).slice(0, 80) : []
  const mask = (value) => {
    const s = String(value || "")
    if (!s) return ""
    if (s.includes("@")) return s.replace(/^(.).+(@.+)$/, "$1***$2")
    const digits = s.replace(/\D/g, "")
    return digits.length >= 7 ? "***" + digits.slice(-4) : "present"
  }
  const personFlags = (contact) => (contact?.person_flags || []).map((flag) => String(flag?.value || "").trim().toLowerCase()).filter(Boolean)
  const ownerSafe = (contact) => {
    const matchingType = String(contact?.matching_type || "").trim().toLowerCase()
    const flags = personFlags(contact)
    if (contact?.likely_owner) return true
    if (matchingType === "mailing_address") return true
    if (matchingType === "company_tiebreaker") return true
    if (contact?.in_owner_family && !contact?.resident && !flags.includes("renter")) return true
    if (flags.includes("property_owner") && !contact?.resident && !flags.includes("renter")) return true
    return false
  }
  const apiList = async (body) => {
    const response = await fetch("https://api.dealmachine.com/v2/list/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json", "X-DM-Client-Key": DM_CLIENT_KEY },
      body: JSON.stringify({ token, ...body })
    })
    const text = await response.text()
    let data
    try { data = JSON.parse(text) } catch { data = { parseError: text.slice(0, 300) } }
    return { status: response.status, ok: response.ok, data }
  }
  const apiProperty = async (dealId) => {
    const url = new URL("https://api.dealmachine.com/v2/property/")
    url.searchParams.set("token", token)
    url.searchParams.set("deal_id", dealId)
    const response = await fetch(url.toString(), { headers: { "Accept": "application/json", "X-DM-Client-Key": DM_CLIENT_KEY } })
    const text = await response.text()
    let data
    try { data = JSON.parse(text) } catch { data = { parseError: text.slice(0, 300) } }
    return { status: response.status, ok: response.ok, data }
  }
  const summarizeContacts = (property) => {
    const phoneEntries = Array.isArray(property?.phone_numbers) ? property.phone_numbers : []
    const contacts = phoneEntries.map((entry) => entry?.contact).filter(Boolean)
    const ownerContacts = contacts.filter(ownerSafe)
    const emails = new Set()
    const phones = new Set()
    let wirelessPhones = 0
    let dncFlags = 0
    for (const contact of ownerContacts) {
      for (const key of ["email_address_1", "email_address_2", "email_address_3"]) {
        if (contact?.[key]) emails.add(String(contact[key]).trim().toLowerCase())
      }
      for (const index of [1, 2, 3]) {
        const phone = contact?.["phone_" + index]
        if (phone) phones.add(String(phone).replace(/\D/g, ""))
        if (String(contact?.["phone_" + index + "_type"] || "").toUpperCase() === "W") wirelessPhones++
        if (contact?.["phone_" + index + "_do_not_call"]) dncFlags++
      }
    }
    const sample = ownerContacts[0] || contacts[0] || {}
    return {
      contactObjects: contacts.length,
      ownerSafeContacts: ownerContacts.length,
      uniqueEmails: emails.size,
      uniquePhones: phones.size,
      wirelessPhones,
      dncPhoneFlags: dncFlags,
      contactKeys: keysOf(sample),
      maskedSample: {
        namePresent: Boolean(sample.full_name || sample.given_name || sample.surname),
        email1: mask(sample.email_address_1),
        phone1: mask(sample.phone_1),
        matchingType: sample.matching_type || "",
        likelyOwner: Boolean(sample.likely_owner),
        resident: Boolean(sample.resident),
        phoneType: sample.phone_1_type || "",
        phoneDnc: Boolean(sample.phone_1_do_not_call)
      }
    }
  }
  window.vbDmDirectContactProbe = { done: false, runId, startedAt: new Date().toISOString(), listsChecked: 0, results: [] }
  ;(async () => {
    if (!token) throw new Error("DealMachine token was not found. Open app.dealmachine.com/map and log in.")
    const results = []
    for (const item of lists) {
      const listResponse = await apiList({ type: "list", list_id: item.listId, page: 1, limit: rowLimit })
      const rows = listResponse.data?.results?.properties || []
      const candidates = rows.filter((row) => row?.deal_id).slice(0, samplePerList)
      const propertySamples = []
      for (const row of candidates) {
        const propertyResponse = await apiProperty(row.deal_id)
        const property = propertyResponse.data?.results?.property || propertyResponse.data?.property || propertyResponse.data?.results || propertyResponse.data
        propertySamples.push({
          dealIdPresent: Boolean(row.deal_id),
          rowContactability: row.contactability || "",
          rowPhoneNumbersCount: Number(row.phone_numbers_count || 0),
          rowEmailsCount: Number(row.emails_count || 0),
          propertyStatus: propertyResponse.status,
          propertyOk: propertyResponse.ok,
          hasPhoneNumbersArray: Array.isArray(property?.phone_numbers),
          contactSummary: summarizeContacts(property),
        })
      }
      const totals = propertySamples.reduce((acc, sample) => {
        const contact = sample.contactSummary || {}
        acc.sampledProperties += 1
        acc.propertiesWithContacts += Number(contact.contactObjects || 0) > 0 ? 1 : 0
        acc.ownerSafeContacts += Number(contact.ownerSafeContacts || 0)
        acc.uniqueEmails += Number(contact.uniqueEmails || 0)
        acc.uniquePhones += Number(contact.uniquePhones || 0)
        acc.dncPhoneFlags += Number(contact.dncPhoneFlags || 0)
        return acc
      }, { sampledProperties: 0, propertiesWithContacts: 0, ownerSafeContacts: 0, uniqueEmails: 0, uniquePhones: 0, dncPhoneFlags: 0 })
      results.push({
        ...item,
        listStatus: listResponse.status,
        listOk: listResponse.ok,
        rowCountSample: rows.length,
        rowsWithDealId: rows.filter((row) => row?.deal_id).length,
        listRowKeys: keysOf(rows[0]),
        directContactPathWorks: totals.propertiesWithContacts > 0,
        totals,
        propertySamples,
      })
      window.vbDmDirectContactProbe = { ...window.vbDmDirectContactProbe, listsChecked: results.length, results }
    }
    window.vbDmDirectContactProbe = { done: true, runId, startedAt: window.vbDmDirectContactProbe.startedAt, finishedAt: new Date().toISOString(), hasToken: Boolean(token), results }
  })().catch((error) => {
    window.vbDmDirectContactProbe = { done: true, runId, startedAt: window.vbDmDirectContactProbe.startedAt, finishedAt: new Date().toISOString(), error: String(error), results: window.vbDmDirectContactProbe.results || [] }
  })
  return "started"
})()`
}

function waitForProbe(timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const raw = chromeJavascript('JSON.stringify(window.vbDmDirectContactProbe || { done: false })')
    const parsed = raw ? JSON.parse(raw) : { done: false }
    if (parsed.done) return parsed
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2500)
  }
  throw new Error("Timed out waiting for DealMachine direct contact probe")
}

function reportMarkdown(report) {
  const lines = []
  lines.push("# DealMachine Direct Contact Probe")
  lines.push("")
  lines.push(`Run ID: ${report.runId}`)
  lines.push(`Started: ${report.startedAt || ""}`)
  lines.push(`Finished: ${report.finishedAt || ""}`)
  lines.push(`Lists checked: ${report.results?.length || 0}`)
  lines.push(`Browser token present: ${report.hasToken ? "yes" : "no"}`)
  if (report.error) lines.push(`Error: ${report.error}`)
  lines.push("")
  lines.push("| List | Market | Strategy | Rows sampled | Properties with contacts | Owner-safe contacts | Emails | Phones | DNC flags | Direct path |")
  lines.push("|---|---|---|---:|---:|---:|---:|---:|---:|---|")
  for (const row of report.results || []) {
    const totals = row.totals || {}
    lines.push(`| ${row.listId} | ${row.market || ""} | ${row.strategyKey || row.strategy || ""} | ${totals.sampledProperties || 0} | ${totals.propertiesWithContacts || 0} | ${totals.ownerSafeContacts || 0} | ${totals.uniqueEmails || 0} | ${totals.uniquePhones || 0} | ${totals.dncPhoneFlags || 0} | ${row.directContactPathWorks ? "yes" : "no"} |`)
  }
  lines.push("")
  lines.push("Notes:")
  lines.push("- This report intentionally masks contact samples and does not write raw owner emails or phone numbers.")
  lines.push("- `directContactPathWorks=yes` means the saved-list row exposed a `deal_id`, and the property endpoint exposed `phone_numbers[].contact` fields.")
  lines.push("- Use Contacts exports for full bulk lists until a separate owner-safe extraction script is approved and tested.")
  return `${lines.join("\n")}\n`
}

fs.mkdirSync(OUT_DIR, { recursive: true })

const manualLists = explicitLists()
const lists = manualLists.length ? manualLists : loadBuiltLists(selectedFiles())
if (!lists.length) throw new Error("No DealMachine saved lists found. Pass --list-ids=... or --files=tmp/outreach/list-builder.json")

const samplePerList = Number.parseInt(getArg("sample-per-list") || "3", 10)
const rowLimit = Number.parseInt(getArg("row-limit") || "25", 10)

chromeJavascript(browserProbePayload(lists, samplePerList, rowLimit))
const report = waitForProbe(Number.parseInt(getArg("timeout-ms") || "120000", 10))

const jsonPath = path.join(OUT_DIR, `${RUN_ID}.json`)
const mdPath = path.join(OUT_DIR, `${RUN_ID}.md`)
fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`)
fs.writeFileSync(mdPath, reportMarkdown(report))

const listsWithDirectContacts = (report.results || []).filter((row) => row.directContactPathWorks).length
const ownerSafeContacts = (report.results || []).reduce((sum, row) => sum + Number(row.totals?.ownerSafeContacts || 0), 0)
const uniqueEmails = (report.results || []).reduce((sum, row) => sum + Number(row.totals?.uniqueEmails || 0), 0)
const uniquePhones = (report.results || []).reduce((sum, row) => sum + Number(row.totals?.uniquePhones || 0), 0)

console.log(JSON.stringify({
  runId: report.runId,
  listsChecked: report.results?.length || 0,
  listsWithDirectContacts,
  ownerSafeContacts,
  uniqueEmails,
  uniquePhones,
  jsonPath: path.relative(ROOT, jsonPath),
  mdPath: path.relative(ROOT, mdPath),
}, null, 2))
