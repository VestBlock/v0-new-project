import 'server-only'

import { deliverBuyerPacket } from '@/lib/buyers/packetDelivery'
import { matchPropertyToBuyers } from '@/lib/buyers/matching'
import {
  buildPropertyBuyerMatchInputFromLead,
  evaluateQualifiedSellerRouting,
} from '@/lib/buyers/qualifiedSellerRoutingCore'
import { listActiveBuyersWithBuyBoxes } from '@/lib/buyers/repository'
import { persistPropertyBuyerMatches } from '@/lib/buyers/service'
import type { BuyerBuyBoxRecord, PropertyBuyerMatchInput } from '@/lib/buyers/types'
import type { LeadRecord } from '@/lib/leads/types'
import { getReplyCaptureReadiness } from '@/lib/outreach/reply-capture'
import { createAdminClient } from '@/lib/supabase/admin'
import { logEvent } from '@/lib/system/logEvent'

function envBool(name: string, fallback = false) {
  const raw = process.env[name]
  if (!raw) return fallback
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase())
}

function envInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

async function previewMatches(input: PropertyBuyerMatchInput) {
  const { buyers, buyBoxes } = await listActiveBuyersWithBuyBoxes()
  const byBuyerId = new Map<string, BuyerBuyBoxRecord[]>()
  for (const box of buyBoxes) {
    const current = byBuyerId.get(box.buyer_id) || []
    current.push(box)
    byBuyerId.set(box.buyer_id, current)
  }
  return matchPropertyToBuyers(input, buyers, byBuyerId)
}

export async function routeQualifiedSellerLeadToBuyers(
  leadId: string,
  options: { dryRun?: boolean; autoSend?: boolean } = {}
) {
  const admin = createAdminClient()
  const { data, error } = await admin.from('leads').select('*').eq('id', leadId).single()
  if (error) throw error
  const lead = data as LeadRecord
  const evaluation = evaluateQualifiedSellerRouting(lead)
  if (!evaluation.eligible) {
    return { ok: false, leadId, status: 'skipped', reason: evaluation.reason, matchCount: 0 }
  }

  const input = buildPropertyBuyerMatchInputFromLead(lead)
  if (options.dryRun) {
    const matches = await previewMatches(input)
    return {
      ok: true,
      leadId,
      status: evaluation.legalSensitivity ? 'review_only' : 'would_prepare',
      reason: evaluation.reason,
      matchCount: matches.length,
      packetId: null,
      delivery: null,
    }
  }

  const matches = await persistPropertyBuyerMatches(input)
  const { data: packet, error: packetError } = await admin
    .from('property_buyer_packets')
    .select('*')
    .contains('metadata_json', { leadId })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (packetError) throw packetError

  const replyCapture = getReplyCaptureReadiness()
  const autoSendRequested = options.autoSend ?? envBool('BUYER_PACKET_AUTO_SEND_ENABLED', false)
  const canAutoSend =
    autoSendRequested &&
    lead.status === 'qualified' &&
    !evaluation.legalSensitivity &&
    replyCapture.ready &&
    Boolean(packet?.id)

  const delivery = packet?.id
    ? await deliverBuyerPacket(packet.id, {
        dryRun: !canAutoSend,
        requireConfirmedBuyer: true,
        maxRecipients: envInt('BUYER_PACKET_AUTO_SEND_LIMIT', 3),
      })
    : null

  const status = evaluation.legalSensitivity
    ? 'review_only'
    : canAutoSend
      ? delivery?.acceptedCount
        ? 'provider_accepted'
        : 'ready_no_confirmed_buyers'
      : 'ready_for_review'

  await logEvent({
    eventType: 'qualified_seller_buyer_routing',
    entityType: 'lead',
    entityId: leadId,
    metadata: {
      status,
      packetId: packet?.id || null,
      matchCount: matches.length,
      autoSendRequested,
      replyCaptureReady: replyCapture.ready,
      legalSensitivity: evaluation.legalSensitivity,
      acceptedCount: delivery?.acceptedCount || 0,
    },
  })

  return {
    ok: true,
    leadId,
    status,
    reason: evaluation.reason,
    matchCount: matches.length,
    packetId: packet?.id || null,
    replyCapture,
    delivery,
  }
}

export async function runQualifiedSellerBuyerRouting(
  limit = 25,
  options: { dryRun?: boolean; autoSend?: boolean } = {}
) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('leads')
    .select('*')
    .in('status', ['interested', 'qualified'])
    .not('property_address', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100))
  if (error) throw error

  const results = []
  for (const lead of (data || []) as LeadRecord[]) {
    results.push(await routeQualifiedSellerLeadToBuyers(lead.id, options))
  }

  return {
    ok: results.every((result) => result.ok || result.status === 'skipped'),
    count: results.length,
    matchedCount: results.reduce((sum, result) => sum + Number(result.matchCount || 0), 0),
    acceptedCount: results.reduce((sum, result) => sum + Number(result.delivery?.acceptedCount || 0), 0),
    results,
  }
}
