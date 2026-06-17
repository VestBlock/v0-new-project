#!/usr/bin/env node

/**
 * Build a compliant SMS review queue from existing DealMachine phone exports.
 *
 * This never sends messages. It only prepares a review CSV/JSON and skips
 * DNC, suppressed, resident/renter, and uncertain phone records.
 */

import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const ROOT = process.cwd()
const DEFAULT_SOURCE_DIRS = [
  path.join(ROOT, 'data', 'distress-leads'),
  path.join(ROOT, 'tmp', 'outreach'),
]
const OUTPUT_DIR = path.join(ROOT, 'tmp', 'outreach')
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
  fs.writeFileSync(filePath, [columns.join(','), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(','))].join('\n'))
}

function pick(row, keys) {
  for (const key of keys) {
    const value = String(row[key] || '').trim()
    if (value) return value
  }
  return ''
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  return digits.length === 10 ? digits : ''
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}

function yes(value) {
  return ['true', 'yes', 'y', '1'].includes(normalizeText(value))
}

function no(value) {
  return ['false', 'no', 'n', '0'].includes(normalizeText(value))
}

function latestPhoneFiles(limitFiles) {
  const files = []
  for (const dir of DEFAULT_SOURCE_DIRS) {
    if (!fs.existsSync(dir)) continue
    for (const name of fs.readdirSync(dir)) {
      if (!/phone|mobile|sms/i.test(name) || !name.toLowerCase().endsWith('.csv')) continue
      const file = path.join(dir, name)
      const stat = fs.statSync(file)
      files.push({ file, mtime: stat.mtimeMs })
    }
  }
  return files
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limitFiles)
    .map((entry) => entry.file)
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

function inferLane(row, file) {
  const explicit = pick(row, ['strategy', 'lane', 'suggested_exit_paths', 'market_status'])
  const source = `${explicit} ${path.basename(file)}`.toLowerCase()
  if (source.includes('land')) return 'land-wholesale'
  if (source.includes('tax') || source.includes('code') || source.includes('blight')) return 'tax-code-stack'
  if (source.includes('preforeclosure')) return 'preforeclosure-equity'
  if (source.includes('lien')) return 'lien-equity'
  if (source.includes('portfolio')) return 'portfolio-landlord'
  if (source.includes('vacant')) return 'vacant-equity'
  return 'seller-review'
}

function messageFor(row, lane) {
  const address = pick(row, ['property_address_full', 'address', 'property_address', 'full_address']) || 'your property'
  const city = pick(row, ['property_city', 'city', 'market'])
  const suffix = city ? ` in ${city}` : ''
  if (lane === 'land-wholesale') return `Hi, this is Robert with VestBlock. I wanted to see if you'd consider a quick as-is cash offer for ${address}${suffix}. If not, no worries.`
  if (lane === 'tax-code-stack') return `Hi, this is Robert with VestBlock. I came across ${address}${suffix} and wanted to see if selling as-is for cash would be worth discussing.`
  if (lane === 'portfolio-landlord') return `Hi, this is Robert with VestBlock. Are you open to reviewing an as-is offer on ${address}${suffix}, or any other rentals you may be considering selling?`
  return `Hi, this is Robert with VestBlock. Would you consider an as-is cash offer for ${address}${suffix}?`
}

function evaluate(row, file, suppressedPhones) {
  const phone = normalizePhone(pick(row, ['phone', 'mobile', 'phone_1', 'phone_number', 'surfaced_phone_numbers']))
  if (!phone) return { rejectedReason: 'missing_or_invalid_phone' }
  if (suppressedPhones.has(phone)) return { rejectedReason: 'suppressed_phone' }

  const dnc = pick(row, ['do_not_call', 'dnc', 'surfaced_phone_dnc'])
  if (yes(dnc)) return { rejectedReason: 'dnc' }
  if (dnc && !no(dnc)) return { rejectedReason: 'uncertain_dnc_status' }

  const canText = pick(row, ['can_text', 'sms_ok', 'textable'])
  if (canText && !yes(canText)) return { rejectedReason: 'not_marked_textable' }

  const phoneType = normalizeText(pick(row, ['phone_type', 'surfaced_phone_types', 'type']))
  if (phoneType && !/(mobile|cell|wireless)/i.test(phoneType)) return { rejectedReason: 'not_mobile' }

  const ownerStatus = normalizeText(pick(row, ['owner_status', 'contact_type', 'relationship']))
  if (/(resident|tenant|renter|occupant)/i.test(ownerStatus)) return { rejectedReason: 'resident_or_renter_contact' }

  const lane = inferLane(row, file)
  return {
    accepted: {
      lane,
      market: pick(row, ['market', 'property_city', 'city']),
      property_address_full: pick(row, ['property_address_full', 'address', 'property_address', 'full_address']),
      owner_name: pick(row, ['owner_name', 'name', 'Owner Name']),
      phone,
      phone_type: phoneType,
      dnc_status: dnc ? 'not_dnc' : 'not_provided',
      source_file: path.relative(ROOT, file),
      message: messageFor(row, lane),
    },
  }
}

const limit = intArg('limit', 100, 500)
const limitFiles = intArg('files', 40, 300)
const suppressedPhones = loadSuppressions()
const seenPhones = new Set()
const accepted = []
const rejected = new Map()
const sourceFiles = latestPhoneFiles(limitFiles)

for (const file of sourceFiles) {
  const rows = parseCsv(fs.readFileSync(file, 'utf8'))
  for (const row of rows) {
    const result = evaluate(row, file, suppressedPhones)
    if (result.accepted) {
      if (seenPhones.has(result.accepted.phone)) {
        rejected.set('duplicate_phone', (rejected.get('duplicate_phone') || 0) + 1)
        continue
      }
      seenPhones.add(result.accepted.phone)
      accepted.push(result.accepted)
      if (accepted.length >= limit) break
    } else {
      rejected.set(result.rejectedReason, (rejected.get(result.rejectedReason) || 0) + 1)
    }
  }
  if (accepted.length >= limit) break
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const csvPath = path.join(OUTPUT_DIR, `sms-review-queue-${stamp}.csv`)
const jsonPath = path.join(OUTPUT_DIR, `sms-review-queue-${stamp}.json`)
const columns = ['lane', 'market', 'property_address_full', 'owner_name', 'phone', 'phone_type', 'dnc_status', 'source_file', 'message']
writeCsv(csvPath, accepted, columns)
fs.writeFileSync(jsonPath, `${JSON.stringify({
  createdAt: new Date().toISOString(),
  requestedLimit: limit,
  acceptedCount: accepted.length,
  sourceFiles: sourceFiles.map((file) => path.relative(ROOT, file)),
  rejected: Object.fromEntries([...rejected.entries()].sort()),
  csvPath: path.relative(ROOT, csvPath),
}, null, 2)}\n`)

console.log('=== VestBlock SMS review queue ===')
console.log(`Accepted: ${accepted.length}/${limit}`)
console.log(`CSV:      ${csvPath}`)
console.log(`JSON:     ${jsonPath}`)
console.log(`Rejected: ${JSON.stringify(Object.fromEntries([...rejected.entries()].sort()))}`)
