#!/usr/bin/env node
// Gmail reply sync: turns inbox replies into attribution data automatically.
//
// Scans the sending inbox for messages FROM addresses we actually emailed (matched
// against the campaign ledger), classifies each as positive reply or opt-out, and
// writes the same records the manual `outreach:log-reply` command produces:
//   positive -> data/operating-loops/reply-log.jsonl + Supabase lead status 'replied'
//   negative -> data/outreach-suppressions.json + lead do_not_contact
//
// Review-first: default run only reports. Pass --apply to write.
// Processed Gmail message ids are remembered so nothing is double-counted.
//
// Requires GOOGLE_REFRESH_TOKEN with gmail.readonly scope (same one-time fix as the
// export pipeline: dealmachine-export-download.mjs --auth-url / --exchange-code).
//
// Usage:
//   npm run outreach:reply-sync            # report only
//   npm run outreach:reply-sync -- --apply # write reply log, suppressions, lead statuses
//   Flags: --days=7 --max=50

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const ROOT = process.cwd()
const OPS_DIR = path.join(ROOT, 'data', 'operating-loops')
const LEDGER_PATH = path.join(OPS_DIR, 'campaign-ledger.jsonl')
const REPLY_LOG_PATH = path.join(OPS_DIR, 'reply-log.jsonl')
const SUPPRESSIONS_PATH = path.join(ROOT, 'data', 'outreach-suppressions.json')
const STATE_PATH = path.join(OPS_DIR, 'reply-sync-state.json')

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const argValue = (name, fallback) => {
  const hit = [...args].reverse().find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const DAYS = Number(argValue('days', 7))
const MAX = Number(argValue('max', 50))

const NEGATIVE_RE = /unsubscribe|remove me|take me off|stop (emailing|contacting)|do not (contact|email)|wrong (person|owner|number)|not my property|never owned/i
const UPGRADE_STATUSES = new Set(['new', 'contacted', 'sent', 'queued', 'pending', ''])

function readJsonl(file) {
  try {
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
  } catch { return [] }
}

// ---- Gmail helpers (same pattern as process-gmail-bounces.mjs) -------------
async function getGoogleAccessToken() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error('Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN in environment.')
  }
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  })
  const data = await response.json()
  if (!response.ok || !data.access_token) throw new Error(`Google token refresh failed: ${JSON.stringify(data)}`)
  return data.access_token
}

async function gmailFetch(accessToken, resource) {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${resource}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await response.json()
  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('Gmail read scope missing. One-time fix: dealmachine-export-download.mjs --auth-url then --exchange-code=<code> --write-env')
    }
    throw new Error(`Gmail API error ${response.status}: ${JSON.stringify(data).slice(0, 200)}`)
  }
  return data
}

function decodeBase64Url(value) {
  return Buffer.from(String(value || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}

function collectPayloadText(payload, output = []) {
  if (!payload) return output
  if (payload.body?.data && /text\/(plain|html)/.test(payload.mimeType || '')) {
    output.push(decodeBase64Url(payload.body.data))
  }
  for (const part of payload.parts || []) collectPayloadText(part, output)
  return output
}

function headerValue(message, name) {
  return (message.payload?.headers || []).find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || ''
}

function extractEmail(fromHeader) {
  const match = String(fromHeader).match(/<([^>]+)>/)
  return (match ? match[1] : String(fromHeader)).trim().toLowerCase()
}

// ---- Local state -------------------------------------------------------------
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) } catch { return { processedMessageIds: [] } }
}

function appendReplyLog(entry) {
  fs.mkdirSync(OPS_DIR, { recursive: true })
  fs.appendFileSync(REPLY_LOG_PATH, `${JSON.stringify(entry)}\n`, 'utf8')
}

