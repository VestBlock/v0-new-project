import type { BuyerBuyBoxRecord, BuyerRecord } from '@/lib/buyers/types'
import type { LenderProductRecord, LenderProgramRecord, LenderRecord } from '@/lib/lenders/types'

type PartnerScore = {
  score: number
  label: 'weak' | 'usable' | 'strong' | 'priority'
  strengths: string[]
  gaps: string[]
}

export type DealVaultConversionSignal = {
  shouldPitchDealVault: boolean
  score: number
  reasons: string[]
  nextStep: string
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function scoreLabel(score: number): PartnerScore['label'] {
  if (score >= 82) return 'priority'
  if (score >= 68) return 'strong'
  if (score >= 48) return 'usable'
  return 'weak'
}

function hasText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
}

function hasItems(value: unknown) {
  return Array.isArray(value) && value.length > 0
}

export function scoreBuyerCriteria(
  buyer: BuyerRecord,
  buyBoxes: BuyerBuyBoxRecord[] = []
): PartnerScore {
  let score = 0
  const strengths: string[] = []
  const gaps: string[] = []
  const activeBoxes = buyBoxes.filter((box) => box.active)

  if (hasItems(buyer.markets_served)) {
    score += 12
    strengths.push('Market coverage saved')
  } else {
    gaps.push('Add markets served')
  }

  if (activeBoxes.length > 0) {
    score += 18
    strengths.push('Active buy box saved')
  } else {
    gaps.push('Create at least one active buy box')
  }

  if (activeBoxes.some((box) => hasItems(box.asset_types))) {
    score += 10
    strengths.push('Asset appetite defined')
  } else {
    gaps.push('Add asset types')
  }

  if (activeBoxes.some((box) => box.price_min || box.price_max || box.arv_min || box.arv_max)) {
    score += 10
    strengths.push('Price or ARV range defined')
  } else {
    gaps.push('Add price, ARV, or equity range')
  }

  if (hasText(buyer.proof_of_funds_status) || activeBoxes.some((box) => hasText(box.proof_of_funds_status))) {
    score += 10
    strengths.push('Proof-of-funds status captured')
  } else {
    gaps.push('Capture proof-of-funds status')
  }

  if (hasText(buyer.closing_speed) || activeBoxes.some((box) => hasText(box.closing_speed))) {
    score += 8
    strengths.push('Closing speed known')
  } else {
    gaps.push('Capture closing speed')
  }

  if (hasText(buyer.contact_email) || hasText(buyer.contact_phone)) {
    score += 10
    strengths.push('Direct contact available')
  } else {
    gaps.push('Find direct contact')
  }

  if (buyer.relationship_stage === 'active_buyer' || buyer.relationship_stage === 'responded') {
    score += 12
    strengths.push('Relationship has response signal')
  }

  if (buyer.outreach_status === 'approved' || buyer.outreach_status === 'draft_ready') {
    score += 6
    strengths.push('Manual outreach is ready')
  }

  if (buyer.confidence_score) score += Math.min(14, Math.round(buyer.confidence_score * 0.14))

  return {
    score: clampScore(score),
    label: scoreLabel(score),
    strengths,
    gaps: gaps.slice(0, 5),
  }
}

export function scoreLenderCriteria(
  lender: LenderRecord,
  products: LenderProductRecord[] = [],
  programs: LenderProgramRecord[] = []
): PartnerScore {
  let score = 0
  const strengths: string[] = []
  const gaps: string[] = []
  const activeProducts = products.filter((product) => product.active)
  const activePrograms = programs.filter((program) => program.active)

  if (hasItems(lender.states_served)) {
    score += 12
    strengths.push('State coverage saved')
  } else {
    gaps.push('Add states served')
  }

  if (activeProducts.length || activePrograms.length) {
    score += 14
    strengths.push('Products or programs saved')
  } else {
    gaps.push('Add lender products or programs')
  }

  if (lender.loan_amount_min || lender.loan_amount_max || activeProducts.some((product) => product.loan_amount_min || product.loan_amount_max)) {
    score += 10
    strengths.push('Loan range captured')
  } else {
    gaps.push('Capture loan range')
  }

  if (lender.min_credit_score || activeProducts.some((product) => product.min_credit_score)) {
    score += 8
    strengths.push('Credit criteria known')
  } else {
    gaps.push('Capture minimum credit score')
  }

  if (lender.dscr_min || activeProducts.some((product) => product.dscr_min) || activePrograms.some((program) => program.dscr_min)) {
    score += 8
    strengths.push('DSCR criteria known')
  }

  if (lender.low_doc || activePrograms.some((program) => program.low_doc)) {
    score += 6
    strengths.push('Low-doc appetite flagged')
  }

  if (hasText(lender.speed_to_close) || activeProducts.some((product) => hasText(product.speed_to_close))) {
    score += 8
    strengths.push('Speed to close known')
  } else {
    gaps.push('Capture speed to close')
  }

  if (hasText(lender.contact_email) || hasText(lender.contact_phone)) {
    score += 10
    strengths.push('Direct contact available')
  } else {
    gaps.push('Find direct contact')
  }

  if (lender.relationship_stage === 'active_partner' || lender.relationship_stage === 'responded') {
    score += 12
    strengths.push('Relationship has response signal')
  }

  if (lender.outreach_status === 'approved' || lender.outreach_status === 'draft_ready') {
    score += 6
    strengths.push('Manual outreach is ready')
  }

  if (lender.confidence_score) score += Math.min(14, Math.round(lender.confidence_score * 0.14))

  return {
    score: clampScore(score),
    label: scoreLabel(score),
    strengths,
    gaps: gaps.slice(0, 5),
  }
}

