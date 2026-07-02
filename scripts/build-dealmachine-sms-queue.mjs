#!/usr/bin/env node

/**
 * Build an SMS-ready review queue from raw DealMachine contact exports.
 *
 * DealMachine contact exports mark blocked numbers as "DO NOT CALL"; blank DNC
 * values are treated as not flagged by DealMachine. This script still does not
 * send messages. It prepares a queue for scripts/send-messages-batch.mjs.
 */

import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const ROOT = process.cwd()
const EXPORT_DIR = path.join(ROOT, 'data', 'dm-exports')
const OUT_DIR = path.join(ROOT, 'tmp', 'outreach')
const SUPPRESSIONS_FILE = path.join(ROOT, 'data', 'outreach-suppressions.json')

function getArg(name, fallback = '') {
  const prefix = `--${name}=`
  const inline = args.find((arg) => arg.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)
  const index = args.indexOf(`--${name}`)
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1]
  return fallback
}

function intArg(name, fallback, cap = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(getArg(name, ''), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, cap)
}

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        cell += char
      }
      continue
    }

    if (char === '"') quoted = true
    else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (char !== '\r') {
      cell += char
    }
  }

  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }

  const [headers = [], ...body] = rows
  const normalizedHeaders = headers.map((header) => String(header || '').trim())
  return body
    .filter((values) => values.some((value) => String(value || '').trim()))
    .map((values) => Object.fromEntries(normalizedHeaders.map((header, index) => [header, values[index] || ''])))
}

function csvEscape(value) {
  const text = String(value ?? '')
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function writeCsv(filePath, rows, columns) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(
    filePath,
    [columns.join(','), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(','))].join('\n')
  )
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  return digits.length === 10 ? digits : ''
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}

function slug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeAddress(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\b(street)\b/g, 'st')
    .replace(/\b(avenue)\b/g, 'ave')
    .replace(/\b(road)\b/g, 'rd')
    .replace(/\b(drive)\b/g, 'dr')
    .replace(/\b(place)\b/g, 'pl')
    .replace(/\b(court)\b/g, 'ct')
    .replace(/\b(lane)\b/g, 'ln')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function marketFromFilename(filePath) {
  const name = path.basename(filePath, '.csv')
  const cleaned = name
    .replace(/^direct-/i, '')
    .replace(/-\d{7,}-.+$/i, '')
    .replace(/-\d{4}-\d{2}-\d{2}.+$/i, '')
    .replace(/-private-owner-contacts$/i, '')
  return cleaned || 'unknown-market'
}

function isDnc(value) {
  return /do\s*not\s*call|^dnc$|^true$|^yes$|^y$|^1$/i.test(String(value || '').trim())
}

function isWireless(value) {
  return /wireless|mobile|cell|\bw\b/i.test(String(value || '').trim())
}

function isResidentLike(row) {
  const text = [
    row.resident,
    row.owner_status,
    row.contact_flags,
    row.owner_match_strategy,
    row.likely_owner,
    row.in_owner_family,
  ].join(' ')
  return /\btenant\b|\brenter\b|\boccupant\b|resident\s*only|not\s*owner/i.test(text)
}

function ownerName(row) {
  return (
    row.owner_name ||
    row.contact_full_name ||
    [row.first_name, row.last_name].filter(Boolean).join(' ') ||
    'there'
  ).trim()
}

function firstName(row) {
  const name = ownerName(row)
  const first = name.split(/\s+/).find(Boolean)
  return first && !/there/i.test(first) ? first : 'there'
}

function address(row) {
  return (
    row.associated_property_address_full ||
    row.property_address_full ||
    row.address ||
    row.full_address ||
    ''
  ).trim()
}

function loadSuppressions() {
  try {
    const parsed = JSON.parse(fs.readFileSync(SUPPRESSIONS_FILE, 'utf8'))
    const entries = Array.isArray(parsed) ? parsed : parsed?.entries || []
    return new Set(entries.map((entry) => normalizePhone(entry.phone || entry.mobile || entry.phone_number)).filter(Boolean))
  } catch {
    return new Set()
  }
}

function loadPriorSmsPhones() {
  const sent = new Set()
  if (!fs.existsSync(OUT_DIR)) return sent
  for (const name of fs.readdirSync(OUT_DIR)) {
    if (!/^dealmachine-export-phone-send-results-.*\.json$/.test(name)) continue
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(OUT_DIR, name), 'utf8'))
      for (const row of parsed.results || []) {
        if (['submitted', 'verified'].includes(String(row.status || '').toLowerCase())) {
          const phone = normalizePhone(row.phone)
          if (phone) sent.add(phone)
        }
      }
    } catch {}
  }
  return sent
}

