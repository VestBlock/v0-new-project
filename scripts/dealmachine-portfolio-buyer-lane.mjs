/**
 * Build a buyer lane from DealMachine Contacts exports by finding owners with
 * 5+ distinct associated properties. These are likely portfolio landlords,
 * local operators, or repeat buyers worth asking for buy-box criteria.
 *
 * Usage:
 *   node --env-file=.env.local scripts/dealmachine-portfolio-buyer-lane.mjs
 *   node --env-file=.env.local scripts/dealmachine-portfolio-buyer-lane.mjs --apply --limit=100
 */

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

import { normalizeEmailAddress } from './shared-email-quality.mjs'

const ROOT = process.cwd()
const DM_DIR = path.join(ROOT, 'data', 'dm-exports')
const OUT_DIR = path.join(ROOT, 'data', 'buyer-lanes', 'portfolio-landlord-dealmachine')

function argValue(name, fallback = '') {
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`))
  if (inline) return inline.slice(name.length + 1)
  return fallback
}

function hasFlag(name) {
  return process.argv.includes(name)
}

const APPLY = hasFlag('--apply')
const MIN_PROPERTIES = Number.parseInt(argValue('--min-properties', '5'), 10)
const LIMIT = Number.parseInt(argValue('--limit', '250'), 10)
const DATE = new Date().toISOString().slice(0, 10)
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-')
const DRAFTS_DIR = path.join(
  ROOT,
  'artifacts',
  'offline-automation',
  'outreach-drafts',
  DATE,
  'buyers',
  'dealmachine-portfolio-landlords'
)

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
      } else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (char !== '\r') cell += char
  }
  if (cell.length || row.length) {
    row.push(cell)
    rows.push(row)
  }
  const [headers = [], ...body] = rows
  return body
    .filter((cols) => cols.some((value) => String(value || '').trim()))
    .map((cols) => Object.fromEntries(headers.map((header, index) => [String(header || '').trim(), String(cols[index] || '').trim()])))
}

function csvEscape(value) {
  const text = String(value ?? '')
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function writeCsv(rows, headers) {
  return `${headers.join(',')}\n${rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')).join('\n')}\n`
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'portfolio-buyer'
}

function cleanName(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\b(undefined|null|unknown)\b/gi, '')
    .trim()
}

function getFirst(row, names) {
  for (const name of names) {
    const hit = row[name]
    if (hit && String(hit).trim()) return String(hit).trim()
    const key = Object.keys(row).find((candidate) => candidate.toLowerCase() === name.toLowerCase())
    if (key && row[key]) return String(row[key]).trim()
  }
  return ''
}

function getOwnerName(row) {
  return cleanName(
    getFirst(row, ['owner_name', 'contact_full_name']) ||
      [getFirst(row, ['first_name']), getFirst(row, ['last_name'])].filter(Boolean).join(' ')
  )
}

function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(llc|inc|corp|corporation|company|co|ltd|limited|the)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function getMailing(row) {
  return [
    getFirst(row, ['primary_mailing_address', 'mailing_address', 'owner_mailing_address_full']),
    getFirst(row, ['primary_mailing_city', 'owner_mailing_address_city']),
    getFirst(row, ['primary_mailing_state', 'owner_mailing_address_state']),
    getFirst(row, ['primary_mailing_zip', 'owner_mailing_address_zip']),
  ].filter(Boolean).join(', ')
}

function getPropertyAddress(row) {
  return getFirst(row, ['associated_property_address_full', 'property_address_full', 'property_address', 'address'])
}

function parseCityState(address) {
  const parts = String(address || '').split(',').map((part) => part.trim()).filter(Boolean)
  if (parts.length >= 3) {
    const city = parts[parts.length - 2]
    const stateZip = parts[parts.length - 1].split(/\s+/)
    return { city, state: stateZip[0] || '' }
  }
  return { city: '', state: '' }
}

function getEmails(row) {
  return ['email_address_1', 'email_address_2', 'email_address_3', 'email', 'emails']
    .flatMap((key) => String(row[key] || '').split(/[;|,\s]+/))
    .map(normalizeEmailAddress)
    .filter((email) => /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,24}$/.test(email))
}

function isDnc(row, index) {
  return /^(yes|true|1)$/i.test(String(row[`phone_${index}_do_not_call`] || row[`phone_${index}_dnc`] || '').trim())
}

