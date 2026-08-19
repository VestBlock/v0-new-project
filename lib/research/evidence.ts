import { z } from 'zod'

export const RESEARCH_PURPOSES = [
  'crm_research',
  'content_research',
  'market_research',
  'outreach_qualification',
] as const

export const RESEARCH_EXTRACTION_TEMPLATES = [
  'company_profile',
  'lender_criteria',
  'investor_criteria',
  'business_presence',
  'local_intelligence',
  'seo_research',
] as const

const publicUrl = z.string().url().max(2048).refine(
  (value) => {
    const url = new URL(value)
    const lower = value.toLowerCase()
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !['localhost', '0.0.0.0', '::1'].includes(url.hostname.toLowerCase()) &&
      !/(access_token|api_key|apikey|password|session|auth_token)=/.test(lower)
    )
  },
  'Evidence URL must be a public URL without credentials or session tokens.'
)

export const researchWorkerEvidenceSchema = z.object({
  source_url: publicUrl,
  source_domain: z.string().min(1).max(255).regex(/^[a-z0-9.-]+$/),
  retrieved_at: z.string().datetime({ offset: true }),
  robots_decision: z.enum(['robots_allowed', 'robots_not_found_allowed']),
  terms_policy: z.literal('approved'),
  extraction_method: z.string().min(3).max(160),
  title: z.string().max(500).nullable(),
  headings: z.array(z.string().max(300)).max(25),
  text_excerpt: z.string().min(1).max(20_000),
  content_risk_signals: z.array(z.string().max(120)).max(25),
  evidence_summary: z.string().min(1).max(2_000),
  cache_hit: z.boolean(),
})

export const researchJobRequestSchema = z.object({
  idempotency_key: z.string().min(16).max(128).regex(/^[A-Za-z0-9._:-]+$/),
  strategy_lane: z.string().min(2).max(80).regex(/^[a-z0-9_-]+$/),
  purpose: z.enum(RESEARCH_PURPOSES),
  extraction_template: z.enum(RESEARCH_EXTRACTION_TEMPLATES),
  source_url: publicUrl,
  terms_policy: z.literal('approved').default('approved'),
  request_metadata: z.record(z.string(), z.unknown()).default({}),
})

export const researchWorkerCallbackSchema = z.object({
  event_id: z.string().min(16).max(128).regex(/^[A-Za-z0-9._:-]+$/),
  job_id: z.string().uuid(),
  delivered_at: z.string().datetime({ offset: true }),
  evidence: researchWorkerEvidenceSchema,
})

export type ResearchWorkerEvidence = z.infer<typeof researchWorkerEvidenceSchema>
export type ResearchWorkerCallback = z.infer<typeof researchWorkerCallbackSchema>
export type ResearchJobRequest = z.infer<typeof researchJobRequestSchema>

export function normalizeResearchDomain(value: string) {
  return value.trim().toLowerCase().replace(/^www\./, '')
}

export function getResearchUrlDomain(value: string) {
  return normalizeResearchDomain(new URL(value).hostname)
}

export function isMatchingResearchUrl(expected: string, actual: string) {
  const normalized = (value: string) => {
    const url = new URL(value)
    url.hash = ''
    return url.toString()
  }
  return normalized(expected) === normalized(actual)
}
