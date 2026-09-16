import type { BuyerOutreachMessageRecord, BuyerRecord } from '@/lib/buyers/types'
import { isUsableContactEmail } from '../outreach/email-quality'

export type BuyerAutoApprovalDecision = {
  approved: boolean
  reason: string
}

const BUYER_ACQUISITION_CATEGORIES = new Set([
  'local_cash_buyer',
  'hedge_fund_buyer',
  'sfr_aggregator',
  'build_to_rent_buyer',
  'landlord_buyer',
  'brrrr_buyer',
  'fix_and_flip_buyer',
  'small_multifamily_buyer',
  'wholesaler_buyer',
  'note_buyer',
  'creative_finance_buyer',
  'land_buyer',
  'commercial_buyer',
  'mobile_home_park_buyer',
  'self_storage_buyer',
  'mixed_use_buyer',
])

const AFFIRMATIVE_BUYER_SOURCES = [
  'public_buyer_signup',
  'openstreetmap_buyers',
  'google_places_buyers',
  'dealmachine_portfolio_owner_scan',
  'outlook_partner_reply',
  'email_reply_criteria',
  'manual_operator',
]

const AFFIRMATIVE_BUYER_LANES = new Set([
  'buyer',
  'buyers',
  'buyer-network',
  'land-developers',
  'investor-network',
  'acquisition-manager-network',
  'property-manager-network',
  'wholesaler-network',
  'buyer-developer',
  'fire-damage-builders',
])

function sourceMatches(source: string, expected: string) {
  return source === expected || source.startsWith(`${expected}:`)
}

export function isBuyerAcquisitionEntity(
  buyer: Pick<BuyerRecord, 'name' | 'source' | 'category' | 'metadata_json'>
) {
  const metadata = buyer.metadata_json || {}
  const lane = String(metadata.lane || '').trim().toLowerCase()
  const source = String(buyer.source || '').trim().toLowerCase()
  const category = String(buyer.category || '').trim().toLowerCase()
  const name = String(buyer.name || '').trim().toLowerCase()
  const buyerLane = String(metadata.buyerLane || '').trim().toLowerCase()
  const discoveryQuery = String(metadata.discoveryQuery || '').trim().toLowerCase()
  const niche = String(metadata.niche || '').trim().toLowerCase()
  const shape = `${name} ${category} ${source} ${lane} ${buyerLane} ${discoveryQuery} ${niche}`

  // A buyer-shaped category is not sufficient evidence. Generic directory
  // imports have previously put mortgage professionals into this table, so a
  // lender-shaped entity always loses even when its row says "cash buyer."
  if (
    lane === 'lender-network' ||
    source.includes('lender') ||
    /\b(?:mortgage|banks?|banking|lenders?|lending)\b|\bcredit[\s-]*union\b|\bhard[\s-]*money\b|\bhome[\s-]*loans?\b|\bloan[\s-]*(?:officer|originator|broker)\b/.test(shape)
  ) return false

  if (!BUYER_ACQUISITION_CATEGORIES.has(category)) return false

  const recognizedSource = AFFIRMATIVE_BUYER_SOURCES.some((expected) => sourceMatches(source, expected))
  const routedBuyerDiscovery =
    sourceMatches(source, 'outscraper_google_maps_businesses') &&
    AFFIRMATIVE_BUYER_LANES.has(lane)
  const explicitBuyerLane =
    AFFIRMATIVE_BUYER_LANES.has(lane) ||
    buyerLane === 'portfolio_landlord_buyer_criteria'
  const publicSignup = Boolean(metadata.publicSignup && typeof metadata.publicSignup === 'object')

  return recognizedSource || routedBuyerDiscovery || explicitBuyerLane || publicSignup
}

export function evaluateBuyerAutoApproval(input: {
  buyer: BuyerRecord | null
  message: BuyerOutreachMessageRecord
  templateVersion: string
  minimumScore: number
  allowedChannels?: string[]
}): BuyerAutoApprovalDecision {
  const { buyer, message, templateVersion, minimumScore } = input
  const allowedChannels = input.allowedChannels || ['email_intro']
  if (!buyer?.id) return { approved: false, reason: 'missing_buyer' }
  if (buyer.outreach_status === 'do_not_contact') return { approved: false, reason: 'do_not_contact' }
  if (!isBuyerAcquisitionEntity(buyer)) return { approved: false, reason: 'wrong_entity_type' }
  if (['paused', 'not_a_fit', 'dormant'].includes(buyer.relationship_stage)) {
    return { approved: false, reason: `relationship_${buyer.relationship_stage}` }
  }
  if (!isUsableContactEmail(buyer.contact_email)) return { approved: false, reason: 'invalid_email' }
  if (Number(buyer.confidence_score || 0) < minimumScore) return { approved: false, reason: 'score_below_threshold' }
  if (!allowedChannels.includes(message.channel)) return { approved: false, reason: 'channel_not_allowed' }
  if ((message.metadata_json || {}).templateVersion !== templateVersion) {
    return { approved: false, reason: 'stale_template' }
  }

  const subject = String(message.subject || '').trim()
  const body = String(message.body || '').trim()
  if (subject.length < 8 || subject.length > 120) return { approved: false, reason: 'subject_quality' }
  if (body.length < 120 || body.length > 2600) return { approved: false, reason: 'body_quality' }
  if (!body.includes('acquisitions@vestblock.io')) return { approved: false, reason: 'missing_identity' }
  if (!/not relevant|do not contact|opt out/i.test(body)) return { approved: false, reason: 'missing_opt_out' }

  return { approved: true, reason: 'approved' }
}