export function scoreManualOutreachReadiness(record: {
  contact_email: string | null
  outreach_status: string
  relationship_stage: string
  confidence_score?: number | null
  fit_summary?: string | null
}) {
  let score = 0
  const blockers: string[] = []
  const nextActions: string[] = []

  if (hasText(record.contact_email)) {
    score += 28
  } else {
    blockers.push('No direct email saved')
    nextActions.push('Find a direct contact email before outreach')
  }

  if (record.outreach_status === 'approved') score += 30
  if (record.outreach_status === 'draft_ready') {
    score += 18
    nextActions.push('Review and approve the draft manually')
  }
  if (record.outreach_status === 'needs_review') {
    score += 10
    nextActions.push('Fix the draft before sending')
  }
  if (record.outreach_status === 'do_not_contact') {
    blockers.push('Marked do not contact')
  }

  if (['responded', 'active_buyer', 'active_partner'].includes(record.relationship_stage)) score += 20
  if (record.relationship_stage === 'not_a_fit') blockers.push('Marked not a fit')
  if (record.relationship_stage === 'paused') blockers.push('Paused relationship')

  if ((record.confidence_score || 0) >= 70) score += 12
  if (hasText(record.fit_summary)) score += 10

  return {
    score: blockers.length ? Math.min(clampScore(score), 49) : clampScore(score),
    readyForManualSend: blockers.length === 0 && record.outreach_status === 'approved' && hasText(record.contact_email),
    blockers,
    nextActions: nextActions.length ? nextActions : ['Keep relationship notes current after every reply'],
  }
}

export function scoreDealVaultConversion(input: {
  partnerCount?: number
  hasReferralPayout?: boolean
  hasMilestones?: boolean
  needsProof?: boolean
  hasBuyerOrLenderRouting?: boolean
  dealValue?: number | null
  relationshipStage?: string | null
  source?: string | null
}): DealVaultConversionSignal {
  let score = 0
  const reasons: string[] = []

  if ((input.partnerCount || 0) >= 2) {
    score += 18
    reasons.push('Multiple parties are involved')
  }
  if (input.hasReferralPayout) {
    score += 22
    reasons.push('Referral, JV, or partner payout needs tracking')
  }
  if (input.hasMilestones) {
    score += 18
    reasons.push('Milestones or proof submissions need a trail')
  }
  if (input.needsProof) {
    score += 20
    reasons.push('Proof record would reduce ambiguity')
  }
  if (input.hasBuyerOrLenderRouting) {
    score += 12
    reasons.push('Buyer or lender routing creates accountability risk')
  }
  if ((input.dealValue || 0) >= 50000) {
    score += 10
    reasons.push('Deal value is high enough for stronger records')
  }
  if (input.relationshipStage && ['reviewing', 'active', 'shared', 'matched'].includes(input.relationshipStage)) {
    score += 8
    reasons.push('Deal is past casual intake')
  }

  const finalScore = clampScore(score)

  return {
    score: finalScore,
    shouldPitchDealVault: finalScore >= 45,
    reasons: reasons.length ? reasons : ['DealVault is optional until a payout, proof, or milestone risk appears'],
    nextStep:
      finalScore >= 70
        ? 'Pitch DealVault during the next review call'
        : finalScore >= 45
          ? 'Add DealVault as a recommended option'
          : 'Keep in intake until more proof or payout risk appears',
  }
}

export const dealFlowRevenueTargets = [
  {
    label: 'DealVault Team accounts',
    target: 100,
    unitRevenue: 297,
    cadence: 'monthly',
    note: 'Core recurring subscription base.',
  },
  {
    label: 'DealFlow Growth Support accounts',
    target: 25,
    unitRevenue: 997,
    cadence: 'monthly',
    note: 'High-retention operator system.',
  },
  {
    label: 'DealFlow setup projects',
    target: 10,
    unitRevenue: 2500,
    cadence: 'monthly',
    note: 'Implementation cash flow.',
  },
  {
    label: 'Paid real estate deal reviews',
    target: 40,
    unitRevenue: 300,
    cadence: 'monthly',
    note: 'Qualification and upsell layer.',
  },
] as const
