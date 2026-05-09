import { randomBytes } from 'node:crypto'
import { queueSeoForBuyerRecord, queueSeoForLenderRecord } from '@/lib/content/entitySeoExpansion'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBuyerById, insertBuyerRelationshipEvent, updateBuyerRecord, updateBuyerPerformance } from '@/lib/buyers/repository'
import { getLenderById, insertLenderRelationshipEvent, updateLenderPerformance, updateLenderRecord } from '@/lib/lenders/repository'
import type { BuyerMatchRecord, BuyerRecord, BuyerRelationshipStage } from '@/lib/buyers/types'
import type { LenderMatchRecord, LenderRecord, LenderRelationshipStage } from '@/lib/lenders/types'

export type PartnerPortalType = 'buyer' | 'lender'

export type PartnerPortalAccessRecord = {
  id: string
  partner_type: PartnerPortalType
  partner_id: string
  partner_name: string | null
  contact_email: string | null
  access_token: string
  access_token_preview: string | null
  label: string | null
  last_viewed_at: string | null
  last_submitted_at: string | null
  last_shared_at: string | null
  revoked_at: string | null
  metadata_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

function siteBaseUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') || 'https://vestblock.io'
}

function tokenPrefix(partnerType: PartnerPortalType) {
  return partnerType === 'lender' ? 'vlp' : 'vbp'
}

export function buildPartnerPortalUrl(partnerType: PartnerPortalType, token: string) {
  const segment = partnerType === 'lender' ? 'lenders' : 'buyers'
  return `${siteBaseUrl()}/partners/${segment}/${token}`
}

function generatePortalToken(partnerType: PartnerPortalType) {
  return `${tokenPrefix(partnerType)}_${randomBytes(24).toString('base64url')}`
}

function previewToken(token: string) {
  return `${token.slice(0, 8)}...${token.slice(-6)}`
}

