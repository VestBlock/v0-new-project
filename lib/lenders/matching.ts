import { suggestBorrowerDealType } from '@/lib/lenders/constants'
import type { BorrowerMatchInput, LenderMatchRecord, LenderRecord } from '@/lib/lenders/types'

type RankedLenderMatch = {
  lender: LenderRecord
  confidenceScore: number
  fitSummary: string
  fitExplanation: string
  nextDocsNeeded: string[]
  fallbackOptions: string[]
}

function bounded(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)))
}

function includesState(lender: LenderRecord, state?: string | null) {
  if (!state) return true
  return !lender.states_served.length || lender.states_served.includes(state)
}

function docsNeeded(input: BorrowerMatchInput, lender: LenderRecord) {
  const docs: string[] = []
  if (lender.min_revenue && !input.businessRevenue) docs.push('Recent revenue documentation')
  if (lender.min_time_in_business && !input.timeInBusinessMonths) docs.push('Time-in-business proof')
  if (lender.dscr_min && input.dealType) docs.push('Property cash-flow or DSCR support')
  if (lender.collateral_required) docs.push('Collateral or asset detail')
  if (input.ficoEstimate === undefined || input.ficoEstimate === null) docs.push('Recent credit estimate')
  return Array.from(new Set(docs))
}

function fallbackOptions(lender: LenderRecord, score: number) {
  const items: string[] = []
  if (score < 65 && lender.lender_type === 'real_estate') items.push('Try a bridge or hard-money lender as backup')
  if (score < 65 && lender.lender_type === 'business') items.push('Fallback to community bank, CDFI, or funding-readiness prep')
  if (!lender.startup_allowed) items.push('Move startup cases to startup-friendly or microloan lenders')
  if (!lender.spanish_support) items.push('Use a bilingual lender if language support matters')
  return Array.from(new Set(items)).slice(0, 3)
}

export function matchBorrowerToLenders(input: BorrowerMatchInput, lenders: LenderRecord[]) {
  const dealType = suggestBorrowerDealType(input)
  const ranked: RankedLenderMatch[] = []

  for (const lender of lenders) {
    let score = 0
    const reasons: string[] = []

    if (includesState(lender, input.borrowerState)) {
      score += 16
      reasons.push('Serves the borrower state')
    } else {
      score -= 20
    }

    if (input.languagePreference === 'es' || input.languagePreference === 'bilingual') {
      if (lender.spanish_support || lender.bilingual_support) {
        score += 14
        reasons.push('Language support matches borrower preference')
      } else {
        score -= 8
      }
    }

    if (input.ficoEstimate && lender.min_credit_score) {
      if (input.ficoEstimate >= lender.min_credit_score) {
        score += 14
        reasons.push('Credit estimate clears stated minimum')
      } else {
        score -= 18
      }
    }

    if (input.businessRevenue && lender.min_revenue) {
      if (input.businessRevenue >= lender.min_revenue) {
        score += 10
        reasons.push('Revenue clears lender threshold')
      } else {
        score -= 15
      }
    }

    if (input.timeInBusinessMonths && lender.min_time_in_business) {
      if (input.timeInBusinessMonths >= lender.min_time_in_business) {
        score += 10
        reasons.push('Time in business fits lender requirements')
      } else if (lender.startup_allowed) {
        score += 4
        reasons.push('Startup-friendly despite limited time in business')
      } else {
        score -= 15
      }
    } else if (lender.startup_allowed && dealType === 'startup') {
      score += 12
      reasons.push('Startup-friendly lender')
    }

    if (input.fundingGoalAmount) {
      if (lender.loan_amount_min && input.fundingGoalAmount < lender.loan_amount_min) score -= 8
      if (lender.loan_amount_max && input.fundingGoalAmount > lender.loan_amount_max) score -= 14
      if ((!lender.loan_amount_min || input.fundingGoalAmount >= lender.loan_amount_min) && (!lender.loan_amount_max || input.fundingGoalAmount <= lender.loan_amount_max)) {
        score += 10
        reasons.push('Requested amount fits lender range')
      }
    }

    if (dealType === 'real_estate') {
      if (lender.lender_type === 'real_estate') score += 18
      if (input.investorExperience && lender.investor_allowed) {
        score += 10
        reasons.push('Investor-friendly lender')
      }
      if (input.ownerOccupied && lender.owner_occupied_allowed) {
        score += 8
        reasons.push('Owner-occupied fit')
      }
      if (input.dscr && lender.dscr_min && input.dscr >= lender.dscr_min) {
        score += 10
        reasons.push('DSCR target fits')
      }
      if (input.wantsCashOut && lender.cash_out_allowed) {
        score += 8
        reasons.push('Cash-out allowed')
      }
    }

    if (dealType === 'business' || dealType === 'startup') {
      if (lender.lender_type === 'business') score += 14
      if (input.businessIndustry && lender.industries_preferred.includes(input.businessIndustry)) {
        score += 12
        reasons.push('Preferred industry match')
      }
      if (input.businessIndustry && lender.industries_excluded.includes(input.businessIndustry)) {
        score -= 25
      }
    }

    if (dealType === 'personal' && lender.lender_type === 'personal') {
      score += 18
      reasons.push('Personal lending fit')
    }

    score += Math.round((lender.confidence_score || 0) * 0.18)
    score += Math.round((lender.referral_value_score || 0) * 0.12)

    const confidenceScore = bounded(score)
    if (confidenceScore < 45) continue

    ranked.push({
      lender,
      confidenceScore,
      fitSummary:
        confidenceScore >= 80
          ? 'Strong match for immediate review and lender routing.'
          : confidenceScore >= 65
            ? 'Good fit with a reasonable chance of working.'
            : 'Possible backup lender if stronger options are limited.',
      fitExplanation: reasons.length
        ? reasons.join('. ')
        : 'General fit based on state, category, and coverage.',
      nextDocsNeeded: docsNeeded(input, lender),
      fallbackOptions: fallbackOptions(lender, confidenceScore),
    })
  }

  return ranked.sort((a, b) => b.confidenceScore - a.confidenceScore).slice(0, 8)
}