function appendSuppression(email, snippet) {
  let data = { emails: [] }
  try {
    const parsed = JSON.parse(fs.readFileSync(SUPPRESSIONS_PATH, 'utf8'))
    if (parsed && Array.isArray(parsed.emails)) data = parsed
    else if (Array.isArray(parsed)) data = { emails: parsed }
  } catch { /* fresh file */ }
  if (data.emails.some((row) => String(row.email || '').trim().toLowerCase() === email)) return false
  const now = new Date().toISOString()
  data.emails.push({
    email,
    reason: 'unsubscribe_reply',
    source: 'gmail_reply_sync',
    received_at: now,
    created_at: now,
    notes: `Auto-classified opt-out reply: "${snippet.slice(0, 140)}"`,
  })
  fs.writeFileSync(SUPPRESSIONS_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  return true
}

async function updateLeadStatus(admin, email, positive) {
  if (!admin) return 'no-supabase'
  const { data: leads, error } = await admin
    .from('leads')
    .select('id,status,outreach_status')
    .ilike('email', email)
    .limit(5)
  if (error || !leads?.length) return 'lead-not-found'
  const now = new Date().toISOString()
  if (positive) {
    const upgradable = leads.filter((lead) => UPGRADE_STATUSES.has(String(lead.status || '').toLowerCase()))
    if (!upgradable.length) return 'already-progressed'
    const { error: updateError } = await admin
      .from('leads')
      .update({ status: 'replied', updated_at: now })
      .in('id', upgradable.map((l) => l.id))
    return updateError ? `update-failed: ${updateError.message}` : `updated ${upgradable.length}`
  }
  const { error: updateError } = await admin
    .from('leads')
    .update({ status: 'do_not_contact', outreach_status: 'do_not_contact', updated_at: now })
    .in('id', leads.map((l) => l.id))
  return updateError ? `update-failed: ${updateError.message}` : `suppressed ${leads.length}`
}

// ---- Main ---------------------------------------------------------------------
async function main() {
  const recipients = new Set(
    readJsonl(LEDGER_PATH)
      .filter((event) => event.channel === 'email' && event.status === 'sent')
      .map((event) => String(event.recipient || '').trim().toLowerCase())
      .filter(Boolean)
  )
  if (!recipients.size) {
    console.error('Campaign ledger has no sent recipients — open /admin/command-center once to sync it, then rerun.')
    process.exit(1)
  }

  const state = loadState()
  const processed = new Set(state.processedMessageIds || [])
  const accessToken = await getGoogleAccessToken()
  const query = encodeURIComponent(`in:inbox newer_than:${DAYS}d -from:me -from:support@dealmachine.com -from:mailer-daemon`)
  const list = await gmailFetch(accessToken, `messages?q=${query}&maxResults=${MAX}`)
  const messages = list.messages || []
  console.log(`Gmail reply sync${APPLY ? '' : ' [report-only]'}: ${messages.length} inbox message(s) in last ${DAYS}d; ${recipients.size} known recipients.`)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const admin = APPLY && supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null

  let positives = 0
  let negatives = 0
  let skipped = 0
  const newlyProcessed = []

  for (const stub of messages) {
    if (processed.has(stub.id)) { skipped += 1; continue }
    const message = await gmailFetch(accessToken, `messages/${stub.id}?format=full`)
    const fromEmail = extractEmail(headerValue(message, 'From'))
    if (!recipients.has(fromEmail)) { newlyProcessed.push(stub.id); continue }

    const bodyText = collectPayloadText(message.payload).join('\n')
    const snippet = String(message.snippet || bodyText.slice(0, 160))
    const negative = NEGATIVE_RE.test(bodyText) || NEGATIVE_RE.test(snippet)
    const at = new Date(Number(message.internalDate) || Date.now()).toISOString()

    if (negative) {
      negatives += 1
      console.log(`  OPT-OUT  ${fromEmail} — "${snippet.slice(0, 80)}"`)
      if (APPLY) {
        appendSuppression(fromEmail, snippet)
        const result = await updateLeadStatus(admin, fromEmail, false)
        console.log(`           lead: ${result}`)
      }
    } else {
      positives += 1
      console.log(`  REPLY    ${fromEmail} — "${snippet.slice(0, 80)}"`)
      if (APPLY) {
        appendReplyLog({ email: fromEmail, status: 'replied', note: snippet.slice(0, 200), source: 'gmail_reply_sync', at, loggedAt: new Date().toISOString() })
        const result = await updateLeadStatus(admin, fromEmail, true)
        console.log(`           lead: ${result}`)
      }
    }
    newlyProcessed.push(stub.id)
  }

  if (APPLY && newlyProcessed.length) {
    fs.mkdirSync(OPS_DIR, { recursive: true })
    fs.writeFileSync(
      STATE_PATH,
      `${JSON.stringify({ updatedAt: new Date().toISOString(), processedMessageIds: [...processed, ...newlyProcessed].slice(-2000) }, null, 2)}\n`,
      'utf8'
    )
  }

  console.log(`\nResult: ${positives} repl${positives === 1 ? 'y' : 'ies'}, ${negatives} opt-out(s), ${skipped} already processed.`)
  if (!APPLY && (positives || negatives)) console.log('Rerun with --apply to write reply log, suppressions, and lead statuses.')
  if (APPLY && positives) console.log('Command-center lanes now show these replies. Work them before new volume.')
}

main().catch((error) => {
  console.error(`gmail-reply-sync failed: ${error?.message || error}`)
  process.exit(1)
})
