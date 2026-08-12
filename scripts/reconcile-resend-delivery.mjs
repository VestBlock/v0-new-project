#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const daysArg = args.find((arg) => arg.startsWith('--days='))
const DAYS = Math.max(1, Number.parseInt(daysArg?.split('=')[1] || '14', 10) || 14)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function requireEnv(name) {
  const value = String(process.env[name] || '').trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

function mapLastEvent(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (['delivered', 'opened', 'clicked', 'bounced', 'complained', 'suppressed', 'failed'].includes(normalized)) {
    return normalized
  }
  if (normalized === 'delivery_delayed') return normalized
  if (normalized === 'sent') return 'accepted'
  if (['queued', 'scheduled'].includes(normalized)) return 'queued'
  return 'unknown'
}

function leadStatusForProviderStatus(status) {
  if (['opened', 'clicked'].includes(status)) return 'delivered'
  return status
}

function severity(status) {
  return {
    unknown: 0,
    queued: 1,
    accepted: 2,
    delivery_delayed: 3,
    delivered: 4,
    opened: 5,
    clicked: 6,
    failed: 7,
    bounced: 8,
    suppressed: 9,
    complained: 10,
  }[status] || 0
}

async function fetchResendEmail(apiKey, id) {
  for (let attempt = 0; attempt < 7; attempt += 1) {
    const response = await fetch(`https://api.resend.com/emails/${id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (response.status === 429) {
      await sleep(Math.min(1000 * 2 ** attempt, 10000))
      continue
    }
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return { ok: false, status: response.status, error: data?.message || `HTTP ${response.status}` }
    }
    return { ok: true, data }
  }
  return { ok: false, status: 429, error: 'Rate limit retries exhausted.' }
}

async function loadSourceEvents(admin, since) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from('outreach_send_events')
      .select('id,lead_id,outreach_message_id,recipient,subject,metadata_json,created_at')
      .eq('provider', 'resend')
      .in('status', ['sent', 'accepted'])
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .range(from, from + 999)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < 1000) return rows
  }
}

async function main() {
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const resendApiKey = requireEnv('RESEND_API_KEY')
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString()
  const sourceEvents = await loadSourceEvents(admin, since)
  const unique = new Map()

  for (const row of sourceEvents) {
    const providerMessageId = row.metadata_json?.resendId || row.metadata_json?.providerMessageId
    if (providerMessageId && !unique.has(providerMessageId)) unique.set(providerMessageId, row)
  }

  const messages = Array.from(unique.entries())
  const results = []
  let cursor = 0

  async function worker() {
    while (true) {
      const index = cursor++
      if (index >= messages.length) return
      const [providerMessageId, sourceEvent] = messages[index]
      const provider = await fetchResendEmail(resendApiKey, providerMessageId)
      const status = provider.ok ? mapLastEvent(provider.data.last_event) : 'unknown'
      results.push({
        providerMessageId,
        sourceEvent,
        status,
        providerError: provider.ok ? null : provider.error,
        providerCreatedAt: provider.ok ? provider.data.created_at : null,
      })
      if (results.length % 50 === 0 || results.length === messages.length) {
        console.log(`Reconciled ${results.length}/${messages.length}`)
      }
      await sleep(100)
    }
  }

  await Promise.all(Array.from({ length: 6 }, () => worker()))

  const counts = results.reduce((summary, row) => {
    summary[row.status] = (summary[row.status] || 0) + 1
    return summary
  }, {})

  if (!APPLY) {
    console.log(JSON.stringify({ apply: false, since, sourceEvents: sourceEvents.length, uniqueMessages: messages.length, counts }, null, 2))
    return
  }

  const bestByLead = new Map()
  let insertedEvidence = 0
  let insertedEvents = 0

  for (const row of results) {
    if (row.status === 'unknown') continue
    const eventId = `reconcile:${row.providerMessageId}:${row.status}`
    const { data: evidence, error: evidenceError } = await admin
      .from('provider_delivery_events')
      .upsert(
        {
          provider: 'resend',
          provider_event_id: eventId,
          provider_message_id: row.providerMessageId,
          event_type: `email.${row.status}`,
          delivery_status: row.status,
          recipient: row.sourceEvent.recipient || null,
          subject: row.sourceEvent.subject || null,
          reason: row.providerError || null,
          metadata_json: { source: 'historical_reconciliation' },
          occurred_at: row.providerCreatedAt || row.sourceEvent.created_at,
        },
        { onConflict: 'provider,provider_event_id', ignoreDuplicates: true }
      )
      .select('id')
      .maybeSingle()
    if (evidenceError) throw evidenceError
    if (!evidence?.id) continue
    insertedEvidence += 1

    const { error: eventError } = await admin.from('outreach_send_events').insert({
      lead_id: row.sourceEvent.lead_id,
      outreach_message_id: row.sourceEvent.outreach_message_id || null,
      channel: 'email',
      provider: 'resend',
      status: row.status,
      recipient: row.sourceEvent.recipient || null,
      subject: row.sourceEvent.subject || null,
      error_message: row.providerError || null,
      metadata_json: {
        providerEventId: eventId,
        providerMessageId: row.providerMessageId,
        source: 'historical_reconciliation',
      },
    })
    if (eventError) throw eventError
    insertedEvents += 1

    const previous = bestByLead.get(row.sourceEvent.lead_id)
    if (!previous || severity(row.status) > severity(previous.status)) {
      bestByLead.set(row.sourceEvent.lead_id, row)
    }
  }

  let updatedLeads = 0
  let suppressionsAdded = 0
  for (const [leadId, row] of bestByLead.entries()) {
    const deliveryStatus = leadStatusForProviderStatus(row.status)
    const failed = ['bounced', 'complained', 'suppressed', 'failed'].includes(row.status)
    const reason = failed ? `Resend historical reconciliation reported ${row.status}.` : null
    const leadUpdates = { delivery_status: deliveryStatus }
    if (failed) {
      leadUpdates.email_valid = false
      leadUpdates.suppression_reason = reason
      leadUpdates.outreach_status = row.status === 'complained' ? 'do_not_contact' : 'failed'
    }
    const { error: leadError } = await admin.from('leads').update(leadUpdates).eq('id', leadId)
    if (leadError) throw leadError
    updatedLeads += 1

    const email = String(row.sourceEvent.recipient || '').trim().toLowerCase()
    if (failed && email) {
      const { data: existing, error: existingError } = await admin
        .from('lead_suppressions')
        .select('id')
        .eq('email', email)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()
      if (existingError) throw existingError
      if (!existing?.id) {
        const { error: suppressionError } = await admin.from('lead_suppressions').insert({ email, reason })
        if (suppressionError) throw suppressionError
        suppressionsAdded += 1
      }
    }
  }

  console.log(JSON.stringify({
    apply: true,
    since,
    sourceEvents: sourceEvents.length,
    uniqueMessages: messages.length,
    counts,
    insertedEvidence,
    insertedEvents,
    updatedLeads,
    suppressionsAdded,
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error)
  process.exit(1)
})