function getPhones(row) {
  const phones = []
  for (const index of [1, 2, 3]) {
    const value = String(row[`phone_${index}`] || '').replace(/\D/g, '')
    if (value.length >= 10 && !isDnc(row, index)) phones.push(value.slice(-10))
  }
  return phones
}

function hash(value) {
  return crypto.createHash('sha1').update(String(value)).digest('hex').slice(0, 16)
}

function firstName(value) {
  const token = String(value || '').trim().split(/\s+/)[0]
  return /^[a-z]+$/i.test(token) ? token : 'there'
}

function draftFor(row) {
  return `To: ${row.email}
Subject: ${row.primary_market || 'Portfolio'} buy box - quick criteria check
Market: ${row.primary_market || ''}
Website:
Company: ${row.business_name || ''}
Source: dealmachine_portfolio_landlord

Hi ${firstName(row.contact_person || row.business_name)},

I’m reaching out from VestBlock. We are building a buyer network around real buy boxes, not just blasting every deal to every investor.

I noticed your ownership footprint across ${row.property_count} properties in/around ${row.primary_market || 'your market'}, so I wanted to ask what you are actually buying right now.

Could you send over your criteria on:
- target cities, ZIPs, or neighborhoods
- single family, small multifamily, land, or mixed use
- price range and rehab tolerance
- occupied vs vacant preference
- cash, DSCR, subject-to, seller finance, or hybrid structures
- minimum rent/yield expectations
- what is an automatic no

If you share the buy box, we can route only relevant seller opportunities instead of wasting your time with mismatched deals.

If this is not relevant, reply no and I will not follow up.

Best,
Robert Sanders
VestBlock
acquisitions@vestblock.io`
}

function supabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

async function listDmExports() {
  const entries = await fs.readdir(DM_DIR, { withFileTypes: true }).catch(() => [])
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.csv'))
    .map((entry) => path.join(DM_DIR, entry.name))
}

async function loadGroups(files) {
  const groups = new Map()
  for (const file of files) {
    const rows = parseCsv(await fs.readFile(file, 'utf8'))
    for (const row of rows) {
      const ownerName = getOwnerName(row)
      const propertyAddress = getPropertyAddress(row)
      if (!ownerName || !propertyAddress) continue

      const mailing = getMailing(row)
      const key = normalizeKey(`${ownerName}|${mailing || getFirst(row, ['contact_id'])}`)
      if (!key || key.length < 4) continue

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          ownerName,
          mailing,
          contactIds: new Set(),
          files: new Set(),
          properties: new Map(),
          emails: new Set(),
          phones: new Set(),
          markets: new Map(),
        })
      }
      const group = groups.get(key)
      group.contactIds.add(getFirst(row, ['contact_id']))
      group.files.add(path.relative(ROOT, file))
      group.properties.set(normalizeKey(propertyAddress), propertyAddress)
      for (const email of getEmails(row)) group.emails.add(email)
      for (const phone of getPhones(row)) group.phones.add(phone)
      const { city, state } = parseCityState(propertyAddress)
      const market = [city, state].filter(Boolean).join(', ')
      if (market) group.markets.set(market, (group.markets.get(market) || 0) + 1)
    }
  }
  return [...groups.values()]
}

function groupToRow(group) {
  const markets = [...group.markets.entries()].sort((a, b) => b[1] - a[1])
  const propertyCount = group.properties.size
  const states = [...new Set(markets.map(([market]) => market.split(',').at(-1)?.trim()).filter(Boolean))]
  const cities = [...new Set(markets.map(([market]) => market.split(',')[0]?.trim()).filter(Boolean))]
  const emails = [...group.emails]
  const phones = [...group.phones]
  const primaryMarket = markets[0]?.[0] || ''
  const sourceFiles = [...group.files].slice(0, 10)

  return {
    external_id: `dm-portfolio-owner-${hash(group.key)}`,
    business_name: group.ownerName,
    contact_person: group.ownerName,
    email: emails[0] || '',
    all_emails: emails.join('; '),
    phone: phones[0] || '',
    all_phones: phones.join('; '),
    property_count: propertyCount,
    primary_market: primaryMarket,
    markets: markets.map(([market, count]) => `${market} (${count})`).join('; '),
    cities: cities.join('; '),
    states: states.join('; '),
    mailing_address: group.mailing,
    sample_properties: [...group.properties.values()].slice(0, 8).join(' | '),
    source_files: sourceFiles.join('; '),
    buyer_lane: 'portfolio_landlord_buyer_criteria',
    lead_type: 'dealmachine_owner_with_5_plus_properties',
    fit_score_total: Math.min(100, 55 + propertyCount * 4 + emails.length * 8 + phones.length * 4),
    why_like_brad_or_enrique: `Owns ${propertyCount} distinct properties in DealMachine exports; likely landlord/operator worth qualifying for buy-box criteria.`,
  }
}

