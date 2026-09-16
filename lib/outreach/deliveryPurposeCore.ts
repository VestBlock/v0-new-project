import {
  DAILY_STRATEGY_OUTPUT_LANES,
  type DailyStrategyOutputGroup,
  type DailyStrategyOutputLaneKey,
} from '@/lib/outreach/dailyStrategyOutputCore'
import {
  isListingAgentIntermediaryLead,
  type ListingAgentIntermediaryRecord,
} from '@/lib/outreach/listingAgentCore'
import { assessDurableMarketingConsentEvidence } from '@/lib/outreach/marketingConsentCore'

export const DELIVERY_PURPOSES = ['transactional', 'marketing', 'cold_outreach'] as const
export type DeliveryPurpose = (typeof DELIVERY_PURPOSES)[number]

export const COLD_OUTREACH_LANE_POLICIES = {
  seller: 'consumer_hold',
  business: 'b2b_business_contact_required',
  partner: 'partner_business_contact_required',
} as const satisfies Record<DailyStrategyOutputGroup, ColdOutreachLanePolicy>

export type ColdOutreachLanePolicy =
  | 'consumer_hold'
  | 'b2b_business_contact_required'
  | 'partner_business_contact_required'

export type DeliveryLanePolicy = {
  key: DailyStrategyOutputLaneKey
  label: string
  group: DailyStrategyOutputGroup
  coldOutreach: ColdOutreachLanePolicy
}

/**
 * Delivery classification is derived from the canonical lane catalog so a
 * new strategy cannot silently inherit an email provider. Adding or moving a
 * canonical group requires an explicit policy above and corresponding tests.
 */
export const DELIVERY_LANE_POLICIES: readonly DeliveryLanePolicy[] = Object.freeze(
  DAILY_STRATEGY_OUTPUT_LANES.map((lane) => Object.freeze({
    ...lane,
    coldOutreach: COLD_OUTREACH_LANE_POLICIES[lane.group],
  }))
)

const DELIVERY_LANE_POLICY_BY_KEY = new Map(
  DELIVERY_LANE_POLICIES.map((policy) => [policy.key, policy] as const)
)

const DELIVERY_PURPOSE_POLICY_TABLE = {
  transactional: 'outlook',
  marketing: 'outlook_with_explicit_opt_in',
  cold_outreach: 'lane_policy',
} as const satisfies Record<DeliveryPurpose, DeliveryPurposePolicy>

type DeliveryPurposePolicy = 'outlook' | 'outlook_with_explicit_opt_in' | 'lane_policy'

export type DeliveryPurposeReason =
  | 'transactional_outlook'
  | 'durable_opt_in_marketing_outlook'
  | 'marketing_missing_durable_consent'
  | 'business_contact_b2b_cold_outlook'
  | 'partner_business_contact_b2b_cold_outlook'
  | 'business_contact_not_confirmed'
  | 'partner_contact_not_confirmed_business'
  | 'consumer_cold_email_prohibited'
  | 'unknown_strategy_lane'
  | 'unknown_delivery_purpose'

type DeliveryPurposeDecisionBase = {
  strategyKey: string
  purpose: string
  laneGroup: DailyStrategyOutputGroup | null
  coldOutreachPolicy: ColdOutreachLanePolicy | null
  reason: DeliveryPurposeReason
}

export type DeliveryPurposeDecision =
  | (DeliveryPurposeDecisionBase & {
      disposition: 'send_email'
      channel: 'email'
      provider: 'outlook'
    })
  | (DeliveryPurposeDecisionBase & {
      disposition: 'hold_non_email'
      channel: 'non_email'
      provider: null
    })

export type DeliveryPurposeInput = {
  strategyKey: string
  purpose: DeliveryPurpose | string
  /** @deprecated Ignored. A transient boolean can never authorize marketing delivery. */
  hasExplicitOptIn?: boolean
  recipientEmail?: string | null
  /** Must be loaded from the durable source record immediately before delivery. */
  marketingConsentEvidence?: unknown
  /** Required only for partner-lane cold outreach. */
  isBusinessContact?: boolean
}

export function getDeliveryLanePolicy(strategyKey: string) {
  return DELIVERY_LANE_POLICY_BY_KEY.get(String(strategyKey || '').trim() as DailyStrategyOutputLaneKey) || null
}

