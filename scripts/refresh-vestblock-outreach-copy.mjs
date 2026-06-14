import { createClient } from '@supabase/supabase-js'

const TEMPLATE_VERSIONS = {
  buyer: 'vestblock-buyer-refresh-2026-06-11',
  lender: 'vestblock-lender-refresh-2026-06-11',
  legacyCleanup: 'vestblock-legacy-cleanup-2026-06-11',
}

const LEGACY_LEAD_TYPES = new Set([
  'ai_assistant',
  'business_funding',
  'google_places',
  'new_business_filing',
  'visibility_expansion',
])

const LEGACY_LEAD_SOURCES = new Set([
  'account_signup_growth_system',
  'apify_yelp_businesses',
  'google_places_businesses',
  'outscraper_google_maps_businesses',
  'sam_contract_opportunities',
  'wisconsin_dfi_new_businesses',
])

const ACTIVE_MESSAGE_STATUSES = new Set(['draft', 'needs_review', 'approved', 'queued'])

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

async function fetchAll(table, columns, pageSize = 1000) {
  const rows = []

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1
    const { data, error } = await supabase.from(table).select(columns).range(from, to)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < pageSize) break
  }

  return rows
}

async function upsertInChunks(table, rows, chunkSize = 200) {
  let updated = 0

  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize)
    const { error, data } = await supabase.from(table).upsert(chunk, { onConflict: 'id' }).select('id')
    if (error) throw error
    updated += data?.length || chunk.length
  }

  return updated
}

