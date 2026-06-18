#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const args = process.argv.slice(2)
const getArg = (name, fallback = '') => {
  const hit = [...args].reverse().find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split('=').slice(1).join('=').trim() : fallback
}
const ROOT = process.cwd()
const OUT_DIR = path.join(ROOT, 'data', 'operating-loops')
const inputArg = getArg('input')

function env(name) { return String(process.env[name] || '').trim() }
function admin() {
  const url = env('NEXT_PUBLIC_SUPABASE_URL') || env('SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Missing Supabase admin env vars.')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
function slug(value) { return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') }
function numberish(value) { const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(parsed) ? parsed : null }
function money(value) {
  const num = numberish(value)
  if (!num || num <= 0) return ''
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num)
}
function latestDraftJson() {
  const dir = path.join(ROOT, 'tmp', 'outreach')
  if (!fs.existsSync(dir)) return ''
  return fs.readdirSync(dir)
    .filter((name) => /^stale-listing-drafts-.*\.json$/i.test(name))
    .map((name) => path.join(dir, name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] || ''
}
async function findExistingLead(client, draft, externalId) {
  const byExternal = await client.from('leads').select('id').eq('source', 'homeharvest_stale_listing').eq('external_id', externalId).maybeSingle()
  if (byExternal.error) throw byExternal.error
  if (byExternal.data?.id) return byExternal.data
  const byAddress = await client.from('leads').select('id').eq('property_address', draft.address).eq('email', String(draft.agent_email || '').toLowerCase()).limit(1)
  if (byAddress.error) throw byAddress.error
  return byAddress.data?.[0] || null
}
async function upsertLead(client, draft, inputPath) {
  const now = new Date().toISOString()
  const externalId = draft.mls_id ? `mls-${slug(draft.mls)}-${slug(draft.mls_id)}` : slug(`${draft.address}-${draft.listing_url || draft.agent_email}`)
  const existing = await findExistingLead(client, draft, externalId)
  const price = numberish(draft.price)
  const low = price ? Math.round(price * 0.5) : null
  const high = price ? Math.round(price * 0.6) : null
  const payload = {
    lead_type: 'sell_house',
    source: 'homeharvest_stale_listing',
    source_url: draft.listing_url || null,
    category: 'seller_lead',
    external_id: externalId,
    name: draft.agent_name || draft.office_name || null,
    business_name: draft.brokerage || draft.office_name || null,
    property_address: draft.address || null,
    phone: draft.agent_phone || null,
    email: String(draft.agent_email || draft.office_email || '').trim().toLowerCase() || null,
    city: draft.city || null,
    state: draft.state || null,
    zip: draft.zip || null,
    website: draft.listing_url || null,
    best_offer: 'On-market as-is cash review',
    lead_score: numberish(draft.distress_score) || 70,
    urgency_level: Number(draft.days_on_market || 0) >= 90 ? 'high' : 'medium',
    contactability_level: draft.agent_email ? 'high' : draft.agent_phone ? 'medium' : 'low',
    market_segment: 'seller_lead',
    niche: 'active_stale_lowball',
    email_valid: Boolean(draft.agent_email),
    bounce_risk_score: draft.agent_email ? 15 : null,
    status: 'outreach_ready',
    outreach_status: 'needs_review',
    delivery_status: 'queued',
    last_outreach_generated_at: now,
    imported_at: now,
    pain_signal: `${draft.days_on_market ?? 'Unknown'} DOM listing${draft.distress_reasons ? ` with ${draft.distress_reasons}` : ''}.`,
    outreach_angle: 'Conditional as-is cash review for stale or distressed on-market listing',
    notes: 'Fresh HomeHarvest on-market seller opportunity staged for review. Do not send until approved.',
    estimated_value_label: price ? money(price) : null,
    contact_info: {
      source: 'homeharvest',
      agentName: draft.agent_name || null,
      agentEmail: draft.agent_email || null,
      agentPhone: draft.agent_phone || null,
      brokerage: draft.brokerage || draft.office_name || null,
      sourceFile: inputPath,
    },
    form_data: {
      market: draft.market || null,
      listPrice: draft.price || null,
      daysOnMarket: draft.days_on_market || null,
      beds: draft.beds || null,
      baths: draft.baths || null,
      sqft: draft.sqft || null,
      yearBuilt: draft.year_built || null,
      mls: draft.mls || null,
      mlsId: draft.mls_id || null,
      status: draft.status || null,
      mlsStatus: draft.mls_status || null,
      style: draft.style || null,
      primaryPhoto: draft.primary_photo || null,
      lowballRangeLow: low,
      lowballRangeHigh: high,
    },
    metadata_json: {
      commandCenterSync: true,
      sourceScript: 'import-stale-listing-seller-leads',
      strategy: 'active-stale-lowball',
      offerMode: draft.offer_mode || 'lowball',
      distressScore: draft.distress_score || null,
      distressReasons: draft.distress_reasons || null,
      analyzerReason: draft.analyzer_reason || null,
      text: draft.text || null,
    },
  }
  if (existing?.id) {
    const { data, error } = await client.from('leads').update({ ...payload, updated_at: now }).eq('id', existing.id).select('id').single()
    if (error) throw error
    return data.id
  }
  const { data, error } = await client.from('leads').insert(payload).select('id').single()
  if (error) throw error
  return data.id
}
async function upsertMessage(client, leadId, draft) {
  const now = new Date().toISOString()
  const existing = await client.from('outreach_messages').select('id').eq('lead_id', leadId).eq('channel', 'email').limit(1)
  if (existing.error) throw existing.error
  const payload = {
    lead_id: leadId,
    channel: 'email',
    subject: draft.subject || `${draft.address || 'Listing'} - as-is review`,
    body: draft.body || '',
    cta: 'Ask whether the seller is open to a conditional as-is investor review.',
    language: 'en',
    compliance_note: 'Review-only queue. Includes opt-out language and no guaranteed offer.',
    generated_with: 'homeharvest_stale_listing_import',
    status: 'needs_review',
    approved_at: null,
    approved_by_user_id: null,
    sent_at: null,
    send_provider: null,
    send_error: null,
    last_generated_at: now,
    variant_key: draft.offer_mode || 'lowball',
  }
  if (existing.data?.[0]?.id) {
    const { data, error } = await client.from('outreach_messages').update({ ...payload, updated_at: now }).eq('id', existing.data[0].id).select('id').single()
    if (error) throw error
    return data.id
  }
  const { data, error } = await client.from('outreach_messages').insert(payload).select('id').single()
  if (error) throw error
  return data.id
}
async function logQueuedEvent(client, leadId, messageId, draft) {
  const { error } = await client.from('outreach_send_events').insert({
    lead_id: leadId,
    outreach_message_id: messageId,
    channel: 'email',
    provider: 'vestblock_queue',
    status: 'queued',
    recipient: draft.agent_email || draft.office_email || null,
    subject: draft.subject || null,
    error_message: null,
    metadata_json: {
      source: 'homeharvest_stale_listing_import',
      strategy: 'active-stale-lowball',
      market: draft.market || null,
      propertyAddress: draft.address || null,
      mlsId: draft.mls_id || null,
    },
  })
  if (error) throw error
}
async function main() {
  const inputPath = path.resolve(inputArg || latestDraftJson())
  if (!inputPath || !fs.existsSync(inputPath)) throw new Error('Missing --input and no stale-listing draft JSON found.')
  const drafts = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
  if (!Array.isArray(drafts)) throw new Error('Input must be a stale-listing draft JSON array.')
  const client = admin()
  const result = { sourceRows: drafts.length, upserted: 0, messages: 0, events: 0, skipped: 0, errors: [] }
  for (const draft of drafts) {
    try {
      if (!draft.address || (!draft.agent_email && !draft.agent_phone)) { result.skipped += 1; continue }
      const leadId = await upsertLead(client, draft, inputPath)
      const messageId = await upsertMessage(client, leadId, draft)
      await logQueuedEvent(client, leadId, messageId, draft)
      result.upserted += 1
      result.messages += 1
      result.events += 1
    } catch (error) {
      result.errors.push({ address: draft.address || null, error: error instanceof Error ? error.message : String(error) })
    }
  }
  const createdAt = new Date().toISOString()
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const reportPath = path.join(OUT_DIR, `stale-listing-import-${createdAt.replace(/[:.]/g, '-')}.json`)
  const summary = { ok: result.errors.length === 0, inputPath: path.relative(ROOT, inputPath), createdAt, ...result }
  fs.writeFileSync(reportPath, `${JSON.stringify(summary, null, 2)}\n`)
  console.log(JSON.stringify({ ...summary, reportPath }, null, 2))
  if (result.errors.length) process.exitCode = 1
}
main().catch((error) => { console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2)); process.exit(1) })