async function upsertToSupabase(rows) {
  const supabase = supabaseClient()
  if (!supabase) return { attempted: false, buyers: 0, messages: 0, error: 'Missing Supabase service env.' }

  let buyers = 0
  let messages = 0
  for (const row of rows) {
    const states = row.states ? row.states.split(';').map((item) => item.trim()).filter(Boolean) : []
    const cities = row.cities ? row.cities.split(';').map((item) => item.trim()).filter(Boolean) : []
    const [headquartersCity = null, headquartersState = null] = row.primary_market.split(',').map((item) => item.trim())
    const buyerPayload = {
      name: row.business_name,
      website: null,
      buyer_type: 'local_operator',
      category: 'landlord_buyer',
      buyer_size: Number(row.property_count) >= 10 ? '10_plus_properties' : '5_plus_properties',
      headquarters_city: headquartersCity,
      headquarters_state: headquartersState,
      markets_served: row.markets ? row.markets.split(';').map((item) => item.replace(/\s+\(\d+\)$/, '').trim()).filter(Boolean) : [],
      national_or_regional: states.length > 1 ? 'multi_state' : 'regional',
      contact_email: row.email || null,
      contact_phone: row.phone || null,
      contact_name: row.contact_person || null,
      source: 'dealmachine_portfolio_owner_scan',
      source_url: null,
      external_id: row.external_id,
      outreach_status: row.email ? 'needs_review' : 'not_started',
      relationship_stage: row.email ? 'outreach_ready' : 'researched',
      confidence_score: Number(row.fit_score_total) || 70,
      fit_summary: row.why_like_brad_or_enrique,
      notes: 'Auto-routed from DealMachine owner portfolio scan. Ask for buy-box criteria before sending deals.',
      closing_speed: null,
      proof_of_funds_status: null,
      contact_info: { allEmails: row.all_emails, allPhones: row.all_phones, mailingAddress: row.mailing_address },
      metadata_json: {
        buyerLane: row.buyer_lane,
        propertyCount: Number(row.property_count),
        markets: row.markets,
        sampleProperties: row.sample_properties,
        sourceFiles: row.source_files,
        generatedAt: RUN_ID,
      },
    }
    const { data: buyer, error } = await supabase
      .from('buyers')
      .upsert(buyerPayload, { onConflict: 'source,external_id' })
      .select('id')
      .single()
    if (error) throw error
    buyers += 1

    await supabase.from('buyer_buy_boxes').delete().eq('buyer_id', buyer.id)
    await supabase.from('buyer_buy_boxes').insert({
      buyer_id: buyer.id,
      buy_box_name: 'Portfolio landlord criteria to confirm',
      asset_types: ['single_family', 'small_multifamily'],
      states,
      cities,
      occupancy_preference: 'ask_buyer',
      distressed_tolerance: 6,
      code_violation_tolerance: 5,
      tenant_occupied_allowed: true,
      section8_allowed: true,
      preferred_deal_types: ['cash_purchase', 'dscr', 'subject_to', 'seller_finance', 'hybrid'],
      closing_speed: null,
      proof_of_funds_status: 'criteria_requested',
      creative_finance_open: true,
      portfolio_size_preference: `${row.property_count}+ properties observed`,
      active: true,
      notes: 'Generated from DealMachine ownership footprint; criteria must be confirmed by outreach.',
      metadata_json: { source: 'dealmachine_portfolio_owner_scan', sampleProperties: row.sample_properties },
    })

    await supabase.from('buyer_markets').delete().eq('buyer_id', buyer.id)
    if (cities.length || states.length) {
      await supabase.from('buyer_markets').insert(
        cities.slice(0, 8).map((city) => ({
          buyer_id: buyer.id,
          city,
          state: states[0] || null,
          market_type: 'observed_ownership',
          active: true,
          metadata_json: { source: 'dealmachine_portfolio_owner_scan' },
        }))
      )
    }

    await supabase.from('buyer_contacts').delete().eq('buyer_id', buyer.id)
    if (row.email || row.phone) {
      await supabase.from('buyer_contacts').insert({
        buyer_id: buyer.id,
        name: row.contact_person || null,
        title: 'Portfolio owner / buyer prospect',
        email: row.email || null,
        phone: row.phone || null,
        preferred_channel: row.email ? 'email' : 'phone',
        is_primary: true,
        confidence_score: 75,
        metadata_json: { allEmails: row.all_emails, allPhones: row.all_phones },
      })
    }

    if (row.email) {
      await supabase.from('buyer_outreach_messages').upsert(
        {
          buyer_id: buyer.id,
          channel: 'email_intro',
          subject: `${row.primary_market || 'Portfolio'} buy box - quick criteria check`,
          body: draftFor(row).split('\n').slice(6).join('\n').trim(),
          cta: 'Reply with current buy-box criteria.',
          partnership_angle: 'Portfolio owner appears active from DealMachine ownership footprint.',
          property_referral_angle: 'VestBlock can route seller opportunities that match their criteria.',
          compliance_note: 'Includes opt-out language.',
          status: 'needs_review',
          language: 'en',
          generated_with: 'dealmachine-portfolio-buyer-lane',
          last_generated_at: new Date().toISOString(),
          metadata_json: { templateVersion: 'portfolio-landlord-criteria-v1', sourceRow: row.external_id },
        },
        { onConflict: 'buyer_id,channel' }
      )
      messages += 1
    }
  }
  return { attempted: true, buyers, messages, error: null }
}

