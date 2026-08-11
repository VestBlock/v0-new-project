import { generateSafeOutreachSummary } from '@/lib/property-intelligence/outreach'
import type { PropertyIntelligenceRecord } from '@/lib/property-intelligence/types'

export type BuyerMatchHookResult = {
  buyer_match_score: number
  matched_buyers: Array<{ id: string; name: string; score: number }>
  reason_codes: string[]
  recommended_pitch_angle: string
}

export type DscrPrefillResult = {
  canPrefill: boolean
  missingFields: string[]
  confidenceScore: number
  prefill: {
    propertyAddress?: string | null
    estimatedValue?: number | null
    taxes?: number | null
    insurance?: number | null
    marketRent?: number | null
  }
}

export type FundingSuggestion = {
  path: 'DSCR' | 'hard_money' | 'fix_and_flip' | 'private_money' | 'seller_finance' | 'novation' | 'cash_buyer' | 'land_acquisition_loan' | 'business_loc'
  confidenceScore: number
  reason: string
  disclaimer: string
}

export function buildBuyerMatchingHook(property: PropertyIntelligenceRecord): BuyerMatchHookResult {
  const score = property.deal_scores?.[0]?.score || 0
  const reason_codes: string[] = []
  if (property.is_vacant_lot) reason_codes.push('VACANT_LAND_BUYERS')
  if ((property.property_signals || []).some((signal) => signal.signal_type === 'code_violation')) reason_codes.push('REHAB_BUYERS')
  if ((property.property_signals || []).some((signal) => signal.signal_type === 'tax_delinquent')) reason_codes.push('DISTRESS_BUYERS')
  if ((property.property_signals || []).some((signal) => signal.signal_type === 'opportunity_zone')) reason_codes.push('OZ_INVESTORS')

  return {
    buyer_match_score: Math.min(100, Math.max(0, score + (reason_codes.length * 3))),
    matched_buyers: [],
    reason_codes,
    recommended_pitch_angle: property.is_vacant_lot
      ? 'Pitch as an infill, builder, land-bank, or assemblage opportunity after zoning/source review.'
      : 'Pitch by public-signal fit and route to cash, rehab, rental, or novation buyers after review.',
  }
}

export function buildDscrPrefillHook(property: PropertyIntelligenceRecord): DscrPrefillResult {
  const missingFields = ['marketRent', 'taxes', 'insurance']
  return {
    canPrefill: Boolean(property.property_address && property.assessed_value),
    missingFields,
    confidenceScore: property.assessed_value ? 45 : 20,
    prefill: {
      propertyAddress: property.property_address,
      estimatedValue: property.assessed_value,
      taxes: null,
      insurance: null,
      marketRent: null,
    },
  }
}

export function suggestFundingPaths(property: PropertyIntelligenceRecord): FundingSuggestion[] {
  const disclaimer = 'Possible funding path only; financing is not guaranteed and missing inputs must be verified.'
  const suggestions: FundingSuggestion[] = []
  if (property.is_vacant_lot) {
    suggestions.push({ path: 'land_acquisition_loan', confidenceScore: 55, reason: 'Vacant/land signal may fit land acquisition or builder capital.', disclaimer })
    suggestions.push({ path: 'cash_buyer', confidenceScore: 65, reason: 'Vacant land often routes cleanly to cash or builder buyers after zoning review.', disclaimer })
  } else {
    suggestions.push({ path: 'DSCR', confidenceScore: 35, reason: 'Could be screened after rent, taxes, insurance, and value are verified.', disclaimer })
    suggestions.push({ path: 'hard_money', confidenceScore: 45, reason: 'Distress signals may fit a rehab-capital path if scope and ARV are validated.', disclaimer })
    suggestions.push({ path: 'novation', confidenceScore: 40, reason: 'If condition and seller goals support a higher-price path, novation may be reviewed.', disclaimer })
  }
  if ((property.property_signals || []).some((signal) => signal.signal_type === 'preforeclosure')) {
    suggestions.push({ path: 'seller_finance', confidenceScore: 40, reason: 'Public foreclosure signal may justify a creative-finance review with careful compliance.', disclaimer })
  }
  return suggestions
}

export function buildOutreachPreparationHook(property: PropertyIntelligenceRecord) {
  const summary = generateSafeOutreachSummary(property)
  return {
    owner_summary: `${summary.ownerName} tied to ${summary.propertyAddress}.`,
    public_signals: summary.publicSignals,
    suggested_outreach_angle: summary.suggestedOutreachAngle,
    sms_draft: summary.suggestedSms,
    email_draft: summary.suggestedEmail,
    call_opener: summary.suggestedCallOpener,
    follow_up_message: `Just following up on ${summary.propertyAddress}. If there is no fit, no problem. If you want options, VestBlock can review the public-record situation and route it appropriately.`,
    buyer_facing_pitch: `${summary.propertyAddress}: ${summary.reasonThisMayFit} Potential route: ${summary.suggestedOutreachAngle}`,
    approval_status: 'needs_review',
  }
}
