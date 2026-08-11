/**
 * Public-source-only OSINT enrichment for county preforeclosure leads.
 *
 * This script is the non-DealMachine contact path for the preforeclosure lane.
 * It focuses on public, non-invasive enrichment:
 * - classify entity-owned vs natural-person ownership
 * - search for public websites for entity-owned leads
 * - scrape public website emails/phones
 * - optionally use Hunter on a discovered domain
 * - keep owner-occupant / natural-person leads in mail-only or manual-review lanes
 *
 * This script does NOT use breach data, private databases, or personal-account scraping.
 *
 * Usage:
 *   node --env-file=.env.local scripts/preforeclosure-public-osint-enrich.mjs --input=data/preforeclosure-county/review/file.csv
 */

import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const getArg = (name) => {
  const hit = [...args].reverse().find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : ""
}

const INPUT = getArg("input")
const LIMIT = getArg("limit") ? Number.parseInt(getArg("limit"), 10) : 100
const CONCURRENCY = getArg("concurrency") ? Math.max(1, Math.min(6, Number.parseInt(getArg("concurrency"), 10))) : 3
const TIMEOUT_MS = getArg("timeout-ms") ? Math.max(3000, Math.min(30000, Number.parseInt(getArg("timeout-ms"), 10))) : 9000

const PRE_DIR = path.join(process.cwd(), "data", "preforeclosure-county")
const ENRICHED_DIR = path.join(PRE_DIR, "osint-enriched")
const REPORT_DIR = path.join(process.cwd(), "tmp", "outreach")
const HUNTER_API_BASE = "https://api.hunter.io/v2"

function normalizeText(value) {
  return String(value || "").trim()
}

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

const GENERIC_ENTITY_WORDS = new Set([
  "llc",
  "l.l.c",
  "inc",
  "corp",
  "corporation",
  "company",
  "co",
  "holdings",
  "holding",
  "trust",
  "properties",
  "property",
  "partners",
  "ventures",
  "investments",
  "investment",
  "capital",
  "group",
  "homes",
  "home",
  "realty",
  "estate",
  "street",
  "avenue",
  "road",
  "lane",
  "drive",
  "place",
  "court",
  "north",
  "south",
  "east",
  "west",
])

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^mailto:/, "")
    .split(/[?;\s,]+/)[0]
    .replace(/^[("'`<>]+/, "")
    .replace(/[)"'`<>.,]+$/, "")
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
  const headers = (rows[0] || []).map((header) => String(header || "").trim())
  return rows
    .slice(1)
    .filter((values) => values.some((value) => normalizeText(value)))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, String(values[index] || "").trim()])))
}