function humanize(value) {
  return String(value || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
    .replace(/\bDscr\b/g, 'DSCR')
    .replace(/\bCdfi\b/g, 'CDFI')
    .replace(/\bHeloc\b/g, 'HELOC')
    .replace(/\bSba\b/g, 'SBA')
    .replace(/\bBrrrr\b/g, 'BRRRR')
}

function buyerLabel(buyer) {
  return humanize(buyer.category || buyer.buyer_type || 'buyer')
}

function lenderLabel(lender) {
  return humanize(lender.category || lender.lender_type || 'lender')
}

function buyerGreeting(buyer) {
  return buyer.contact_name || buyer.name || 'team'
}

function lenderGreeting(lender) {
  return lender.contact_name || lender.name || 'team'
}

function buildBuyerCopy(channel, buyer) {
  const label = buyerLabel(buyer)
  const greeting = buyerGreeting(buyer)

  if (channel === 'email_intro') {
    return {
      subject: `VestBlock deal flow aligned to your ${label} buy box`,
      cta: 'Open to a quick conversation about your buy box, acquisition criteria, and preferred submissions process?',
      body: `Hi ${greeting},\n\nI’m reaching out from VestBlock. We organize seller opportunities and route them by market, asset type, distress level, and real acquisition criteria instead of blasting deals to the wrong list.\n\nOn the seller side, we are working opportunities through fast cash, creative, and novation paths. On the partner side, we want a clean buy box so the right deals move quickly.\n\nWe also attach an AEO/SEO Booster to serious network partners once their positioning and criteria are clear, so the relationship is supported by more inbound visibility and not just manual outreach.\n\nThe first things we usually want to understand are your active markets, preferred asset types, rehab tolerance, close speed, and any hard no-go items.\n\nIf your team already has a buy box or intake sheet, send it over and we’ll align to it.\n\nThanks,\nRobert Sanders\nVestBlock\nacquisitions@vestblock.io`,
    }
  }

  if (channel === 'email_followup') {
    return {
      subject: 'Quick follow-up on your VestBlock buy box and partner fit',
      cta: 'A short reply with your buy box or acquisitions process is enough for us to get started.',
      body: `Hi ${greeting},\n\nWanted to circle back on my earlier note. We’re building a cleaner buyer network for ${label} and would rather understand your real acquisition box than send mismatched deals.\n\nWe are trying to build this the right way: cleaner seller intake, sharper routing, better buyer partnerships, and optional AEO/SEO Booster support once a partner’s positioning is clear.\n\nEven a short reply with your markets, property types, distress tolerance, close speed, and preferred submissions process would help a lot.\n\nThanks again,\nRobert Sanders\nVestBlock\nacquisitions@vestblock.io`,
    }
  }

  if (channel === 'spanish_email') {
    return {
      subject: `VestBlock y su criterio de compra para ${label}`,
      cta: '¿Están abiertos a una breve conversación sobre criterios de compra y envíos?',
      body: `Hola ${greeting},\n\nLe escribo de VestBlock. Ayudamos a organizar oportunidades de vendedores y propiedades en dificultad antes de conectarlas con el comprador correcto.\n\nQueremos entender sus mercados activos, tipos de propiedad, nivel de dificultad aceptable y proceso de envíos para ${label}, así podemos mandar únicamente oportunidades que sí tengan sentido.\n\nTambién podemos apoyar a socios serios con un AEO/SEO Booster cuando su posicionamiento y criterios ya estén claros.\n\nSi ya tienen un buy box o una hoja de criterios, con gusto nos adaptamos.\n\nGracias,\nRobert Sanders\nVestBlock\nacquisitions@vestblock.io`,
    }
  }

  if (channel === 'linkedin_dm') {
    return {
      subject: null,
      cta: 'Open to a quick buy-box conversation?',
      body: `Hi, I’m building out VestBlock’s buyer network and came across ${buyer.name}. We help route seller opportunities by market and fit instead of blasting deals to a list. If your team is open to acquisitions or partner conversations for ${label}, I’d love to compare notes on your buy box and hard no-go items.`,
    }
  }

  if (channel === 'phone_script') {
    return {
      subject: null,
      cta: 'Who is the right person for acquisitions or partner submissions?',
      body: `Hi, this is VestBlock. We help organize seller and distressed-property opportunities before they reach a buyer, and I’m calling to see who handles acquisitions or partner conversations for ${buyer.name}. We’d rather understand your real buy box than send mismatched deals.`,
    }
  }

  return null
}

function buildLenderCopy(channel, lender) {
  const label = lenderLabel(lender)
  const greeting = lenderGreeting(lender)

  if (channel === 'email_intro') {
    return {
      subject: `VestBlock deals matched to your ${label} lending criteria`,
      cta: 'Open to a quick conversation about your lending box, preferred borrowers, and partner process?',
      body: `Hi ${greeting},\n\nI’m reaching out from VestBlock. We organize operators and real-estate deals before they reach a lender, so your team sees cleaner files and better-fit submissions.\n\nOn the seller and operator side, we are working opportunities through fast cash, creative, novation, bridge, rehab, DSCR, and long-term hold conversations. On the partner side, we want your real lending box so the right files move quickly.\n\nWe also attach an AEO/SEO Booster to serious network partners once their positioning and lending criteria are clear, so the relationship is supported by more inbound visibility and not just manual outbound.\n\nThe first things we usually want to understand are states served, preferred deal types, leverage guidelines, borrower profile, and hard no-go items.\n\nIf your team already has a one-pager, product sheet, or fit box, send it over and we’ll align to it.\n\nThanks,\nRobert Sanders\nVestBlock\nacquisitions@vestblock.io`,
    }
  }

  if (channel === 'email_followup') {
    return {
      subject: 'Quick follow-up on your VestBlock lending box',
      cta: 'A short reply with your fit box or partner process is enough for us to get started.',
      body: `Hi ${greeting},\n\nWanted to circle back on my earlier note. We’re building a cleaner lender network for ${label} and would rather understand your real fit box than send mismatched borrowers or deals.\n\nWe are trying to build this the right way: cleaner seller and operator intake, sharper routing, better lender relationships, and optional AEO/SEO Booster support once a partner’s positioning is clear.\n\nEven a short reply with states served, preferred deal types, borrower profile, and hard no-go items would help a lot.\n\nThanks again,\nRobert Sanders\nVestBlock\nacquisitions@vestblock.io`,
    }
  }

  if (channel === 'spanish_email') {
    return {
      subject: `VestBlock y su criterio de colocación para ${label}`,
      cta: '¿Están abiertos a una breve conversación sobre criterios y alianzas?',
      body: `Hola ${greeting},\n\nLe escribo de VestBlock. Ayudamos a organizar clientes y oportunidades inmobiliarias antes de conectarlos con el prestamista correcto.\n\nQueremos entender los estados donde prestan, los productos que prefieren, el perfil del prestatario ideal y los casos que no aceptan para ${label}, así podemos mandar únicamente oportunidades que sí tengan sentido.\n\nTambién podemos apoyar a socios serios con un AEO/SEO Booster cuando su posicionamiento y criterios ya estén claros.\n\nGracias,\nRobert Sanders\nVestBlock\nacquisitions@vestblock.io`,
    }
  }

  if (channel === 'linkedin_dm') {
    return {
      subject: null,
      cta: 'Open to a quick lender-fit conversation?',
      body: `Hi, I’m building out VestBlock’s lender network and came across ${lender.name}. We help route cleaner deal and borrower opportunities by fit instead of blasting files across the wrong lenders. If your team is open to partner conversations for ${label}, I’d love to compare notes on your preferred fit box and hard no-go items.`,
    }
  }

  if (channel === 'phone_script') {
    return {
      subject: null,
      cta: 'Who is the best person for partner/referral conversations?',
      body: `Hi, this is VestBlock. We help organize and pre-qualify borrowers and real-estate deals before they reach a lender, and I’m calling to see who handles partnership or referral conversations for ${lender.name}. We’d rather understand your real box than send mismatched files.`,
    }
  }

  return null
}

async function archiveLegacyLeadOutreach() {
  const leads = await fetchAll('leads', 'id,lead_type,source')

  const legacyLeadIds = leads
    .filter((lead) => LEGACY_LEAD_TYPES.has(String(lead.lead_type || '').toLowerCase()) || LEGACY_LEAD_SOURCES.has(String(lead.source || '')))
    .map((lead) => lead.id)

  if (!legacyLeadIds.length) return 0

  const messages = await fetchAll('outreach_messages', '*')
  const activeMessages = messages.filter(
    (message) => legacyLeadIds.includes(message.lead_id) && ACTIVE_MESSAGE_STATUSES.has(String(message.status || ''))
  )

  const now = new Date().toISOString()
  const payload = activeMessages.map((message) => ({
    ...message,
    status: 'archived',
    generated_with: TEMPLATE_VERSIONS.legacyCleanup,
    updated_at: now,
  }))

  return upsertInChunks('outreach_messages', payload)
}

async function refreshBuyerOutreach() {
  const [buyers, messages] = await Promise.all([
    fetchAll('buyers', 'id,name,contact_name,category,buyer_type,relationship_stage,outreach_status'),
    fetchAll('buyer_outreach_messages', '*'),
  ])

  const buyersById = new Map(buyers.map((buyer) => [buyer.id, buyer]))
  const payload = []

  for (const message of messages.filter((item) => ACTIVE_MESSAGE_STATUSES.has(String(item.status || '')))) {
    const buyer = buyersById.get(message.buyer_id)
    if (!buyer) continue
    if (['do_not_contact'].includes(String(buyer.outreach_status || ''))) continue
    if (['not_a_fit', 'paused'].includes(String(buyer.relationship_stage || ''))) continue

    const copy = buildBuyerCopy(message.channel, buyer)
    if (!copy) continue

    const metadata = {
      ...(message.metadata_json || {}),
      templateVersion: TEMPLATE_VERSIONS.buyer,
      refreshedAt: new Date().toISOString(),
    }

    payload.push({
      ...message,
      subject: copy.subject,
      body: copy.body,
      cta: copy.cta,
      status: 'needs_review',
      generated_with: 'template',
      metadata_json: metadata,
      last_generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }

  return upsertInChunks('buyer_outreach_messages', payload)
}

async function refreshLenderOutreach() {
  const [lenders, messages] = await Promise.all([
    fetchAll('lenders', 'id,name,contact_name,category,lender_type,relationship_stage,outreach_status'),
    fetchAll('lender_outreach_messages', '*'),
  ])

  const lendersById = new Map(lenders.map((lender) => [lender.id, lender]))
  const payload = []

  for (const message of messages.filter((item) => ACTIVE_MESSAGE_STATUSES.has(String(item.status || '')))) {
    const lender = lendersById.get(message.lender_id)
    if (!lender) continue
    if (['do_not_contact'].includes(String(lender.outreach_status || ''))) continue
    if (['not_a_fit', 'paused'].includes(String(lender.relationship_stage || ''))) continue

    const copy = buildLenderCopy(message.channel, lender)
    if (!copy) continue

    const metadata = {
      ...(message.metadata_json || {}),
      templateVersion: TEMPLATE_VERSIONS.lender,
      refreshedAt: new Date().toISOString(),
    }

    payload.push({
      ...message,
      subject: copy.subject,
      body: copy.body,
      cta: copy.cta,
      status: 'needs_review',
      generated_with: 'template',
      metadata_json: metadata,
      last_generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }

  return upsertInChunks('lender_outreach_messages', payload)
}

const archivedLeadMessages = await archiveLegacyLeadOutreach()
const refreshedBuyerMessages = await refreshBuyerOutreach()
const refreshedLenderMessages = await refreshLenderOutreach()

console.log(
  JSON.stringify(
    {
      ok: true,
      archivedLeadMessages,
      refreshedBuyerMessages,
      refreshedLenderMessages,
    },
    null,
    2
  )
)