export async function createPartnerPortalAccess(input: {
  partnerType: PartnerPortalType
  partnerId: string
  partnerName?: string | null
  contactEmail?: string | null
  label?: string | null
  metadata?: Record<string, unknown>
}) {
  const admin = createAdminClient()
  const token = generatePortalToken(input.partnerType)

  await admin
    .from('partner_portal_access')
    .update({
      revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('partner_type', input.partnerType)
    .eq('partner_id', input.partnerId)
    .is('revoked_at', null)

  const { data, error } = await admin
    .from('partner_portal_access')
    .insert({
      partner_type: input.partnerType,
      partner_id: input.partnerId,
      partner_name: input.partnerName || null,
      contact_email: input.contactEmail || null,
      access_token: token,
      access_token_preview: previewToken(token),
      label: input.label || 'primary',
      last_shared_at: new Date().toISOString(),
      metadata_json: input.metadata || {},
    })
    .select('*')
    .single()

  if (error) throw error

  return {
    access: data as PartnerPortalAccessRecord,
    token,
    url: buildPartnerPortalUrl(input.partnerType, token),
  }
}

export async function getPartnerPortalAccessByToken(token: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('partner_portal_access')
    .select('*')
    .eq('access_token', token)
    .is('revoked_at', null)
    .maybeSingle()

  if (error) throw error
  return (data || null) as PartnerPortalAccessRecord | null
}

export async function touchPartnerPortalAccess(accessId: string, field: 'last_viewed_at' | 'last_submitted_at') {
  const admin = createAdminClient()
  await admin
    .from('partner_portal_access')
    .update({
      [field]: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', accessId)
}

export async function getLenderPortalPayload(token: string) {
  const access = await getPartnerPortalAccessByToken(token)
  if (!access || access.partner_type !== 'lender') return null

  await touchPartnerPortalAccess(access.id, 'last_viewed_at')
  const detail = await getLenderById(access.partner_id)

  return {
    access,
    lender: detail.lender,
    contacts: detail.contacts,
    products: detail.products,
    programs: detail.programs,
    outreach: detail.outreach.filter((message) => message.status !== 'archived'),
    matches: detail.matches,
    performance: detail.performance,
  }
}

export async function getBuyerPortalPayload(token: string) {
  const access = await getPartnerPortalAccessByToken(token)
  if (!access || access.partner_type !== 'buyer') return null

  await touchPartnerPortalAccess(access.id, 'last_viewed_at')
  const detail = await getBuyerById(access.partner_id)

  return {
    access,
    buyer: detail.buyer,
    buyBoxes: detail.buyBoxes,
    markets: detail.markets,
    contacts: detail.contacts,
    outreach: detail.outreach.filter((message) => message.status !== 'archived'),
    matches: detail.matches,
    performance: detail.performance,
  }
}

function nextLenderStage(current: LenderRelationshipStage): LenderRelationshipStage {
  if (['active_partner', 'paused', 'not_a_fit'].includes(current)) return current
  return 'responded'
}

function nextBuyerStage(current: BuyerRelationshipStage): BuyerRelationshipStage {
  if (['active_buyer', 'paused', 'not_a_fit'].includes(current)) return current
  return 'responded'
}

export async function saveLenderPortalProfile(input: {
  access: PartnerPortalAccessRecord
  lender: LenderRecord
  updates: Record<string, unknown>
  partnerProfile?: Record<string, unknown>
}) {
  const metadata =
    input.lender.metadata_json && typeof input.lender.metadata_json === 'object'
      ? (input.lender.metadata_json as Record<string, unknown>)
      : {}

  const lender = await updateLenderRecord(input.lender.id, {
    ...input.updates,
    relationship_stage: nextLenderStage(input.lender.relationship_stage),
    outreach_status: input.lender.outreach_status === 'do_not_contact' ? input.lender.outreach_status : 'responded',
    metadata_json: input.partnerProfile
      ? {
          ...metadata,
          partnerProfile: {
            ...(metadata.partnerProfile && typeof metadata.partnerProfile === 'object'
              ? (metadata.partnerProfile as Record<string, unknown>)
              : {}),
            ...input.partnerProfile,
          },
        }
      : metadata,
  })

  await touchPartnerPortalAccess(input.access.id, 'last_submitted_at')
  await insertLenderRelationshipEvent({
    lenderId: input.lender.id,
    eventType: 'partner_portal_profile_updated',
    metadata: { portalAccessId: input.access.id },
  })
  await updateLenderPerformance(input.lender.id, {
    last_responded_at: new Date().toISOString(),
  })

  await queueSeoForLenderRecord({
    id: lender.id,
    name: lender.name,
    category: lender.category,
    headquarters_city: lender.headquarters_city,
    headquarters_state: lender.headquarters_state,
    relationship_stage: lender.relationship_stage,
  }).catch((error) => {
    console.warn('[entity-seo] lender portal queue skipped:', error)
  })

  return lender
}

export async function saveBuyerPortalProfile(input: {
  access: PartnerPortalAccessRecord
  buyer: BuyerRecord
  updates: Record<string, unknown>
  buyBox?: Record<string, unknown>
}) {
  const metadata =
    input.buyer.metadata_json && typeof input.buyer.metadata_json === 'object'
      ? (input.buyer.metadata_json as Record<string, unknown>)
      : {}

  const buyer = await updateBuyerRecord(input.buyer.id, {
    ...input.updates,
    relationship_stage: nextBuyerStage(input.buyer.relationship_stage),
    outreach_status: input.buyer.outreach_status === 'do_not_contact' ? input.buyer.outreach_status : 'responded',
    metadata_json: input.buyBox
      ? {
          ...metadata,
          partnerProfile: {
            ...(metadata.partnerProfile && typeof metadata.partnerProfile === 'object'
              ? (metadata.partnerProfile as Record<string, unknown>)
              : {}),
            ...input.buyBox,
          },
        }
      : metadata,
  })

  await touchPartnerPortalAccess(input.access.id, 'last_submitted_at')
  await insertBuyerRelationshipEvent({
    buyerId: input.buyer.id,
    eventType: 'partner_portal_profile_updated',
    metadata: { portalAccessId: input.access.id },
  })
  await updateBuyerPerformance(input.buyer.id, {
    last_responded_at: new Date().toISOString(),
  })

  await queueSeoForBuyerRecord({
    id: buyer.id,
    name: buyer.name,
    category: buyer.category,
    headquarters_city: buyer.headquarters_city,
    headquarters_state: buyer.headquarters_state,
    relationship_stage: buyer.relationship_stage,
  }).catch((error) => {
    console.warn('[entity-seo] buyer portal queue skipped:', error)
  })

  return buyer
}

export async function updateLenderPortalMatchStatus(input: {
  access: PartnerPortalAccessRecord
  lender: LenderRecord
  match: LenderMatchRecord
  status: LenderMatchRecord['status']
  note?: string | null
}) {
  const admin = createAdminClient()
  const nextMetadata =
    input.match.metadata_json && typeof input.match.metadata_json === 'object'
      ? { ...input.match.metadata_json }
      : {}

  nextMetadata.partnerPortal = {
    respondedAt: new Date().toISOString(),
    note: input.note || null,
    accessId: input.access.id,
  }

  const { data, error } = await admin
    .from('lender_matches')
    .update({
      status: input.status,
      metadata_json: nextMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.match.id)
    .eq('lender_id', input.lender.id)
    .select('*')
    .single()

  if (error) throw error

  await updateLenderRecord(input.lender.id, {
    relationship_stage: input.status === 'active' ? 'active_partner' : nextLenderStage(input.lender.relationship_stage),
    last_contacted_at: new Date().toISOString(),
    next_follow_up_at: input.status === 'active' ? null : input.lender.next_follow_up_at,
  })
  await touchPartnerPortalAccess(input.access.id, 'last_submitted_at')
  await insertLenderRelationshipEvent({
    lenderId: input.lender.id,
    eventType: 'partner_portal_match_updated',
    metadata: {
      portalAccessId: input.access.id,
      matchId: input.match.id,
      status: input.status,
      note: input.note || null,
    },
  })

  await queueSeoForLenderRecord({
    id: input.lender.id,
    name: input.lender.name,
    category: input.lender.category,
    headquarters_city: input.lender.headquarters_city,
    headquarters_state: input.lender.headquarters_state,
    relationship_stage: input.status === 'active' ? 'active_partner' : nextLenderStage(input.lender.relationship_stage),
  }).catch((error) => {
    console.warn('[entity-seo] lender match queue skipped:', error)
  })

  return data as LenderMatchRecord
}

export async function updateBuyerPortalMatchStatus(input: {
  access: PartnerPortalAccessRecord
  buyer: BuyerRecord
  match: BuyerMatchRecord
  status: BuyerMatchRecord['status']
  note?: string | null
}) {
  const admin = createAdminClient()
  const nextMetadata =
    input.match.metadata_json && typeof input.match.metadata_json === 'object'
      ? { ...input.match.metadata_json }
      : {}

  nextMetadata.partnerPortal = {
    respondedAt: new Date().toISOString(),
    note: input.note || null,
    accessId: input.access.id,
  }

  const { data, error } = await admin
    .from('buyer_matches')
    .update({
      status: input.status,
      metadata_json: nextMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.match.id)
    .eq('buyer_id', input.buyer.id)
    .select('*')
    .single()

  if (error) throw error

  await updateBuyerRecord(input.buyer.id, {
    relationship_stage: input.status === 'active' ? 'active_buyer' : nextBuyerStage(input.buyer.relationship_stage),
    last_contacted_at: new Date().toISOString(),
    next_follow_up_at: input.status === 'active' ? null : input.buyer.next_follow_up_at,
  })
  await touchPartnerPortalAccess(input.access.id, 'last_submitted_at')
  await insertBuyerRelationshipEvent({
    buyerId: input.buyer.id,
    eventType: 'partner_portal_match_updated',
    metadata: {
      portalAccessId: input.access.id,
      matchId: input.match.id,
      status: input.status,
      note: input.note || null,
    },
  })

  await queueSeoForBuyerRecord({
    id: input.buyer.id,
    name: input.buyer.name,
    category: input.buyer.category,
    headquarters_city: input.buyer.headquarters_city,
    headquarters_state: input.buyer.headquarters_state,
    relationship_stage: input.status === 'active' ? 'active_buyer' : nextBuyerStage(input.buyer.relationship_stage),
  }).catch((error) => {
    console.warn('[entity-seo] buyer match queue skipped:', error)
  })

  return data as BuyerMatchRecord
}