function esc(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`
}

function writeCsv(file, columns, rows) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, [columns.join(","), ...rows.map((row) => columns.map((column) => esc(row[column] || "")).join(","))].join("\n"))
}

function entityOwner(ownerName) {
  return /\b(llc|l\.l\.c\.|inc|corp|corporation|company|co\.|holdings|trust|properties|partners|ventures|investments|capital)\b/i.test(ownerName)
}

function ownerOccupiedSensitive(row) {
  return String(row.ownerOccupiedSensitive || row.owner_occupied_sensitive || "").toLowerCase() === "true"
}

function naturalPersonOwner(ownerName) {
  return !entityOwner(ownerName)
}

function decodeEntities(text) {
  return String(text || "")
    .replace(/&#64;|&commat;/gi, "@")
    .replace(/&#46;|&period;/gi, ".")
    .replace(/&amp;/gi, "&")
}

function isUsableEmail(email) {
  const normalized = normalizeEmail(email)
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,24}$/i.test(normalized)) return false
  if (/^(example|test|demo|sample)@/i.test(normalized)) return false
  if (/(example|domain|address)\.(com|org|net)$/i.test(normalized)) return false
  if (/(noreply|no-reply|donotreply|postmaster)@/i.test(normalized)) return false
  if (/(duckduckgo\.com|google\.com|bing\.com|yahoo\.com)$/i.test(normalized.split("@")[1] || "")) return false
  if (/\.(png|jpg|jpeg|svg|webp|gif|css|js)$/i.test(normalized)) return false
  return true
}

function extractEmails(text) {
  const decoded = decodeEntities(text)
    .replace(/\s*\[\s*at\s*\]\s*/gi, "@")
    .replace(/\s*\(\s*at\s*\)\s*/gi, "@")
    .replace(/\s+at\s+/gi, "@")
    .replace(/\s*\[\s*dot\s*\]\s*/gi, ".")
    .replace(/\s*\(\s*dot\s*\)\s*/gi, ".")
    .replace(/\s+dot\s+/gi, ".")
  const emails = decoded.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}/gi) || []
  return Array.from(new Set(emails.map(normalizeEmail).filter(isUsableEmail)))
}

function extractPhones(text) {
  const matches = String(text || "").match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g) || []
  return Array.from(
    new Set(
      matches
        .map((match) => match.replace(/[^\d+]/g, ""))
        .filter((digits) => digits.replace(/\D/g, "").length >= 10)
    )
  )
}

function extractTelPhones(text) {
  const matches = Array.from(String(text || "").matchAll(/tel:([+\d().\-\s]+)/gi))
  return Array.from(
    new Set(
      matches
        .map((match) => normalizePhone(match[1] || ""))
        .filter(Boolean)
    )
  )
}

function normalizePhone(value) {
  const raw = String(value || "").trim()
  const plus = raw.startsWith("+")
  const digits = raw.replace(/\D/g, "")
  if (digits.length < 10 || digits.length > 11) return ""
  const normalizedDigits = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits
  if (normalizedDigits.length !== 10) return ""
  if (/^0+$/.test(normalizedDigits) || /^1+$/.test(normalizedDigits) || /^9+$/.test(normalizedDigits)) return ""
  if (/^(000|111|123|555|999)/.test(normalizedDigits.slice(0, 3))) return ""
  if (/0000$/.test(normalizedDigits)) return ""
  return plus ? `+1${normalizedDigits}` : normalizedDigits
}

function safeUrl(value) {
  const raw = normalizeText(value)
  if (!raw) return ""
  try {
    return new URL(raw.startsWith("http") ? raw : `https://${raw}`).toString()
  } catch {
    return ""
  }
}

function websiteHost(website) {
  try {
    return new URL(website).hostname.replace(/^www\./i, "").toLowerCase()
  } catch {
    return ""
  }
}

function contactUrls(homeUrl) {
  const url = new URL(homeUrl)
  const root = `${url.protocol}//${url.host}`
  return Array.from(
    new Set([homeUrl, `${root}/contact`, `${root}/contact-us`, `${root}/about`, `${root}/about-us`])
  )
}

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      "user-agent": "VestBlock Public OSINT/1.0 (+https://vestblock.io)",
      accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
    },
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const contentType = response.headers.get("content-type") || ""
  if (!/text|html|xml/i.test(contentType)) return ""
  return (await response.text()).slice(0, 500_000)
}

