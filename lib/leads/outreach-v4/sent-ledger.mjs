import fs from 'node:fs'
import path from 'node:path'

import { normalizeEmail } from './utils.mjs'

const DEFAULT_TIME_ZONE = 'America/Chicago'

function datePrefix(value) {
  const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2})/)
  return match?.[1] || ''
}

function localDateKey(value, timeZone = process.env.OUTREACH_V4_TIME_ZONE || DEFAULT_TIME_ZONE) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return datePrefix(value)

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  return year && month && day ? `${year}-${month}-${day}` : datePrefix(value)
}

export function loadSentLedgerSummary({ date = '' } = {}) {
  const ledgerPath = path.join(process.cwd(), 'artifacts', 'outreach-v4', 'sent-ledger.jsonl')
  const sentEmails = new Set()
  let sentToday = 0

  if (!fs.existsSync(ledgerPath)) {
    return { ledgerPath, sentEmails, sentToday }
  }

  const targetDate = datePrefix(date)
  const rows = fs.readFileSync(ledgerPath, 'utf8').split(/\r?\n/).filter(Boolean)
  for (const line of rows) {
    try {
      const row = JSON.parse(line)
      const email = normalizeEmail(row?.to)
      if (email) sentEmails.add(email)

      const sentAtDate = localDateKey(row?.sentAt)
      const batchDate = datePrefix(row?.date)
      if (targetDate && (sentAtDate === targetDate || batchDate === targetDate)) sentToday += 1
    } catch {
      continue
    }
  }

  return { ledgerPath, sentEmails, sentToday }
}