/**
 * Entity classification is an independent safety boundary. Strategy
 * attribution is mutable, so a seller record remains in the non-email channel
 * unless the dedicated listing-agent intermediary lane is selected. That lane
 * still fails closed downstream without recipient-bound business evidence.
 */
export function isLeadColdEmailProhibited(input: {
  strategyKey: string
  lead: ListingAgentIntermediaryRecord & {
    category?: string | null
    lead_type?: string | null
  }
}) {
  const category = String(input.lead.category || '').trim().toLowerCase()
  const leadType = String(input.lead.lead_type || '').trim().toLowerCase()
  const entityIsSeller = category === 'seller_lead' || leadType === 'sell_house'
  const lane = getDeliveryLanePolicy(input.strategyKey)
  // The listing-agent lane addresses a verified business intermediary. It is
  // still subject to recipient-bound business evidence in the Outlook adapter;
  // every direct-owner seller lane remains held from cold email.
  const verifiedIntermediaryLane =
    lane?.key === 'listing_agents' && isListingAgentIntermediaryLead(input.lead)
  return (entityIsSeller && !verifiedIntermediaryLane) || lane?.group === 'seller'
}

function decisionContext(
  strategyKey: string,
  purpose: string,
  lanePolicy: DeliveryLanePolicy | null
) {
  return {
    strategyKey,
    purpose,
    laneGroup: lanePolicy?.group || null,
    coldOutreachPolicy: lanePolicy?.coldOutreach || null,
  }
}

function sendEmail(
  context: ReturnType<typeof decisionContext>,
  provider: 'outlook',
  reason: DeliveryPurposeReason
): DeliveryPurposeDecision {
  return {
    ...context,
    disposition: 'send_email',
    channel: 'email',
    provider,
    reason,
  }
}

function holdNonEmail(
  context: ReturnType<typeof decisionContext>,
  reason: DeliveryPurposeReason
): DeliveryPurposeDecision {
  return {
    ...context,
    disposition: 'hold_non_email',
    channel: 'non_email',
    provider: null,
    reason,
  }
}

/**
 * Resolves the only permitted delivery provider for a canonical strategy and
 * message purpose. The function is intentionally pure: it does not inspect
 * provider availability and therefore cannot fall back to Gmail or route cold
 * outreach through another provider when Outlook is unavailable.
 */
export function routeDeliveryPurpose(input: DeliveryPurposeInput): DeliveryPurposeDecision {
  const strategyKey = String(input.strategyKey || '').trim()
  const purpose = String(input.purpose || '').trim()
  const lanePolicy = getDeliveryLanePolicy(strategyKey)
  const context = decisionContext(strategyKey, purpose, lanePolicy)

  if (!lanePolicy) return holdNonEmail(context, 'unknown_strategy_lane')

  const purposePolicy = DELIVERY_PURPOSE_POLICY_TABLE[purpose as DeliveryPurpose] as DeliveryPurposePolicy | undefined
  if (!purposePolicy) return holdNonEmail(context, 'unknown_delivery_purpose')

  if (purposePolicy === 'outlook') {
    return sendEmail(context, 'outlook', 'transactional_outlook')
  }

  if (purposePolicy === 'outlook_with_explicit_opt_in') {
    const consent = assessDurableMarketingConsentEvidence({
      evidence: input.marketingConsentEvidence,
      recipientEmail: input.recipientEmail,
    })
    return consent.valid
      ? sendEmail(context, 'outlook', 'durable_opt_in_marketing_outlook')
      : holdNonEmail(context, 'marketing_missing_durable_consent')
  }

  if (lanePolicy.coldOutreach === 'b2b_business_contact_required') {
    return input.isBusinessContact === true
      ? sendEmail(context, 'outlook', 'business_contact_b2b_cold_outlook')
      : holdNonEmail(context, 'business_contact_not_confirmed')
  }

  if (lanePolicy.coldOutreach === 'partner_business_contact_required') {
    return input.isBusinessContact === true
      ? sendEmail(context, 'outlook', 'partner_business_contact_b2b_cold_outlook')
      : holdNonEmail(context, 'partner_contact_not_confirmed_business')
  }

  return holdNonEmail(context, 'consumer_cold_email_prohibited')
}