async function searchDuckDuckGo(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  try {
    const html = await fetchText(url)
    const blocks = html.split(/<div[^>]+class="[^"]*result[^"]*"[^>]*>/i).slice(1)
    const results = []
    for (const block of blocks) {
      const linkMatch = block.match(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
      if (!linkMatch) continue
      const href = normalizeText(linkMatch[1])
      const title = normalizeText(linkMatch[2].replace(/<[^>]+>/g, " "))
      const snippetMatch = block.match(/<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>|<div[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
      const snippet = normalizeText((snippetMatch?.[1] || snippetMatch?.[2] || "").replace(/<[^>]+>/g, " "))
      const normalized = safeUrl(href)
      if (!normalized) continue
      let finalUrl = normalized
      try {
        const parsed = new URL(normalized)
        const uddg = parsed.searchParams.get("uddg")
        if (uddg) finalUrl = safeUrl(decodeURIComponent(uddg))
      } catch {
        // ignore
      }
      if (!finalUrl) continue
      results.push({ url: finalUrl, title, snippet })
    }
    return results.slice(0, 8)
  } catch {
    return []
  }
}

function ownerTokens(ownerName) {
  return normalizeText(ownerName)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !GENERIC_ENTITY_WORDS.has(token))
}

function ownerSignalScore(ownerName, website, title = "", snippet = "") {
  const tokens = ownerTokens(ownerName)
  if (!tokens.length) return -100
  const host = websiteHost(website)
  const haystack = `${host} ${normalizeText(title).toLowerCase()} ${normalizeText(snippet).toLowerCase()}`
  let score = 0
  for (const token of tokens) {
    if (haystack.includes(token)) score += token.length >= 6 ? 8 : 4
  }
  const compactOwner = normalizeText(ownerName).toLowerCase().replace(/[^a-z0-9]+/g, "")
  const compactHost = host.replace(/[^a-z0-9]+/g, "")
  if (compactOwner && compactHost && (compactHost.includes(compactOwner) || compactOwner.includes(compactHost))) score += 25
  if (tokens.length >= 2 && tokens.filter((token) => haystack.includes(token)).length >= 2) score += 10
  return score
}

function isBusinessLikeResult(result) {
  const text = `${result.title || ""} ${result.snippet || ""} ${result.url || ""}`.toLowerCase()
  return /\b(real estate|rentals|properties|property management|investments|homes|housing|realty|apartments|leasing|development|builder)\b/.test(text)
}

function scorePhone(phone, sourceUrl, pageText = "") {
  let score = 0
  const digits = normalizePhone(phone)
  if (!digits) return -100
  if (/tel:/i.test(pageText)) score += 10
  if (/\b(call|phone|contact|office|text)\b/i.test(pageText)) score += 6
  if (websiteHost(sourceUrl)) score += 4
  return score
}

function personNameSignals(ownerName) {
  const parts = normalizeText(ownerName).split(/\s+/).filter(Boolean)
  const first = (parts[0] || "").toLowerCase()
  const last = (parts[parts.length - 1] || "").toLowerCase()
  return {
    first,
    last,
    full: normalizeText(ownerName).toLowerCase(),
  }
}

function personResultScore(ownerName, result) {
  const { first, last, full } = personNameSignals(ownerName)
  const text = `${result.title || ""} ${result.snippet || ""} ${result.url || ""}`.toLowerCase()
  let score = 0
  if (first && last && text.includes(first) && text.includes(last)) score += 18
  if (full && text.includes(full)) score += 15
  if (/\b(realtor|broker|real estate|investor|property|rentals|homes|construction|builder|holdings|llc|properties)\b/.test(text)) score += 10
  return score
}

function scoreEmail(email, website) {
  let score = 0
  const host = websiteHost(website)
  const domain = email.split("@")[1]?.replace(/^www\./, "") || ""
  if (domain && host && (domain === host || host.endsWith(`.${domain}`) || domain.endsWith(`.${host}`))) score += 20
  if (/^(info|contact|hello|team|office|sales|admin|acquisitions)@/i.test(email)) score += 8
  if (/(gmail|outlook|hotmail|yahoo)\.com$/i.test(email)) score -= 2
  return score
}

async function hunterDomainSearch(domain) {
  const apiKey = normalizeText(process.env.HUNTER_API_KEY)
  if (!apiKey) return { status: "skipped", reason: "missing_HUNTER_API_KEY", candidates: [] }
  const params = new URLSearchParams({ api_key: apiKey, domain, limit: "10" })
  try {
    const response = await fetch(`${HUNTER_API_BASE}/domain-search?${params.toString()}`, {
      headers: {
        accept: "application/json",
        "user-agent": "VestBlock Public OSINT/1.0 (+https://vestblock.io)",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) return { status: "error", reason: `hunter_http_${response.status}`, candidates: [] }
    const candidates = (payload?.data?.emails || [])
      .map((item) => {
        const email = normalizeEmail(item.value)
        if (!isUsableEmail(email)) return null
        return {
          email,
          confidence: Number(item.confidence || 0),
          verificationStatus: item.verification?.status || "",
          fullName: [item.first_name, item.last_name].filter(Boolean).join(" ").trim(),
          score: Math.max(1, Math.min(20, Math.round(Number(item.confidence || 0) / 5))) + (/^(info|contact|hello|team|office|sales|admin|acquisitions)@/i.test(email) ? 8 : 0),
        }
      })
      .filter(Boolean)
      .sort((left, right) => right.score - left.score)
    return { status: candidates.length ? "found" : "not_found", reason: candidates.length ? `hunter_found_${candidates.length}` : "hunter_no_usable_email", candidates }
  } catch (error) {
    return { status: "error", reason: error instanceof Error ? error.message : "hunter_failed", candidates: [] }
  }
}

async function enrichEntityLead(row) {
  const ownerName = normalizeText(row.ownerName || row.owner_name)
  const city = normalizeText(row.city)
  const state = normalizeText(row.state)
  const queries = [
    `${ownerName} ${city} ${state} real estate`,
    `${ownerName} ${state}`,
    `${ownerName} contact`,
  ]
  const websiteCandidates = []
  for (const query of queries) {
    const results = await searchDuckDuckGo(query)
    for (const result of results) {
      const relevance = ownerSignalScore(ownerName, result.url, result.title, result.snippet)
      if (relevance < 8) continue
      if (!isBusinessLikeResult(result)) continue
      const host = websiteHost(result.url)
      if (host && !websiteCandidates.some((site) => websiteHost(site.url) === host)) {
        websiteCandidates.push({ ...result, relevance })
      }
    }
    if (websiteCandidates.length >= 3) break
  }
  const websites = websiteCandidates.sort((a, b) => b.relevance - a.relevance).slice(0, 3)

  const evidence = []
  const foundEmails = []
  const foundPhones = []

  for (const website of websites) {
    const primaryHost = websiteHost(website.url)
    for (const url of contactUrls(website.url)) {
      try {
        const text = await fetchText(url)
        for (const email of extractEmails(text)) {
          if ((email.split("@")[1] || "").replace(/^www\./, "") !== primaryHost) continue
          foundEmails.push({ email, url, score: scoreEmail(email, website.url) + website.relevance })
        }
        for (const phone of [...extractTelPhones(text), ...extractPhones(text)]) {
          if (!primaryHost || /duckduckgo|google|bing|yahoo/i.test(primaryHost)) continue
          const normalizedPhone = normalizePhone(phone)
          if (!normalizedPhone) continue
          foundPhones.push({ phone: normalizedPhone, url, score: scorePhone(normalizedPhone, url, text) + website.relevance })
        }
        const mailtos = Array.from(text.matchAll(/mailto:([^"'<>\\s?#]+)/gi)).map((match) => normalizeEmail(match[1]))
        for (const email of mailtos.filter(isUsableEmail)) {
          if ((email.split("@")[1] || "").replace(/^www\./, "") !== primaryHost) continue
          foundEmails.push({ email, url, score: scoreEmail(email, website.url) + website.relevance + 5 })
        }
      } catch {
        // best-effort only
      }
    }
  }

  const uniqueEmails = Array.from(new Map(foundEmails.map((item) => [item.email, item])).values()).sort((a, b) => b.score - a.score)
  const uniquePhones = Array.from(new Map(foundPhones.map((item) => [item.phone, item])).values()).sort((a, b) => b.score - a.score)

  let hunterPrimary = null
  const primaryWebsite = websites[0]?.url || ""
  if (primaryWebsite) {
    const hunter = await hunterDomainSearch(websiteHost(primaryWebsite))
    hunterPrimary = hunter.candidates[0] || null
    if (hunterPrimary) evidence.push(`hunter:${hunter.reason}`)
  }

  const selectedEmail = uniqueEmails[0]?.email || hunterPrimary?.email || ""
  const selectedPhone = uniquePhones[0]?.phone || ""
  return {
    osint_owner_type: "entity",
    osint_public_website: primaryWebsite,
    osint_public_email: selectedEmail,
    osint_public_phone: selectedPhone,
    osint_public_email_source: uniqueEmails[0]?.url || (hunterPrimary ? "hunter_domain_search" : ""),
    osint_skiptrace_status: selectedEmail || selectedPhone ? "public_contact_found" : "manual_review_needed",
    osint_recommended_contact_path: selectedEmail ? "email" : selectedPhone ? "phone" : "mail_only_or_manual",
    osint_evidence: [primaryWebsite ? `website:${primaryWebsite}` : "", ...evidence].filter(Boolean).join(" | "),
    osint_notes: selectedEmail || selectedPhone
      ? "Entity-owned lead enriched from public website/business signals."
      : "No reliable public contact found. Keep on mailing-address and manual-review path.",
  }
}

async function enrichNaturalPersonBusinessLead(row) {
  const ownerName = normalizeText(row.ownerName || row.owner_name)
  const city = normalizeText(row.city || row.mailingCity || "")
  const state = normalizeText(row.state || row.mailingState || "")
  const queries = [
    `"${ownerName}" ${city} ${state} real estate`,
    `"${ownerName}" ${city} ${state} investor`,
    `"${ownerName}" ${city} ${state} rentals`,
    `"${ownerName}" ${city} ${state} phone`,
  ]
  const candidates = []
  for (const query of queries) {
    const results = await searchDuckDuckGo(query)
    for (const result of results) {
      const relevance = personResultScore(ownerName, result)
      if (relevance < 18) continue
      const host = websiteHost(result.url)
      if (host && !candidates.some((site) => websiteHost(site.url) === host)) candidates.push({ ...result, relevance })
    }
    if (candidates.length >= 2) break
  }
  if (!candidates.length) {
    return {
      ...row,
      osint_owner_type: "natural_person",
      osint_public_website: "",
      osint_public_email: "",
      osint_public_phone: "",
      osint_public_email_source: "",
      osint_skiptrace_status: "mail_only",
      osint_recommended_contact_path: "mail_only_or_manual",
      osint_evidence: "",
      osint_notes: "Natural-person owner without a clear public business footprint. Stay on mailing-address/manual-review path.",
    }
  }

  const foundEmails = []
  const foundPhones = []
  const site = candidates.sort((a, b) => b.relevance - a.relevance)[0]
  for (const url of contactUrls(site.url)) {
    try {
      const text = await fetchText(url)
      for (const email of extractEmails(text)) {
        foundEmails.push({ email, url, score: scoreEmail(email, site.url) + site.relevance })
      }
      for (const phone of [...extractTelPhones(text), ...extractPhones(text)]) {
        const normalizedPhone = normalizePhone(phone)
        if (!normalizedPhone) continue
        foundPhones.push({ phone: normalizedPhone, url, score: scorePhone(normalizedPhone, url, text) + site.relevance })
      }
    } catch {
      // best effort
    }
  }
  const selectedEmail = Array.from(new Map(foundEmails.map((item) => [item.email, item])).values()).sort((a, b) => b.score - a.score)[0]?.email || ""
  const selectedPhone = Array.from(new Map(foundPhones.map((item) => [item.phone, item])).values()).sort((a, b) => b.score - a.score)[0]?.phone || ""
  return {
    ...row,
    osint_owner_type: "natural_person_public_business",
    osint_public_website: site.url,
    osint_public_email: selectedEmail,
    osint_public_phone: selectedPhone,
    osint_public_email_source: selectedEmail ? site.url : "",
    osint_skiptrace_status: selectedEmail || selectedPhone ? "public_contact_found" : "mail_only",
    osint_recommended_contact_path: selectedEmail ? "email" : selectedPhone ? "phone" : "mail_only_or_manual",
    osint_evidence: `website:${site.url}`,
    osint_notes: selectedEmail || selectedPhone
      ? "Natural-person owner matched to a public business footprint."
      : "Possible public business footprint found, but no reliable direct contact extracted.",
  }
}

async function enrichRow(row) {
  const ownerName = normalizeText(row.ownerName || row.owner_name)
  const sensitive = ownerOccupiedSensitive(row)
  if (!ownerName) {
    return {
      ...row,
      osint_owner_type: "unknown",
      osint_skiptrace_status: "manual_review_needed",
      osint_recommended_contact_path: "mail_only_or_manual",
      osint_notes: "Missing owner name.",
    }
  }

  if (sensitive) {
    return {
      ...row,
      osint_owner_type: "owner_occupant_sensitive",
      osint_public_website: "",
      osint_public_email: "",
      osint_public_phone: "",
      osint_public_email_source: "",
      osint_skiptrace_status: "review_only",
      osint_recommended_contact_path: "manual_review",
      osint_evidence: "",
      osint_notes: "Owner-occupant or legally sensitive lead. Do not public-skip-trace beyond obvious business contacts.",
    }
  }

  if (naturalPersonOwner(ownerName)) {
    return enrichNaturalPersonBusinessLead(row)
  }

  return {
    ...row,
    ...(await enrichEntityLead(row)),
  }
}

async function mapConcurrent(items, concurrency, mapper) {
  const results = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: concurrency }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await mapper(items[index], index)
    }
  })
  await Promise.all(workers)
  return results
}

function detectInputFile() {
  if (INPUT) {
    const resolved = path.resolve(INPUT)
    if (!fs.existsSync(resolved)) throw new Error(`Input file not found: ${resolved}`)
    return resolved
  }
  const reviewDir = path.join(PRE_DIR, "review")
  if (!fs.existsSync(reviewDir)) throw new Error(`Review directory not found: ${reviewDir}`)
  const candidates = fs
    .readdirSync(reviewDir)
    .filter((name) => name.toLowerCase().endsWith(".csv"))
    .map((name) => {
      const file = path.join(reviewDir, name)
      return { file, mtimeMs: fs.statSync(file).mtimeMs }
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
  if (!candidates.length) throw new Error(`No review CSV found in ${reviewDir}`)
  return candidates[0].file
}

async function main() {
  fs.mkdirSync(ENRICHED_DIR, { recursive: true })
  fs.mkdirSync(REPORT_DIR, { recursive: true })

  const inputFile = detectInputFile()
  const rows = loadCsv(inputFile).slice(0, LIMIT)
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const base = `${normalizeSlug(path.basename(inputFile, path.extname(inputFile)))}-${stamp}`
  const outputCsv = path.join(ENRICHED_DIR, `${base}.csv`)
  const outputJson = path.join(ENRICHED_DIR, `${base}.json`)
  const reportFile = path.join(REPORT_DIR, `preforeclosure-public-osint-enrich-${stamp}.md`)

  const enriched = await mapConcurrent(rows, CONCURRENCY, enrichRow)

  writeCsv(
    outputCsv,
    [
      ...Object.keys(enriched[0] || {}),
      "osint_owner_type",
      "osint_public_website",
      "osint_public_email",
      "osint_public_phone",
      "osint_public_email_source",
      "osint_skiptrace_status",
      "osint_recommended_contact_path",
      "osint_evidence",
      "osint_notes",
    ].filter((value, index, array) => array.indexOf(value) === index),
    enriched
  )
  fs.writeFileSync(outputJson, JSON.stringify(enriched, null, 2))

  const summary = {
    total: enriched.length,
    publicContactFound: enriched.filter((row) => row.osint_skiptrace_status === "public_contact_found").length,
    mailOnly: enriched.filter((row) => row.osint_skiptrace_status === "mail_only").length,
    reviewOnly: enriched.filter((row) => row.osint_skiptrace_status === "review_only").length,
    manualReviewNeeded: enriched.filter((row) => row.osint_skiptrace_status === "manual_review_needed").length,
  }

  const report = [
    "# Preforeclosure Public OSINT Enrichment",
    "",
    `- Input: ${path.relative(process.cwd(), inputFile)}`,
    `- Output CSV: ${path.relative(process.cwd(), outputCsv)}`,
    `- Output JSON: ${path.relative(process.cwd(), outputJson)}`,
    `- Processed: ${summary.total}`,
    `- Public contacts found: ${summary.publicContactFound}`,
    `- Mail only: ${summary.mailOnly}`,
    `- Review only: ${summary.reviewOnly}`,
    `- Manual review needed: ${summary.manualReviewNeeded}`,
    "",
    "## Public contactable leads",
    "",
    ...enriched
      .filter((row) => row.osint_skiptrace_status === "public_contact_found")
      .slice(0, 20)
      .map((row) => `- ${row.propertyAddress || row.property_address} | owner: ${row.ownerName || row.owner_name} | email: ${row.osint_public_email || "n/a"} | phone: ${row.osint_public_phone || "n/a"}`),
    "",
    "## Guardrailed leads",
    "",
    ...enriched
      .filter((row) => ["mail_only", "review_only", "manual_review_needed"].includes(row.osint_skiptrace_status))
      .slice(0, 20)
      .map((row) => `- ${row.propertyAddress || row.property_address} | owner: ${row.ownerName || row.owner_name} | path: ${row.osint_recommended_contact_path} | note: ${row.osint_notes}`),
  ]
  fs.writeFileSync(reportFile, report.join("\n"))

  console.log(
    JSON.stringify(
      {
        ok: true,
        inputFile: path.relative(process.cwd(), inputFile),
        outputCsv: path.relative(process.cwd(), outputCsv),
        outputJson: path.relative(process.cwd(), outputJson),
        reportFile: path.relative(process.cwd(), reportFile),
        summary,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(`[preforeclosure-public-osint-enrich] ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
