#!/usr/bin/env node
// Operator reply logger: turns an inbox reply into structured attribution data.
//
// Positive replies  -> Supabase lead status update + local reply log
//                      (feeds replySignals7d and per-strategy campaign reply counts)
// Negative replies  -> suppression record + lead do_not_contact
//                      (feeds optOuts in campaign rollups and blocks future sends)
//
// Usage:
//   npm run outreach:log-reply -- --email=owner@example.com --status=replied --note="Wants an offer, asked about timeline"
//   npm run outreach:log-reply -- --email=owner@example.com --status=opt_out --note="Reply said unsubscribe"
//   Flags: --status=replied|interested|qualified|closed_won|opt_out|wrong_owner|bounced
//          --property="123 Main St, Milwaukee, WI"  --source=outlook_acquisitions  --dry-run

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const ROOT = process.cwd()
const REPLY_LOG_PATH = path.join(ROOT, 'data', 'operating-loops', 'reply-log.jsonl')
const SUPPRESSION_PATH = path.join(ROOT, 'data', 'outreach-suppressions.json')

const POSITIVE_STATUSES = new Set(['replied', 'interested', 'qualified', 'closed_won'])
const NEGATIVE_STATUSES = new Set(['opt_out', 'wrong_owner', 'bounced'])
const SUPPRESSION_REASONS = {
  opt_out: 'unsubscribe_reply',
  wrong_owner: 'wrong_owner_reply',
  bounced: 'bounce',
}

function arg(name, fallback = '') {
  const prefix = `--${name}=`
  const hit = process.argv.filter((piece) => piece.startsWith(prefix)).pop()
  return hit ? hit.slice(prefix.length) : fallback
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`)
}

function fail(message) {
  console.error(`log-reply: ${message}`)
  process.exit(1)
}

const email = arg('email').trim().toLowerCase()
const status = arg('status').trim().toLowerCase()
const note = arg('note').trim()
const property = arg('property').trim()
const source = arg('source', 'operator_inbox').trim()
const dryRun = hasFlag('dry-run')

if (!email || !email.includes('@')) fail('pass a valid --email=...')
if (!POSITIVE_STATUSES.has(status) && !NEGATIVE_STATUSES.has(status)) {
  fail(`--status must be one of: ${[...POSITIVE_STATUSES, ...NEGATIVE_STATUSES].join(', ')}`)
}

const now = new Date().toISOString()

function appendReplyLog(entry) {
  fs.mkdirSync(path.dirname(REPLY_LOG_PATH), { recursive: true })
  fs.appendFileSync(REPLY_LOG_PATH, `${JSON.stringify(entry)}\n`, 'utf8')
}

function appendSuppression() {
  let data = { emails: [] }
  try {
    const parsed = JSON.parse(fs.readFileSync(SUPPRESSION_PATH, 'utf8'))
    if (parsed && Array.isArray(parsed.emails)) data = parsed
    else if (Array.isArray(parsed)) data = { emails: parsed }
  } catch {
    // start fresh
  }
  const already = data.emails.some((row) => String(row.email || '').trim().toLowerCase() === email)
  if (already) {
    console.log(`Suppression already contains ${email}; skipping duplicate record.`)
    return
  }
  data.emails.push({
    email,
    reason: SUPPRESSION_REASONS[status],
    source,
    property_address: property || undefined,
    received_at: now,
    created_at: now,
    notes: note || `Logged via log-reply as ${status}.`,
  })
  fs.writeFileSync(SUPPRESSION_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  console.log(`Suppression recorded for ${email} (${SUPPRESSION_REASONS[status]}).`)
}

async function updateSupabaseLead() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('Supabase admin credentials missing; logged locally only. Lead status was NOT updated.')
    return { updated: 0 }
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: leads, error } = await admin
    .from('leads')
    .select('id,email,status,outreach_status,business_name,property_address')
    .ilike('email', email)
    .limit(10)
  if (error) throw error
  if (!leads?.length) {
    console.warn(`No lead found for ${email}; logged locally only.`)
    return { updated: 0 }
  }

  const patch = POSITIVE_STATUSES.has(status)
    ? { status, updated_at: now }
    : {
        outreach_status: 'do_not_contact',
        status: status === 'bounced' ? 'bounced' : 'do_not_contact',
        updated_at: now,
      }

  if (dryRun) {
    console.log(`[dry-run] Would update ${leads.length} lead(s):`, leads.map((l) => l.id).join(', '), patch)
    return { updated: 0 }
  }

  const ids = leads.map((lead) => lead.id)
  const { error: updateError } = await admin.from('leads').update(patch).in('id', ids)
  if (updateError) throw updateError

  if (note) {
    try {
      await admin.from('lead_notes').insert(
        ids.map((leadId) => ({ lead_id: leadId, note: `[reply:${status}] ${note}`, created_at: now }))
      )
    } catch (noteError) {
      console.warn(`Lead note insert skipped: ${noteError?.message || noteError}`)
    }
  }

  console.log(`Updated ${ids.length} lead(s) to ${JSON.stringify(patch)} for ${email}.`)
  return { updated: ids.length }
}

async function main() {
  const entry = { email, status, note: note || null, property: property || null, source, at: now, loggedAt: now }

  if (dryRun) {
    console.log('[dry-run] Would log:', JSON.stringify(entry))
  } else if (POSITIVE_STATUSES.has(status)) {
    appendReplyLog(entry)
    console.log(`Reply logged: ${email} -> ${status} (${REPLY_LOG_PATH})`)
  } else {
    appendSuppression()
  }

  await updateSupabaseLead()

  console.log('Next: open /admin/command-center — the strategy lane that sent to this address now shows the attributed signal.')
}

main().catch((error) => {
  console.error(`log-reply failed: ${error?.message || error}`)
  process.exit(1)
})
