import {
  researchChecklistKeys,
  type NormalizedResearchChecklistInput,
  type ResearchChecklistJson,
  type ResearchChecklistRecord,
} from '@/lib/osint/types'

const CHECKLIST_WEIGHTS: Record<(typeof researchChecklistKeys)[number], number> = {
  propertyVerified: 15,
  ownerEntityVerified: 15,
  contactQualityReviewed: 20,
  sourceLinksAttached: 10,
  fitCriteriaReviewed: 15,
  mapConditionReviewed: 10,
  riskReviewed: 10,
  nextActionSelected: 5,
}

function boundedScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function calculateResearchConfidence(input: {
  checklist?: ResearchChecklistJson | null
  sourceLinks?: unknown[] | null
  riskFlags?: unknown[] | null
  recommendedLane?: string | null
  nextAction?: string | null
}) {
  const checklist = input.checklist || {}
  let score = researchChecklistKeys.reduce((sum, key) => {
    return checklist[key] ? sum + CHECKLIST_WEIGHTS[key] : sum
  }, 0)

  if (!checklist.sourceLinksAttached && (input.sourceLinks?.length || 0) > 0) score += CHECKLIST_WEIGHTS.sourceLinksAttached
  if (!checklist.riskReviewed && input.riskFlags) score += CHECKLIST_WEIGHTS.riskReviewed
  if (!checklist.nextActionSelected && (input.nextAction || (input.recommendedLane && input.recommendedLane !== 'no_outreach'))) {
    score += CHECKLIST_WEIGHTS.nextActionSelected
  }

  return boundedScore(score)
}

export function isResearchOutreachReady(
  checklist: Pick<
    ResearchChecklistRecord,
    'outreach_status' | 'confidence_score' | 'contact_email' | 'contact_phone' | 'recommended_lane'
  >
) {
  return (
    ['ready', 'approved'].includes(checklist.outreach_status) &&
    checklist.confidence_score >= 60 &&
    checklist.outreach_status !== 'do_not_contact' &&
    Boolean(checklist.contact_email || checklist.contact_phone) &&
    checklist.recommended_lane !== 'no_outreach'
  )
}

export function inputWithCalculatedScore(input: NormalizedResearchChecklistInput): NormalizedResearchChecklistInput {
  if (typeof input.confidenceScore === 'number') return input
  return {
    ...input,
    confidenceScore: calculateResearchConfidence({
      checklist: input.checklist,
      sourceLinks: input.sourceLinks,
      riskFlags: input.riskFlags,
      recommendedLane: input.recommendedLane,
      nextAction: input.nextAction,
    }),
  }
}
