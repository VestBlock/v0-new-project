export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { isTrustedN8nSecret } from '@/lib/n8n/operations'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_REQUEST_BYTES = 1_024
const DEFAULT_LIMIT = 25
const MAX_LIMIT = 25

type QueuedResearchJob = {
  id: string
  strategy_lane: string
  purpose: string
  extraction_template: string
  source_url: string
  source_domain: string
  terms_policy: string
  request_metadata: Record<string, unknown> | null
  requested_at: string
}

function requestedLimit(value: unknown) {
  if (value === undefined) return DEFAULT_LIMIT
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > MAX_LIMIT) return null
  return value
}

/**
 * Read-only handoff for the n8n research dispatcher.  The route deliberately
 * does not claim a job, scrape a site, create CRM records, or initiate
 * outreach. A separate approved worker must persist evidence through the
 * signed research-evidence callback once its public-web collection is complete.
 */
export async function POST(request: Request) {
  if (!isTrustedN8nSecret(request.headers.get('x-is-trusted'), process.env.N8N_WEBHOOK_SECRET)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  }

  const rawBody = await request.text()
  if (Buffer.byteLength(rawBody) > MAX_REQUEST_BYTES) {
    return NextResponse.json({ ok: false, error: 'Research dispatch request exceeds the 1 KB limit.' }, { status: 413 })
  }

  let payload: Record<string, unknown> = {}
  if (rawBody.trim()) {
    try {
      const parsed: unknown = JSON.parse(rawBody)
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('invalid payload')
      payload = parsed as Record<string, unknown>
    } catch {
      return NextResponse.json({ ok: false, error: 'Research dispatch request must contain a JSON object.' }, { status: 400 })
    }
  }

  const limit = requestedLimit(payload.limit)
  if (!limit) {
    return NextResponse.json({ ok: false, error: `limit must be an integer from 1 to ${MAX_LIMIT}.` }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: policies, error: policyError } = await admin
    .from('research_domain_policies')
    .select('domain')
    .eq('enabled', true)
    .eq('allow_scrapling', true)
    .eq('terms_status', 'approved')

  if (policyError) {
    return NextResponse.json({ ok: false, error: policyError.message }, { status: 500 })
  }

  const domains = (policies || []).map((policy) => String(policy.domain)).filter(Boolean)
  if (!domains.length) {
    return NextResponse.json({
      ok: true,
      mode: 'review_only',
      jobs: [],
      safeguards: { claimsJobs: false, fetchesWeb: false, crmEnrollment: false, outreach: false },
    })
  }

  const { data: jobs, error: jobsError } = await admin
    .from('research_jobs')
    .select('id,strategy_lane,purpose,extraction_template,source_url,source_domain,terms_policy,request_metadata,requested_at')
    .eq('status', 'queued')
    .in('source_domain', domains)
    .order('requested_at', { ascending: true })
    .limit(limit)

  if (jobsError) {
    return NextResponse.json({ ok: false, error: jobsError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    mode: 'review_only',
    jobs: (jobs || []) as QueuedResearchJob[],
    safeguards: {
      claimsJobs: false,
      fetchesWeb: false,
      crmEnrollment: false,
      outreach: false,
      callbackPath: '/api/webhooks/research-evidence',
    },
  })
}
