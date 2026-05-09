import type { BuyerBuyBoxRecord, BuyerRecord, BuyerScoreBreakdown } from '@/lib/buyers/types'

function bounded(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)))
}

export function scoreBuyer(buyer: BuyerRecord, buyBoxes: BuyerBuyBoxRecord[] = []): BuyerScoreBreakdown {
  const activeBoxes = buyBoxes.filter((box) => box.active)
  const seriousnessScore = bounded(
    (buyer.website ? 20 : 0) +
      (buyer.contact_email ? 18 : 0) +
      (buyer.contact_phone ? 12 : 0) +
      (buyer.contact_name ? 10 : 0) +
      (buyer.proof_of_funds_status ? 18 : 0) +
      (buyer.relationship_stage === 'active_buyer' ? 22 : buyer.relationship_stage === 'responded' ? 16 : 0)
  )

  const buyBoxClarityScore = bounded(
    activeBoxes.length * 18 +
      activeBoxes.reduce(
        (sum, box) =>
          sum +
          (box.asset_types.length ? 6 : 0) +
          (box.states.length || box.cities.length || box.metros.length || box.zip_codes.length ? 6 : 0) +
          (box.price_min || box.price_max ? 6 : 0) +
          (box.preferred_deal_types.length ? 6 : 0) +
          (box.proof_of_funds_status ? 4 : 0),
        0
      )
  )

  const marketCoverageScore = bounded(
    (buyer.markets_served.length >= 8 ? 30 : buyer.markets_served.length >= 3 ? 20 : buyer.markets_served.length ? 12 : 0) +
      activeBoxes.reduce((sum, box) => sum + Math.min(20, box.states.length * 4 + box.cities.length * 2), 0) +
      (buyer.national_or_regional === 'national' ? 18 : buyer.national_or_regional === 'regional' ? 12 : 6)
  )

  const distressedPropertyUtilityScore = bounded(
    activeBoxes.reduce((sum, box) => sum + box.distressed_tolerance * 6 + (box.tenant_occupied_allowed ? 6 : 0), 0) +
      (['local_cash_buyer', 'fix_and_flip_buyer', 'brrrr_buyer', 'wholesaler_buyer'].includes(buyer.category) ? 18 : 0)
  )

  const codeViolationUtilityScore = bounded(
    activeBoxes.reduce((sum, box) => sum + box.code_violation_tolerance * 7, 0) +
      (['local_cash_buyer', 'fix_and_flip_buyer', 'wholesaler_buyer', 'landlord_buyer'].includes(buyer.category) ? 16 : 0)
  )

  const sellerLeadUtilityScore = bounded(
    (buyer.category === 'local_cash_buyer' ? 22 : 0) +
      (buyer.category === 'hedge_fund_buyer' ? 18 : 0) +
      (buyer.category === 'sfr_aggregator' ? 18 : 0) +
      (buyer.category === 'build_to_rent_buyer' ? 16 : 0) +
      (buyer.category === 'small_multifamily_buyer' ? 14 : 0) +
      activeBoxes.reduce((sum, box) => sum + (box.creative_finance_open ? 6 : 0) + (box.closing_speed ? 4 : 0), 0)
  )

  const closingSpeedUtilityScore = bounded(
    (/fast|quick|7|10|14/.test(String(buyer.closing_speed || '').toLowerCase()) ? 28 : 10) +
      activeBoxes.reduce((sum, box) => sum + (/fast|quick|7|10|14/.test(String(box.closing_speed || '').toLowerCase()) ? 10 : 0), 0)
  )

  const responsivenessScore = bounded(
    (buyer.contact_email ? 30 : 0) +
      (buyer.contact_phone ? 20 : 0) +
      (buyer.contact_name ? 10 : 0) +
      (buyer.outreach_status === 'responded' ? 20 : buyer.relationship_stage === 'active_buyer' ? 24 : 0)
  )

  const institutionalFitValueScore = bounded(
    (buyer.buyer_type === 'institutional' ? 30 : buyer.buyer_type === 'local_operator' ? 16 : 12) +
      (['hedge_fund_buyer', 'sfr_aggregator', 'build_to_rent_buyer', 'commercial_buyer'].includes(buyer.category) ? 22 : 0) +
      (activeBoxes.some((box) => Boolean(box.institutional_criteria)) ? 16 : 0)
  )

  const referralMonetizationValueScore = bounded(
    activeBoxes.reduce(
      (sum, box) =>
        sum +
        (box.price_max ? Math.min(18, box.price_max / 100000) : 0) +
        (box.creative_finance_open ? 6 : 0) +
        (box.proof_of_funds_status ? 6 : 0),
      0
    ) +
      (buyer.relationship_stage === 'active_buyer' ? 16 : 0)
  )

  const confidenceScore = bounded(
    seriousnessScore * 0.13 +
      buyBoxClarityScore * 0.16 +
      marketCoverageScore * 0.11 +
      distressedPropertyUtilityScore * 0.11 +
      codeViolationUtilityScore * 0.1 +
      sellerLeadUtilityScore * 0.12 +
      closingSpeedUtilityScore * 0.08 +
      responsivenessScore * 0.08 +
      institutionalFitValueScore * 0.05 +
      referralMonetizationValueScore * 0.06
  )

  const notes = [
    buyer.contact_email ? 'Contact email available' : 'No direct contact email yet',
    activeBoxes.length ? `${activeBoxes.length} active buy box${activeBoxes.length === 1 ? '' : 'es'} saved` : 'No structured buy box saved yet',
    buyer.proof_of_funds_status ? `Proof-of-funds note: ${buyer.proof_of_funds_status}` : 'Proof-of-funds status not captured',
    buyer.spanish_support ? 'Spanish-friendly buyer signal found' : 'No Spanish support signal found',
  ]

  return {
    confidenceScore,
    seriousnessScore,
    buyBoxClarityScore,
    marketCoverageScore,
    distressedPropertyUtilityScore,
    codeViolationUtilityScore,
    sellerLeadUtilityScore,
    closingSpeedUtilityScore,
    responsivenessScore,
    institutionalFitValueScore,
    referralMonetizationValueScore,
    fitSummary:
      confidenceScore >= 80
        ? 'Strong buyer-network candidate with a usable buy box for immediate real-estate routing.'
        : confidenceScore >= 65
          ? 'Solid buyer candidate worth outreach and acquisition follow-up.'
          : 'Usable niche buyer, but still needs more box clarity before prioritizing.',
    notes,
  }
}
