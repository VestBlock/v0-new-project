import { capitalPathCatalog } from '@/lib/capital/catalog'
import type { CapitalCaseType } from '@/lib/capital/types'

type CapitalReadinessInput = {
  caseType: CapitalCaseType
  fullName?: string
  email?: string
  phone?: string
  organizationName?: string
  amountRequested?: number | null
  purpose?: string
  timing?: string
  geography?: string
  intakeData?: Record<string, unknown>
  availableDocuments?: string[]
}

function present(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0
  if (typeof value === 'boolean') return true
  return typeof value === 'string' ? value.trim().length > 0 : value !== null && value !== undefined
}

export function assessCapitalReadiness(input: CapitalReadinessInput) {
  const path = capitalPathCatalog[input.caseType]
  const common = [
    ['Your name', input.fullName],
    ['A valid contact email', input.email],
    ['Organization or business name', input.organizationName],
    ['Amount or capital range', input.amountRequested],
    ['Purpose or objective', input.purpose],
    ['Timing', input.timing],
    ['Geography', input.geography],
  ] as const
  const requiredQuestions = path.questions.filter((question) => question.required)
  const questionChecks = requiredQuestions.map((question) => [question.label, input.intakeData?.[question.key]] as const)
  const checks = [...common, ...questionChecks]
  const complete = checks.filter(([, value]) => present(value))
  const gaps = checks.filter(([, value]) => !present(value)).map(([label]) => label)
  const available = new Set(input.availableDocuments || [])
  const missingDocuments = path.requiredDocuments.filter((document) => !available.has(document))
  const informationScore = checks.length ? Math.round((complete.length / checks.length) * 72) : 0
  const documentScore = path.requiredDocuments.length
    ? Math.round(((path.requiredDocuments.length - missingDocuments.length) / path.requiredDocuments.length) * 28)
    : 28
  const score = Math.min(100, informationScore + documentScore)
  const tier = gaps.length > 0
    ? 'incomplete'
    : score >= 85
      ? 'strong_file'
      : score >= 70
        ? 'review_ready'
        : score >= 50
          ? 'developing'
          : 'preparing'

  const strengths = complete.slice(0, 4).map(([label]) => `${label} is documented.`)
  const nextSteps = [
    ...gaps.slice(0, 4).map((gap) => `Complete ${gap.toLowerCase()}.`),
    ...missingDocuments.slice(0, 4).map((document) => `Prepare: ${document}.`),
  ]

  return {
    score,
    tier,
    gaps,
    requiredDocuments: path.requiredDocuments,
    missingDocuments,
    providerCriteria: {
      decisionOwner: path.provider,
      criteria: path.providerCriteria,
      verifiedAt: new Date().toISOString(),
      informationalOnly: true,
    },
    feedback: {
      summary: gaps.length
        ? `This case is saved, but ${gaps.length} required information ${gaps.length === 1 ? 'item is' : 'items are'} still incomplete.`
        : `The intake is complete enough for VestBlock review. A ${score}/100 readiness score is preparation feedback, not provider approval.`,
      strengths,
      gaps,
      nextSteps: nextSteps.length ? nextSteps : ['Submit for VestBlock operator review.'],
    },
  }
}

export function validateCapitalSubmission(input: CapitalReadinessInput & { analysisConsent?: boolean }) {
  const readiness = assessCapitalReadiness(input)
  const errors: string[] = []
  if (!input.fullName?.trim()) errors.push('Full name is required.')
  if (!/^\S+@\S+\.\S+$/.test(input.email || '')) errors.push('A valid email is required.')
  if (!input.analysisConsent) errors.push('Consent to analyze the submitted information is required.')
  if (readiness.gaps.length) errors.push(`Complete: ${readiness.gaps.join(', ')}.`)
  return { readiness, errors }
}
