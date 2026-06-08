import fs from 'node:fs'
import path from 'node:path'

import { buildApprovedDraftPacket, reviewDraftForAutoApproval } from '../lib/leads/outreach-v4/approval.mjs'
import { loadSentLedgerSummary } from '../lib/leads/outreach-v4/sent-ledger.mjs'
import { draftOutreachV4 } from '../lib/leads/outreach-v4/templates.mjs'
import { normalizeEmail } from '../lib/leads/outreach-v4/utils.mjs'

function getArgValue(name, fallback = '') {
  const prefix = `${name}=`
  const inline = process.argv.filter((arg) => arg.startsWith(prefix)).at(-1)
  if (inline) return inline.slice(prefix.length)
  const index = process.argv.lastIndexOf(name)
  if (index >= 0 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--')) return process.argv[index + 1]
  return fallback
}

function intArg(name, fallback, cap) {
  const parsed = Number.parseInt(getArgValue(name, ''), 10)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Math.min(parsed, cap)
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function parseCsvLine(line) {
  const values = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]
    if (char === '"' && inQuotes && next === '"') {
      current += '"'
      index += 1
      continue
    }
    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (char === ',' && !inQuotes) {
      values.push(current)
      current = ''
      continue
    }
    current += char
  }
  values.push(current)
  return values
}

function readCsv(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').trim().split(/\r?\n/)
  const headers = parseCsvLine(lines.shift() || '')
  return lines.filter(Boolean).map((line) => {
    const values = parseCsvLine(line)
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || '']))
  })
}

function toDraftLead(row) {
  return {
    id: row.id,
    sourceType: row.source_type,
    vertical: row.vertical,
    businessName: row.business_name,
    propertyAddress: row.property_address,
    city: row.city,
    state: row.state,
    email: row.email,
    phone: row.phone,
    website: row.website,
    serviceFit: row.service_fit,
  }
}

async function main() {
  const date = getArgValue('--date', new Date().toISOString().slice(0, 10))
  const limit = intArg('--limit', 50, 100)
  const artifactDir = path.join(process.cwd(), 'artifacts', 'outreach-v4', date)
  const draftsPath = path.join(artifactDir, 'drafts.json')
  const acceptedLeadsPath = path.join(artifactDir, 'accepted-leads.csv')

  if (!fs.existsSync(acceptedLeadsPath)) throw new Error(`Missing accepted leads file: ${acceptedLeadsPath}`)

  const acceptedLeads = readCsv(acceptedLeadsPath)
  if (!fs.existsSync(draftsPath)) {
    const recoveredDrafts = acceptedLeads
      .filter((lead) => lead.status === 'draft_ready')
      .map((lead) => draftOutreachV4(toDraftLead(lead)))
    writeJson(draftsPath, recoveredDrafts)
  }
  const drafts = readJson(draftsPath)
  const leadsById = new Map(acceptedLeads.map((lead) => [lead.id, lead]))
  const { sentEmails } = loadSentLedgerSummary({ date })
  const reviewedAt = new Date().toISOString()
  const approved = []
  const rejected = []

  for (const draft of drafts) {
    const lead = leadsById.get(draft.leadId)
    const review = await reviewDraftForAutoApproval({ draft, lead })
    const alreadySent = sentEmails.has(normalizeEmail(lead?.email || draft?.to))
    if (review.approved && approved.length < limit) {
      if (alreadySent) {
        rejected.push({
          leadId: draft.leadId,
          vertical: draft.vertical,
          subject: draft.subject,
          status: 'not_auto_approved',
          reasons: ['already_sent_in_v4_ledger'],
        })
        continue
      }
      approved.push(buildApprovedDraftPacket({ draft, lead, reviewedAt }))
      continue
    }
    rejected.push({
      leadId: draft.leadId,
      vertical: draft.vertical,
      subject: draft.subject,
      status: 'not_auto_approved',
      reasons: review.approved ? ['approval_limit_reached'] : review.reasons,
    })
  }

  const summary = {
    ok: true,
    date,
    reviewedAt,
    reviewed: drafts.length,
    approved: approved.length,
    rejected: rejected.length,
    liveSendBlocked: true,
    sendRequiresExplicitApproval: true,
    approvedPath: path.join(artifactDir, 'approved-drafts.json'),
    rejectedPath: path.join(artifactDir, 'rejected-drafts.json'),
  }

  writeJson(summary.approvedPath, approved)
  writeJson(summary.rejectedPath, rejected)
  writeJson(path.join(artifactDir, 'approval-summary.json'), summary)
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2))
  process.exit(1)
})