function latestExports(limitFiles) {
  const explicit = getArg('csv')
  if (explicit) return explicit.split(',').map((file) => path.resolve(file.trim())).filter(Boolean)
  if (!fs.existsSync(EXPORT_DIR)) return []
  return fs
    .readdirSync(EXPORT_DIR)
    .filter((name) => name.toLowerCase().endsWith('.csv'))
    .map((name) => {
      const file = path.join(EXPORT_DIR, name)
      return { file, mtimeMs: fs.statSync(file).mtimeMs }
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, limitFiles)
    .map((entry) => entry.file)
}

function messageFor(row, propertyAddress) {
  const first = firstName(row)
  const shortAddress = propertyAddress.split(',')[0] || 'your property'
  return `Hi ${first}, Robert with VestBlock. I wanted to ask if you would consider an as-is offer on ${shortAddress}. If not, no worries. Reply STOP to opt out.`
}

const limit = intArg('limit', 100, 1000)
const limitFiles = intArg('files', 40, 300)
const marketsFilter = new Set(
  getArg('markets', '')
    .split(',')
    .map(slug)
    .filter(Boolean)
)
const suppressions = loadSuppressions()
const priorSent = loadPriorSmsPhones()
const seenPhones = new Set()
const seenProperties = new Set()
const accepted = []
const rejected = new Map()
const files = latestExports(limitFiles)

function reject(reason) {
  rejected.set(reason, (rejected.get(reason) || 0) + 1)
}

for (const file of files) {
  const market = marketFromFilename(file)
  if (marketsFilter.size && !marketsFilter.has(slug(market))) continue
  if (!fs.existsSync(file)) {
    reject('missing_file')
    continue
  }

  const rows = parseCsv(fs.readFileSync(file, 'utf8'))
  for (const row of rows) {
    const propertyAddress = address(row)
    if (!propertyAddress) {
      reject('missing_property_address')
      continue
    }
    const propertyKey = normalizeAddress(propertyAddress)
    if (seenProperties.has(propertyKey)) {
      reject('duplicate_property')
      continue
    }
    if (isResidentLike(row)) {
      reject('resident_or_renter_contact')
      continue
    }

    for (const index of [1, 2, 3]) {
      const phone = normalizePhone(row[`phone_${index}`])
      if (!phone) {
        reject(`missing_phone_${index}`)
        continue
      }
      if (seenPhones.has(phone)) {
        reject('duplicate_phone')
        continue
      }
      if (suppressions.has(phone)) {
        reject('suppressed_phone')
        continue
      }
      if (priorSent.has(phone)) {
        reject('already_sent_phone')
        continue
      }
      if (isDnc(row[`phone_${index}_do_not_call`])) {
        reject('do_not_call')
        continue
      }
      if (!isWireless(row[`phone_${index}_type`])) {
        reject('not_wireless')
        continue
      }

      seenPhones.add(phone)
      seenProperties.add(propertyKey)
      accepted.push({
        strategy: 'dealmachine-owner-sms',
        market,
        property_address_full: propertyAddress,
        owner_name: ownerName(row),
        phone,
        do_not_call: 'not_flagged_by_dealmachine',
        phone_type: row[`phone_${index}_type`] || 'Wireless',
        can_text: 'true',
        source_file: path.relative(ROOT, file),
        text_message: messageFor(row, propertyAddress),
      })
      break
    }

    if (accepted.length >= limit) break
  }
  if (accepted.length >= limit) break
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const csvPath = path.join(OUT_DIR, `dealmachine-sms-ready-${stamp}.csv`)
const jsonPath = path.join(OUT_DIR, `dealmachine-sms-ready-${stamp}.json`)
const columns = [
  'strategy',
  'market',
  'property_address_full',
  'owner_name',
  'phone',
  'do_not_call',
  'phone_type',
  'can_text',
  'source_file',
  'text_message',
]

writeCsv(csvPath, accepted, columns)
fs.writeFileSync(
  jsonPath,
  `${JSON.stringify(
    {
      ok: true,
      createdAt: new Date().toISOString(),
      acceptedCount: accepted.length,
      requestedLimit: limit,
      sourceFiles: files.map((file) => path.relative(ROOT, file)),
      csvPath: path.relative(ROOT, csvPath),
      rejected: Object.fromEntries([...rejected.entries()].sort()),
    },
    null,
    2
  )}\n`
)

console.log('=== DealMachine SMS-ready queue ===')
console.log(`Accepted: ${accepted.length}/${limit}`)
console.log(`CSV:      ${csvPath}`)
console.log(`JSON:     ${jsonPath}`)
console.log(`Rejected: ${JSON.stringify(Object.fromEntries([...rejected.entries()].sort()))}`)
