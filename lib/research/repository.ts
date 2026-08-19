import 'server-only'

import { createHash } from 'node:crypto'

import {
  getResearchUrlDomain,
  isMatchingResearchUrl,
  normalizeResearchDomain,
  type ResearchJobRequest,
  type ResearchWorkerCallback,
} from '@/lib/research/evidence'
import { createAdminClient } from '@/lib/supabase/admin'

type ResearchJobRow = {
  id: string
  status: string
  source_url: string
  source_domain: string
  terms_policy: string
}

type DomainPolicyRow = {
  domain: string
  enabled: boolean
  allow_scrapling: boolean
  terms_status: string
}

export type ResearchCallbackPersistence = {
  accepted: boolean
  duplicate: boolean
  jobId: string
  evidenceId?: string
  reason?: string
}

export type ResearchJobPersistence = {
  jobId: string
  status: string
  duplicate: boolean
}

function hashText(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Research evidence persistence failed.')
}

export async function createResearchJob(input: {
  request: ResearchJobRequest
  requestedBy: string | null
}): Promise<ResearchJobPersistence> {
  const admin = createAdminClient()
  const sourceDomain = getResearchUrlDomain(input.request.source_url)
  const { data: policy, error: policyError } = await admin
    .from('research_domain_policies')
    .select('domain,enabled,allow_scrapling,terms_status')
    .eq('domain', sourceDomain)
    .maybeSingle<DomainPolicyRow>()
  if (policyError) throw policyError
  if (!policy?.enabled || !policy.allow_scrapling || policy.terms_status !== 'approved') {
    throw new Error(`Research source ${sourceDomain} is not approved for worker collection.`)
  }

  const { data: existing, error: existingError } = await admin
    .from('research_jobs')
    .select('id,status')
    .eq('idempotency_key', input.request.idempotency_key)
    .maybeSingle<{ id: string; status: string }>()
  if (existingError) throw existingError
  if (existing) return { jobId: existing.id, status: existing.status, duplicate: true }

  const now = new Date().toISOString()
  const { data: job, error: insertError } = await admin.from('research_jobs').insert({
    idempotency_key: input.request.idempotency_key,
    status: 'queued',
    strategy_lane: input.request.strategy_lane,
    purpose: input.request.purpose,
    extraction_template: input.request.extraction_template,
    source_url: input.request.source_url,
    source_domain: sourceDomain,
    terms_policy: input.request.terms_policy,
    requested_by: input.requestedBy,
    request_metadata: input.request.request_metadata,
    requested_at: now,
    updated_at: now,
  }).select('id,status').single()
  if (insertError) {
    if (insertError.code === '23505') {
      const { data: duplicate, error: duplicateError } = await admin
        .from('research_jobs')
        .select('id,status')
        .eq('idempotency_key', input.request.idempotency_key)
        .single<{ id: string; status: string }>()
      if (duplicateError) throw duplicateError
      return { jobId: duplicate.id, status: duplicate.status, duplicate: true }
    }
    throw insertError
  }
  return { jobId: job.id, status: job.status, duplicate: false }
}

