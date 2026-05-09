import { suggestBuyerDealType } from '@/lib/buyers/constants'
import type { BuyerBuyBoxRecord, BuyerRecord, PropertyBuyerMatchInput } from '@/lib/buyers/types'

type RankedBuyerMatch = {
  buyer: BuyerRecord
  confidenceScore: number
  fitSummary: string
  fitExplanation: string
  nextInfoNeeded: string[]
  fallbackBuyerCategories: string[]
}

function bounded(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)))
}

function matchesMarket(box: BuyerBuyBoxRecord, input: PropertyBuyerMatchInput) {
  const stateMatch = !box.states.length || (input.state ? box.states.includes(input.state) : false)
  const cityMatch = !box.cities.length || (input.city ? box.cities.map((city) => city.toLowerCase()).includes(input.city.toLowerCase()) : false)
  const zipMatch = !box.zip_codes.length || (input.zipCode ? box.zip_codes.includes(input.zipCode) : false)
  const metroMatch = !box.metros.length || (input.marketTag ? box.metros.map((metro) => metro.toLowerCase()).includes(input.marketTag.toLowerCase()) : false)
  return stateMatch || cityMatch || zipMatch || metroMatch
}

function matchesAsset(box: BuyerBuyBoxRecord, assetType: string) {
  return !box.asset_types.length || box.asset_types.map((value) => value.toLowerCase()).includes(assetType.toLowerCase())
}

function docsNeeded(input: PropertyBuyerMatchInput, box: BuyerBuyBoxRecord) {
  const docs: string[] = []
  if ((box.price_min || box.price_max) && !input.askingPrice) docs.push('Target asking price')
  if ((box.arv_min || box.arv_max) && !input.estimatedValue) docs.push('Estimated value or ARV')
  if (box.rehab_budget_max && input.rehabLevel === null) docs.push('Rehab scope or budget estimate')
  if (box.proof_of_funds_status && !input.timelineDays) docs.push('Seller timeline or urgency')
  return Array.from(new Set(docs))
}

function fallbackCategories(buyer: BuyerRecord, score: number) {
  const items: string[] = []
  if (score < 65 && buyer.category !== 'local_cash_buyer') items.push('Try a local cash buyer as backup')
  if (score < 65 && buyer.category !== 'wholesaler_buyer') items.push('Route to a wholesaler-friendly buyer as fallback')
  if (buyer.category !== 'creative_finance_buyer') items.push('Use a creative-finance buyer if the seller is flexible')
  return Array.from(new Set(items)).slice(0, 3)
}

export function matchPropertyToBuyers(
  input: PropertyBuyerMatchInput,
  buyers: BuyerRecord[],
  buyBoxesByBuyerId: Map<string, BuyerBuyBoxRecord[]>
) {
  const assetType = suggestBuyerDealType(input)
  const ranked: RankedBuyerMatch[] = []

  for (const buyer of buyers) {
    const buyBoxes = buyBoxesByBuyerId.get(buyer.id) || []
    const activeBoxes = buyBoxes.filter((box) => box.active)
    const boxScores = activeBoxes.map((box) => {
      let score = 0
      const reasons: string[] = []

      if (matchesMarket(box, input)) {
        score += 18
        reasons.push('Market coverage matches the property')
      } else {
        score -= 16
      }

      if (matchesAsset(box, assetType)) {
        score += 16
        reasons.push('Asset type fits the saved buy box')
      } else if (box.asset_types.length) {
        score -= 10
      }

      if (input.askingPrice !== null && input.askingPrice !== undefined) {
        if (box.price_min && input.askingPrice < box.price_min) score -= 8
        if (box.price_max && input.askingPrice > box.price_max) score -= 12
        if ((!box.price_min || input.askingPrice >= box.price_min) && (!box.price_max || input.askingPrice <= box.price_max)) {
          score += 10
          reasons.push('Price band fits the buy box')
        }
      }

      if ((input.distressLevel || 0) > 0) {
        score += Math.max(-6, (box.distressed_tolerance - 4) * 3)
        if ((box.distressed_tolerance || 0) >= (input.distressLevel || 0)) reasons.push('Distress tolerance fits')
      }

      if ((input.codeViolationLevel || 0) > 0) {
        score += Math.max(-6, (box.code_violation_tolerance - 4) * 3)
        if ((box.code_violation_tolerance || 0) >= (input.codeViolationLevel || 0)) reasons.push('Code-violation tolerance fits')
      }

      if (input.occupancy && box.occupancy_preference && input.occupancy.toLowerCase().includes(box.occupancy_preference.toLowerCase())) {
        score += 8
        reasons.push('Occupancy preference matches')
      }

      if (input.landlordSignal && box.tenant_occupied_allowed) {
        score += 6
        reasons.push('Tenant-occupied or landlord scenario is workable')
      }

      if (input.creativeFinanceOpen && box.creative_finance_open) {
        score += 8
        reasons.push('Creative-finance openness matches')
      }

      if (input.timelineDays !== null && input.timelineDays !== undefined) {
        const closingSpeed = String(box.closing_speed || buyer.closing_speed || '').toLowerCase()
        if (closingSpeed.includes('fast') || closingSpeed.includes('quick')) {
          score += input.timelineDays <= 21 ? 8 : 4
          reasons.push('Closing timeline is workable')
        }
      }

      return { score, reasons, box }
    })

    const bestBox = boxScores.sort((a, b) => b.score - a.score)[0]
    let score = bestBox?.score || 0
    const reasons = [...(bestBox?.reasons || [])]

    score += Math.round((buyer.confidence_score || 0) * 0.18)
    score += Math.round((buyer.referral_value_score || 0) * 0.12)
    if (buyer.contact_email) score += 8
    if (buyer.proof_of_funds_status) score += 8
    if (buyer.relationship_stage === 'active_buyer') score += 12
    if ((input.languagePreference === 'es' || input.languagePreference === 'bilingual') && (buyer.spanish_support || buyer.bilingual_support)) {
      score += 8
      reasons.push('Language support matches')
    }

    const confidenceScore = bounded(score)
    if (confidenceScore < 45) continue

    ranked.push({
      buyer,
      confidenceScore,
      fitSummary:
        confidenceScore >= 80
          ? 'Strong buyer fit for immediate property routing.'
          : confidenceScore >= 65
            ? 'Good buyer fit worth sending through the acquisition queue.'
            : 'Possible backup buyer if stronger matches are limited.',
      fitExplanation: reasons.length ? reasons.join('. ') : 'General fit based on market, category, and buy-box coverage.',
      nextInfoNeeded: docsNeeded(input, bestBox?.box || ({} as BuyerBuyBoxRecord)),
      fallbackBuyerCategories: fallbackCategories(buyer, confidenceScore),
    })
  }

  return ranked.sort((a, b) => b.confidenceScore - a.confidenceScore).slice(0, 8)
}