async function main() {
  const files = await listDmExports()
  const groups = await loadGroups(files)
  const candidates = groups
    .filter((group) => group.properties.size >= MIN_PROPERTIES)
    .map(groupToRow)
    .sort((a, b) => Number(b.fit_score_total) - Number(a.fit_score_total) || Number(b.property_count) - Number(a.property_count))
    .slice(0, LIMIT)

  const emailReady = candidates.filter((row) => row.email)
  await fs.mkdir(OUT_DIR, { recursive: true })
  await fs.mkdir(DRAFTS_DIR, { recursive: true })

  const headers = [
    'external_id',
    'business_name',
    'contact_person',
    'email',
    'all_emails',
    'phone',
    'all_phones',
    'property_count',
    'primary_market',
    'markets',
    'cities',
    'states',
    'mailing_address',
    'sample_properties',
    'source_files',
    'buyer_lane',
    'lead_type',
    'fit_score_total',
    'why_like_brad_or_enrique',
  ]
  const fullCsv = path.join(OUT_DIR, `portfolio-landlord-buyers-${RUN_ID}.csv`)
  const emailCsv = path.join(OUT_DIR, `portfolio-landlord-buyers-email-ready-${RUN_ID}.csv`)
  await fs.writeFile(fullCsv, writeCsv(candidates, headers), 'utf8')
  await fs.writeFile(emailCsv, writeCsv(emailReady, headers), 'utf8')

  const oldDrafts = (await fs.readdir(DRAFTS_DIR).catch(() => [])).filter((entry) => entry.endsWith('.md'))
  await Promise.all(oldDrafts.map((entry) => fs.unlink(path.join(DRAFTS_DIR, entry)).catch(() => {})))
  for (const [index, row] of emailReady.slice(0, 50).entries()) {
    const file = path.join(DRAFTS_DIR, `${String(index + 1).padStart(2, '0')}-${slugify(row.business_name)}.md`)
    await fs.writeFile(file, draftFor(row), 'utf8')
  }

  const supabase = APPLY ? await upsertToSupabase(candidates) : { attempted: false, buyers: 0, messages: 0, error: null }
  const summary = {
    ok: true,
    apply: APPLY,
    generatedAt: new Date().toISOString(),
    sourceFilesScanned: files.length,
    ownerGroups: groups.length,
    minProperties: MIN_PROPERTIES,
    candidates: candidates.length,
    emailReady: emailReady.length,
    phoneReady: candidates.filter((row) => row.phone).length,
    fullCsv,
    emailCsv,
    draftsDir: DRAFTS_DIR,
    draftsWritten: Math.min(emailReady.length, 50),
    supabase,
  }
  await fs.writeFile(path.join(OUT_DIR, `portfolio-landlord-buyers-summary-${RUN_ID}.json`), `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2))
  process.exit(1)
})