export async function persistResearchWorkerCallback(input: {
  callback: ResearchWorkerCallback
  rawBody: string
}): Promise<ResearchCallbackPersistence> {
  const admin = createAdminClient()
  const { callback, rawBody } = input
  const { data: job, error: jobError } = await admin
    .from('research_jobs')
    .select('id,status,source_url,source_domain,terms_policy')
    .eq('id', callback.job_id)
    .maybeSingle<ResearchJobRow>()
  if (jobError) throw jobError
  if (!job) return { accepted: false, duplicate: false, jobId: callback.job_id, reason: 'Research job was not found.' }

  const sourceDomain = normalizeResearchDomain(callback.evidence.source_domain)
  if (sourceDomain !== getResearchUrlDomain(callback.evidence.source_url) || sourceDomain !== normalizeResearchDomain(job.source_domain)) {
    await admin.from('research_jobs').update({
      status: 'blocked',
      last_error: 'Worker callback source domain did not match the approved job domain.',
      callback_received_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', job.id)
    return { accepted: false, duplicate: false, jobId: job.id, reason: 'Evidence domain does not match the approved job.' }
  }
  if (!isMatchingResearchUrl(job.source_url, callback.evidence.source_url) || callback.evidence.terms_policy !== job.terms_policy) {
    await admin.from('research_jobs').update({
      status: 'blocked',
      last_error: 'Worker callback URL or terms policy did not match the approved job.',
      callback_received_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', job.id)
    return { accepted: false, duplicate: false, jobId: job.id, reason: 'Evidence URL or terms policy does not match the approved job.' }
  }

  const { data: policy, error: policyError } = await admin
    .from('research_domain_policies')
    .select('domain,enabled,allow_scrapling,terms_status')
    .eq('domain', sourceDomain)
    .maybeSingle<DomainPolicyRow>()
  if (policyError) throw policyError
  if (!policy?.enabled || !policy.allow_scrapling || policy.terms_status !== 'approved') {
    await admin.from('research_jobs').update({
      status: 'blocked',
      last_error: 'The domain policy is no longer approved for public-web research.',
      callback_received_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', job.id)
    return { accepted: false, duplicate: false, jobId: job.id, reason: 'The source domain is no longer approved.' }
  }

  const payloadHash = hashText(rawBody)
  const { data: existingEvent, error: existingEventError } = await admin
    .from('research_worker_events')
    .select('id,status,research_job_id')
    .eq('worker_event_id', callback.event_id)
    .maybeSingle()
  if (existingEventError) throw existingEventError
  if (existingEvent?.research_job_id && existingEvent.research_job_id !== job.id) {
    return { accepted: false, duplicate: false, jobId: job.id, reason: 'Worker event is already bound to another job.' }
  }
  if (existingEvent?.status === 'processed' || job.status === 'completed') {
    return { accepted: true, duplicate: true, jobId: job.id }
  }

  const now = new Date().toISOString()
  const { error: eventError } = await admin.from('research_worker_events').upsert({
    worker_event_id: callback.event_id,
    research_job_id: job.id,
    payload_hash: payloadHash,
    signature_version: 'v1',
    status: 'received',
    error_message: null,
    payload_json: {
      jobId: job.id,
      sourceDomain,
      sourceUrl: callback.evidence.source_url,
      retrievedAt: callback.evidence.retrieved_at,
      extractionMethod: callback.evidence.extraction_method,
    },
    received_at: now,
    processed_at: null,
  }, { onConflict: 'worker_event_id' })
  if (eventError) throw eventError

  const evidenceHash = hashText(JSON.stringify({
    sourceUrl: callback.evidence.source_url,
    retrievedAt: callback.evidence.retrieved_at,
    extractionMethod: callback.evidence.extraction_method,
    textExcerpt: callback.evidence.text_excerpt,
  }))

  try {
    const { data: evidence, error: evidenceError } = await admin.from('research_evidence').upsert({
      research_job_id: job.id,
      worker_event_id: callback.event_id,
      source_url: callback.evidence.source_url,
      source_domain: sourceDomain,
      retrieved_at: callback.evidence.retrieved_at,
      robots_decision: callback.evidence.robots_decision,
      terms_policy: callback.evidence.terms_policy,
      extraction_method: callback.evidence.extraction_method,
      title: callback.evidence.title,
      headings: callback.evidence.headings,
      text_excerpt: callback.evidence.text_excerpt,
      content_risk_signals: callback.evidence.content_risk_signals,
      evidence_summary: callback.evidence.evidence_summary,
      evidence_hash: evidenceHash,
      review_status: 'pending_review',
      eligible_for_crm: false,
      eligible_for_content: false,
      eligible_for_outreach_qualification: false,
      metadata_json: { cacheHit: callback.evidence.cache_hit },
      updated_at: now,
    }, { onConflict: 'research_job_id' }).select('id').single()
    if (evidenceError) throw evidenceError

    const { error: jobUpdateError } = await admin.from('research_jobs').update({
      status: 'completed',
      worker_request_id: callback.event_id,
      callback_received_at: now,
      completed_at: now,
      last_error: null,
      updated_at: now,
    }).eq('id', job.id)
    if (jobUpdateError) throw jobUpdateError

    const { error: eventUpdateError } = await admin.from('research_worker_events').update({
      status: 'processed',
      processed_at: now,
      error_message: null,
    }).eq('worker_event_id', callback.event_id)
    if (eventUpdateError) throw eventUpdateError

    return { accepted: true, duplicate: false, jobId: job.id, evidenceId: evidence.id }
  } catch (error) {
    const message = errorMessage(error)
    await Promise.all([
      admin.from('research_jobs').update({ status: 'failed', last_error: message, callback_received_at: now, updated_at: now }).eq('id', job.id),
      admin.from('research_worker_events').update({ status: 'failed', error_message: message }).eq('worker_event_id', callback.event_id),
    ])
    throw error
  }
}
