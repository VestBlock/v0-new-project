import type { LenderRecord, LenderScoreBreakdown } from '@/lib/lenders/types'

function bounded(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)))
}

export function scoreLender(lender: LenderRecord): LenderScoreBreakdown {
  const categoryCoverageScore =
    lender.lender_type === 'real_estate'
      ? 80
      : lender.lender_type === 'business'
        ? 76
        : lender.lender_type === 'specialty'
          ? 68
          : 62

  const nicheFitScore = bounded(
    (lender.investor_allowed ? 18 : 0) +
      (lender.startup_allowed ? 18 : 0) +
      (lender.spanish_support ? 15 : 0) +
      (lender.low_doc ? 10 : 0) +
      (lender.industries_preferred.length ? 16 : 4) +
      (lender.dscr_min ? 10 : 0),
    0,
    100
  )

  const responsivenessScore = bounded(
    (lender.contact_email ? 30 : 0) +
      (lender.contact_phone ? 18 : 0) +
      (lender.contact_name ? 12 : 0) +
      (lender.website ? 15 : 0) +
      (lender.outreach_status === 'responded' ? 25 : lender.relationship_stage === 'active_partner' ? 30 : 0)
  )

  const qualityTrustScore = bounded(
    (lender.website ? 18 : 0) +
      (lender.source_url ? 12 : 0) +
      (lender.national_or_regional === 'regional' ? 12 : lender.national_or_regional === 'national' ? 16 : 10) +
      (lender.confidence_score > 0 ? lender.confidence_score * 0.3 : 8) +
      (lender.contact_email ? 12 : 0) +
      (lender.fit_summary ? 14 : 0)
  )

  const documentationClarityScore = bounded(
    (lender.min_credit_score ? 14 : 0) +
      (lender.min_revenue ? 14 : 0) +
      (lender.min_time_in_business ? 14 : 0) +
      (lender.loan_amount_min || lender.loan_amount_max ? 14 : 0) +
      (lender.speed_to_close ? 10 : 0) +
      (lender.seasoning_requirement ? 12 : 0) +
      (lender.dscr_min ? 12 : 0)
  )

  const startupFriendlinessScore = bounded(
    (lender.startup_allowed ? 55 : 5) +
      (lender.category === 'startup_friendly' ? 20 : 0) +
      (lender.category === 'sba_microloan' ? 10 : 0) +
      (lender.category === 'cdfi' ? 10 : 0)
  )

  const realEstateUtilityScore = bounded(
    (lender.investor_allowed ? 25 : 0) +
      (lender.owner_occupied_allowed ? 10 : 0) +
      (lender.rehab_tolerance * 4) +
      (lender.dscr_min ? 15 : 0) +
      (lender.cash_out_allowed ? 10 : 0) +
      (['real_estate'].includes(lender.lender_type) ? 20 : 0)
  )

  const businessFundingUtilityScore = bounded(
    (lender.min_revenue ? 12 : 0) +
      (lender.min_time_in_business ? 12 : 0) +
      (lender.startup_allowed ? 15 : 0) +
      (lender.category === 'line_of_credit' ? 16 : 0) +
      (lender.category === 'sba_7a' ? 18 : 0) +
      (lender.category === 'term_loan' ? 12 : 0) +
      (lender.lender_type === 'business' ? 18 : 0)
  )

  const spanishMarketValueScore = bounded(
    (lender.spanish_support ? 55 : 0) +
      (lender.bilingual_support ? 20 : 0) +
      (lender.category === 'spanish_market' ? 25 : 0)
  )

  const marketExpansionValueScore = bounded(
    (lender.states_served.length >= 5 ? 25 : lender.states_served.length >= 2 ? 18 : 8) +
      (lender.national_or_regional === 'regional' ? 15 : lender.national_or_regional === 'national' ? 22 : 10) +
      (lender.source === 'google_places_lenders' ? 8 : 0) +
      (lender.contact_email ? 10 : 0) +
      (lender.relationship_stage === 'active_partner' ? 25 : 0)
  )

  const referralMonetizationValueScore = bounded(
    (lender.loan_amount_max ? Math.min(30, lender.loan_amount_max / 100000) : 8) +
      (lender.lender_type === 'real_estate' ? 20 : lender.lender_type === 'business' ? 16 : 10) +
      (lender.category === 'commercial' ? 15 : 0) +
      (lender.category === 'sba_7a' ? 12 : 0) +
      (lender.category === 'dscr' ? 12 : 0) +
      (lender.relationship_stage === 'active_partner' ? 18 : 0)
  )

  const confidenceScore = bounded(
    categoryCoverageScore * 0.1 +
      nicheFitScore * 0.12 +
      responsivenessScore * 0.14 +
      qualityTrustScore * 0.12 +
      documentationClarityScore * 0.12 +
      startupFriendlinessScore * 0.08 +
      realEstateUtilityScore * 0.1 +
      businessFundingUtilityScore * 0.1 +
      spanishMarketValueScore * 0.05 +
      marketExpansionValueScore * 0.04 +
      referralMonetizationValueScore * 0.13
  )

  const notes = [
    lender.contact_email ? 'Contact email available' : 'No direct contact email yet',
    lender.startup_allowed ? 'Startup friendly' : 'Likely better for established borrowers',
    lender.investor_allowed ? 'Investor / real-estate fit' : 'Less investor-focused',
    lender.spanish_support ? 'Spanish-friendly partner signal' : 'No Spanish support signal found',
  ]

  return {
    confidenceScore,
    categoryCoverageScore,
    nicheFitScore,
    responsivenessScore,
    qualityTrustScore,
    documentationClarityScore,
    startupFriendlinessScore,
    realEstateUtilityScore,
    businessFundingUtilityScore,
    spanishMarketValueScore,
    marketExpansionValueScore,
    referralMonetizationValueScore,
    fitSummary:
      confidenceScore >= 80
        ? 'Strong lender-network candidate with usable coverage for VestBlock placements.'
        : confidenceScore >= 65
          ? 'Solid lender candidate worth outreach and relationship review.'
          : 'Usable niche lender, but needs more validation before prioritizing.',
    notes,
  }
}
