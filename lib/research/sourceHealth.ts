import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

export type ResearchSourceHealthStatus = 'ready' | 'awaiting_evidence' | 'stale' | 'blocked' | 'disabled' | 'schema_pending'

export type ResearchSourceHealthRow = {
  domain: string
  sourceTier: 'primary' | 'trusted' | 'public'
  status: ResearchSourceHealthStatus
  termsStatus: string
  rateLimitPerDay: number
  reviewRequired: boolean
  lastEvidenceAt: string | null
  jobs7d: number
  failedJobs7d: number
  detail: string
}

export type ResearchSourceHealthSnapshot = {
  status: 'ready' | 'attention' | 'schema_pending'
  schemaReady: boolean
  headline: string
  evidenceCount: number
  pendingReviewCount: number
  activeSourceCount: number
  lastEvidenceAt: string | null
  sources: ResearchSourceHealthRow[]
}

type DomainRow = {
  domain: string
  source_tier: 'primary' | 'trusted' | 'public'
  enabled: boolean
  allow_scrapling: boolean
  terms_status: string
  rate_limit_per_day: number
  review_required: boolean
}

type JobRow = { source_domain: string; status: string; requested_at: string }
type EvidenceRow = { source_domain: string; retrieved_at: string; review_status: string }

const EMPTY_SNAPSHOT: ResearchSourceHealthSnapshot = {
  status: 'schema_pending',
  schemaReady: false,
  headline: 'Research evidence storage is waiting for its reviewed database migration.',
  evidenceCount: 0,
  pendingReviewCount: 0,
  activeSourceCount: 0,
  lastEvidenceAt: null,
  sources: [],
}

function latest(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) || null
}

function withinDays(value: string, days: number) {
  return Date.now() - new Date(value).getTime() <= days * 24 * 60 * 60 * 1000
}

export async function loadResearchSourceHealth(): Promise<ResearchSourceHealthSnapshot> {
  const admin = createAdminClient()
  const [domainsResult, jobsResult, evidenceResult] = await Promise.all([
    admin.from('research_domain_policies').select('domain,source_tier,enabled,allow_scrapling,terms_status,rate_limit_per_day,review_required'),
    admin.from('research_jobs').select('source_domain,status,requested_at').order('requested_at', { ascending: false }).limit(500),
    admin.from('research_evidence').select('source_domain,retrieved_at,review_status').order('retrieved_at', { ascending: false }).limit(500),
  ])
  if (domainsResult.error || jobsResult.error || evidenceResult.error) return EMPTY_SNAPSHOT

  const domains = (domainsResult.data || []) as DomainRow[]
  const jobs = (jobsResult.data || []) as JobRow[]
  const evidence = (evidenceResult.data || []) as EvidenceRow[]
  const sources = domains.map((domain) => {
    const domainEvidence = evidence.filter((row) => row.source_domain === domain.domain)
    const domainJobs7d = jobs.filter((row) => row.source_domain === domain.domain && withinDays(row.requested_at, 7))
    const lastEvidenceAt = latest(domainEvidence.map((row) => row.retrieved_at))
    const failedJobs7d = domainJobs7d.filter((row) => ['blocked', 'failed'].includes(row.status)).length
    let status: ResearchSourceHealthStatus = 'ready'
    let detail = 'Public research is policy-approved; evidence still requires review before reuse.'
    if (!domain.enabled || !domain.allow_scrapling) {
      status = 'disabled'
      detail = 'Disabled by the source policy; no worker collection is allowed.'
    } else if (domain.terms_status !== 'approved') {
      status = 'blocked'
      detail = 'Terms review is not approved; collection remains blocked.'
    } else if (failedJobs7d > 0) {
      status = 'blocked'
      detail = `${failedJobs7d} research job${failedJobs7d === 1 ? '' : 's'} blocked or failed in the last 7 days.`
    } else if (!lastEvidenceAt) {
      status = 'awaiting_evidence'
      detail = 'Approved source, but no durable evidence has been received yet.'
    } else if (!withinDays(lastEvidenceAt, 14)) {
      status = 'stale'
      detail = 'Evidence is older than 14 days and should be refreshed before it informs a decision.'
    }
    return {
      domain: domain.domain,
      sourceTier: domain.source_tier,
      status,
      termsStatus: domain.terms_status,
      rateLimitPerDay: domain.rate_limit_per_day,
      reviewRequired: domain.review_required,
      lastEvidenceAt,
      jobs7d: domainJobs7d.length,
      failedJobs7d,
      detail,
    }
  }).sort((left, right) => left.domain.localeCompare(right.domain))

  const pendingReviewCount = evidence.filter((row) => row.review_status === 'pending_review').length
  const activeSourceCount = sources.filter((row) => row.status === 'ready').length
  const hasAttention = sources.some((row) => ['blocked', 'stale'].includes(row.status))
  return {
    status: hasAttention ? 'attention' : 'ready',
    schemaReady: true,
    headline: hasAttention
      ? 'Research evidence is visible, with source-policy or freshness work requiring attention.'
      : 'Public research is policy-bound, reviewable, and separated from CRM and outreach activation.',
    evidenceCount: evidence.length,
    pendingReviewCount,
    activeSourceCount,
    lastEvidenceAt: latest(evidence.map((row) => row.retrieved_at)),
    sources,
  }
}
