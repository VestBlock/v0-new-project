import 'server-only'

import { runStrategySourceOrchestrator, type StrategySourceOrchestrationResult } from '@/lib/admin/strategySourceOrchestrator'
import {
  STRATEGY_EXECUTION_LANES,
  marketLabel,
  qualifyLeadForStrategy,
  splitMarket,
  type StrategyLane,
  type StrategySourceProvider,
} from '@/lib/admin/strategyExecutionCatalog'
import { buildStrategyEmailDraft } from '@/lib/admin/strategyOutreachTemplates'
import { getStrategyLeadProvenance, strategySourceProviderForLead } from '@/lib/admin/strategyLeadProvenance'
import { syncDealMachineLeadSource } from '@/lib/dealmachine/api'
import { sendEmail } from '@/lib/email/sendEmail'
import { saveOutreachMessages, updateLeadRecord } from '@/lib/leads/repository'
import { getDeliveryCircuitBreaker } from '@/lib/leads/deliveryHealth'
import { getLeadOutboundPauseReason } from '@/lib/leads/outboundEligibility'
import { getOutboundProviderReadiness } from '@/lib/leads/outbound'
import type { LeadRecord, OutreachMessageRecord } from '@/lib/leads/types'
import { verifyEmailWithHunter, type HunterEmailVerification } from '@/lib/outreach/hunterEmailVerification'
import { getReplyCaptureReadiness, type ReplyCaptureReadiness } from '@/lib/outreach/reply-capture'
import {
  fingerprintGovernedOutreachMessage,
  recordOperatingStrategyActivity,
  resolveOperatingStrategyBinding,
  type OperatingStrategyBinding,
} from '@/lib/strategy/runtime-governance'
import { createAdminClient } from '@/lib/supabase/admin'

type StrategyMarketStateRow = {
  id: string
  strategy_key: string
  market: string
  source_provider: StrategySourceProvider
  status: string
  priority_score: number | string
  consecutive_empty_runs: number
  last_source_at: string | null
  last_attempt_at?: string | null
  last_source_success_at?: string | null
  last_contact_ready_at?: string | null
  next_run_at: string | null
  metrics_json: Record<string, unknown> | null
}

type Candidate = {
  lead: LeadRecord
  score: number
  reasons: string[]
  reviewOnly: boolean
  matchedStrategyKeys: string[]
}

type AssignedContacts = {
  leadIds: Set<string>
  recipientKeys: Set<string>
}

type LaneRunResult = {
  runId: string | null
  runKey: string
  strategyKey: string
  strategyName: string
  market: string
  sourceProvider: StrategySourceProvider
  status: string
  discovered: number
  qualified: number
  draftsCreated: number
  reviewOnly: number
  message: string
}

export type StrategyExecutionResult = {
  dryRun: boolean
  generatedAt: string
  sourceProviders: StrategySourceProvider[]
  sourceSyncSkipped: boolean
  recoveredRuns: number
  deliveryCircuit: {
    allowed: boolean
    mode: string
    provider: string
    reason: string | null
    maxBatchSize: number | null
    badRate: number
    threshold: number
    sampleSize: number
  }
  sourceSync: Awaited<ReturnType<typeof syncDealMachineLeadSource>>
  sourceAcquisition: StrategySourceOrchestrationResult
  outboundReadiness: {
    provider: 'gmail' | 'resend' | 'none'
    configured: boolean
    ready: boolean
    reason: string | null
  }
  replyCaptureReadiness: ReplyCaptureReadiness
  candidateLeads: number
  contactHistoryExcluded: number
  staleCandidateLeadsExcluded: number
  unprovenCandidateLeadsExcluded: number
  strategyContractMismatchExcluded: number
  unassignedLeads: number
  marketsSeeded: number
  laneRuns: LaneRunResult[]
  report: {
    date: string
    status: 'completed' | 'partial' | 'blocked' | 'failed'
    citiesAttempted: number
    sourcesAttempted: number
    leadsDiscovered: number
    leadsQualified: number
    draftsCreated: number
    accepted: number
    delivered: number
    replies: number
    blockers: string[]
  }
}

async function recoverStaleStrategyRuns() {
  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const { data: staleRuns, error: staleRunsError } = await admin
    .from('command_center_strategy_runs')
    .select('id,strategy_key,market,source_provider,metadata_json,started_at,created_at,operating_strategy_version_id')
    .eq('status', 'running')
    .lt('started_at', cutoff)
    .limit(50)
  if (staleRunsError) throw staleRunsError

  let recovered = 0
  for (const run of staleRuns || []) {
    const { data: memberships, error: membershipError } = await admin
      .from('strategy_lead_memberships')
      .select('status,canonical_activity_id,operating_strategy_version_id,metadata_json')
      .eq('campaign_run_id', run.id)
    if (membershipError) throw membershipError
    const statuses = (memberships || []).map((membership) => String(membership.status || ''))
    const draftCount = statuses.filter((status) => !['qualified', 'rejected', 'failed'].includes(status)).length
    const governedRun = Boolean(run.operating_strategy_version_id)
    const incompleteGovernedEvidence = governedRun && (memberships || []).some((membership) => {
      const metadata = (membership.metadata_json || {}) as Record<string, unknown>
      if (
        membership.operating_strategy_version_id !== run.operating_strategy_version_id ||
        !membership.canonical_activity_id
      ) return true
      return membership.status === 'needs_review' && !String(metadata.canonicalMessageActivityId || '').trim()
    })
    const finalStatus = incompleteGovernedEvidence ? 'failed' : draftCount ? 'drafted' : 'failed'
    const { error: runError } = await admin
      .from('command_center_strategy_runs')
      .update({
        status: finalStatus,
        lead_count: statuses.length,
        qualified_count: statuses.length,
        draft_count: draftCount,
        completed_at: new Date().toISOString(),
        metadata_json: {
          ...((run.metadata_json || {}) as Record<string, unknown>),
          recoveredAfterInterruptedExecution: true,
          recoveredAt: new Date().toISOString(),
          recoveredDraftCount: draftCount,
          governedRun,
          requiresOperatorReconciliation: incompleteGovernedEvidence,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', run.id)
    if (runError) throw runError

    if (!governedRun && run.market && run.source_provider) {
      const { error: marketError } = await admin
        .from('strategy_market_state')
        .update({
          status: draftCount ? 'cooling' : 'active',
          last_attempt_at: new Date().toISOString(),
          last_qualified_at: draftCount ? new Date().toISOString() : null,
          next_run_at: new Date(Date.now() + (draftCount ? 14 : 1) * 24 * 60 * 60 * 1000).toISOString(),
          metrics_json: {
            recoveredRunId: run.id,
            recoveredDraftCount: draftCount,
            recoveredAt: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('strategy_key', run.strategy_key)
        .eq('market', run.market)
        .eq('source_provider', run.source_provider)
      if (marketError) throw marketError
    }
    recovered += 1
  }
  return recovered
}

function envInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function reportDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function normalizeMarket(value: string) {
  const { city, state } = splitMarket(value)
  return city && state ? `${city}, ${state}` : value.trim()
}

function poolKey(strategyKey: string, market: string, sourceProvider: string) {
  return `${strategyKey}::${normalizeMarket(market).toLowerCase()}::${sourceProvider}`
}

function runKey(
  date: string,
  strategyKey: string,
  market: string,
  provider: string,
  binding: OperatingStrategyBinding,
  dryRun: boolean
) {
  return [
    date,
    dryRun ? 'dry_run' : 'execution',
    strategyKey,
    normalizeMarket(market).toLowerCase(),
    provider,
    binding.operatingStrategyVersionId,
    binding.contractFingerprint,
  ].join(':')
}

function emptySourceAcquisition(dryRun: boolean, blocker?: string): StrategySourceOrchestrationResult {
  return {
    dryRun,
    generatedAt: new Date().toISOString(),
    propertiesSeen: 0,
    candidatesStacked: 0,
    researchRowsUpserted: 0,
    contactReady: 0,
    contactEnrichmentRequired: 0,
    sensitiveReview: 0,
    leadsPromoted: 0,
    marketsActivated: 0,
    laneCounts: {},
    sourceFamilies: {},
    blockers: blocker ? [blocker] : [],
    adapterReadiness: [],
  }
}

async function verifySelectedRecipients(selected: Candidate[]) {
  const verifyLimit = Math.min(selected.length, envInt('STRATEGY_ENGINE_HUNTER_VERIFY_LIMIT', 25))
  const queue = selected.slice(0, verifyLimit)
  const results = new Map<string, HunterEmailVerification>()
  let cursor = 0
  const workerCount = Math.min(5, queue.length)

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < queue.length) {
        const candidate = queue[cursor]
        cursor += 1
        const email = String(candidate?.lead.email || '').trim()
        if (!candidate || !email) continue
        results.set(candidate.lead.id, await verifyEmailWithHunter(email))
      }
    })
  )

  return results
}

async function loadSellerCandidates(limit: number) {
  const admin = createAdminClient()
  const rows: LeadRecord[] = []
  const pageSize = 1000
  const max = Math.min(10_000, Math.max(pageSize, limit))

  for (let from = 0; from < max; from += pageSize) {
    const { data, error } = await admin
      .from('leads')
      .select('*')
      .eq('category', 'seller_lead')
      .not('status', 'in', '(contacted,replied,interested,qualified,closed,closed_won,closed_lost,disqualified,do_not_contact)')
      .order('created_at', { ascending: false })
      .range(from, Math.min(from + pageSize - 1, max - 1))
    if (error) throw error
    rows.push(...((data || []) as LeadRecord[]))
    if ((data || []).length < pageSize) break
  }

  return rows.filter(
    (lead) =>
      lead.email &&
      lead.email_valid !== false &&
      !getLeadOutboundPauseReason(lead) &&
      !['sent', 'do_not_contact'].includes(String(lead.outreach_status || '')) &&
      !['accepted', 'sent', 'delivered', 'replied', 'bounced', 'complained', 'suppressed', 'failed'].includes(
        String(lead.delivery_status || '')
      )
  )
}

async function loadAssignedContacts(): Promise<AssignedContacts> {
  const admin = createAdminClient()
  const leadIds = new Set<string>()
  const recipientKeys = new Set<string>()
  for (let from = 0; from < 10_000; from += 1000) {
    const { data, error } = await admin
      .from('strategy_lead_memberships')
      .select('lead_id,recipient_key')
      .range(from, from + 999)
    if (error) throw error
    for (const row of data || []) {
      leadIds.add(row.lead_id)
      if (row.recipient_key) recipientKeys.add(String(row.recipient_key).trim().toLowerCase())
    }
    if ((data || []).length < 1000) break
  }
  return { leadIds, recipientKeys }
}

async function loadPreviouslyContactedLeadIds() {
  const admin = createAdminClient()
  const leadIds = new Set<string>()
  const terminalStatuses = ['accepted', 'sent', 'delivered', 'opened', 'clicked', 'replied']

  for (let from = 0; from < 20_000; from += 1000) {
    const { data, error } = await admin
      .from('outreach_send_events')
      .select('lead_id')
      .in('status', terminalStatuses)
      .not('lead_id', 'is', null)
      .range(from, from + 999)
    if (error) throw error
    for (const row of data || []) if (row.lead_id) leadIds.add(row.lead_id)
    if ((data || []).length < 1000) break
  }

  for (let from = 0; from < 20_000; from += 1000) {
    const { data, error } = await admin
      .from('outreach_messages')
      .select('lead_id')
      .not('sent_at', 'is', null)
      .range(from, from + 999)
    if (error) throw error
    for (const row of data || []) if (row.lead_id) leadIds.add(row.lead_id)
    if ((data || []).length < 1000) break
  }

  return leadIds
}

function buildCandidatePools(leads: LeadRecord[], assigned: AssignedContacts, previouslyContactedLeadIds: Set<string>) {
  const pools = new Map<string, Candidate[]>()
  let staleCandidateLeadsExcluded = 0
  let unprovenCandidateLeadsExcluded = 0
  let strategyContractMismatchExcluded = 0
  let provenanceEligibleLeads = 0

  for (const lead of leads) {
    if (getLeadOutboundPauseReason(lead)) continue
    const recipientKey = String(lead.email || '').trim().toLowerCase()
    if (
      previouslyContactedLeadIds.has(lead.id) ||
      assigned.leadIds.has(lead.id) ||
      assigned.recipientKeys.has(recipientKey)
    ) continue
    const provenance = getStrategyLeadProvenance(lead)
    if (!provenance) {
      unprovenCandidateLeadsExcluded += 1
      continue
    }
    provenanceEligibleLeads += 1
    const market = marketLabel(lead)
    if (!market) continue
    const provider = provenance.provider
    const lane = STRATEGY_EXECUTION_LANES.find(
      (item) => item.enabled && item.key === provenance.primaryStrategyKey && item.sourceProviders.includes(provider)
    )
    if (!lane) {
      strategyContractMismatchExcluded += 1
      continue
    }
    const qualification = qualifyLeadForStrategy(lead, lane, provider)
    if (!qualification.eligible && qualification.reasons.some((reason) => reason.startsWith('source freshness:'))) {
      staleCandidateLeadsExcluded += 1
    }
    if (!qualification.eligible) {
      strategyContractMismatchExcluded += 1
      continue
    }

    const key = poolKey(lane.key, market, provider)
    const current = pools.get(key) || []
    current.push({
      lead,
      score: qualification.score,
      reasons: qualification.reasons,
      reviewOnly: qualification.reviewOnly,
      matchedStrategyKeys: provenance.matchedStrategyKeys,
    })
    pools.set(key, current)
  }

  for (const [key, rows] of pools.entries()) {
    const seenRecipients = new Set<string>()
    pools.set(
      key,
      rows
        .sort((left, right) => right.score - left.score || left.lead.id.localeCompare(right.lead.id))
        .filter((candidate) => {
          const recipientKey = String(candidate.lead.email || '').trim().toLowerCase()
          if (!recipientKey || seenRecipients.has(recipientKey)) return false
          seenRecipients.add(recipientKey)
          return true
        })
    )
  }
  return {
    pools,
    staleCandidateLeadsExcluded,
    unprovenCandidateLeadsExcluded,
    strategyContractMismatchExcluded,
    provenanceEligibleLeads,
  }
}

async function seedMarketStates(
  pools: Map<string, Candidate[]>,
  sourceProviders: Set<StrategySourceProvider>
) {
  const admin = createAdminClient()
  const rows: Array<Record<string, unknown>> = []
  const seen = new Set<string>()

  for (const lane of STRATEGY_EXECUTION_LANES.filter((item) => item.enabled)) {
    for (const provider of lane.sourceProviders.filter((candidate) => sourceProviders.has(candidate))) {
      for (const market of lane.markets) {
        const key = poolKey(lane.key, market, provider)
        if (seen.has(key)) continue
        const discoveredPool = pools.get(key)?.length || 0
        if (discoveredPool < lane.minMarketPool) continue
        seen.add(key)
        rows.push({
          strategy_key: lane.key,
          market: normalizeMarket(market),
          source_provider: provider,
          status: 'active',
          priority_score: 0,
          next_run_at: new Date().toISOString(),
          metrics_json: { discoveredPool, discoveredFromDatabase: true },
        })
      }
    }
  }

  for (const [key, candidates] of pools.entries()) {
    const [strategyKey, marketLower, sourceProvider] = key.split('::')
    const lane = STRATEGY_EXECUTION_LANES.find((item) => item.key === strategyKey)
    if (!lane || candidates.length < lane.minMarketPool) continue
    const market = marketLabel(candidates[0].lead) || marketLower
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({
      strategy_key: strategyKey,
      market,
      source_provider: sourceProvider,
      status: 'active',
      next_run_at: new Date().toISOString(),
      priority_score: Math.min(100, 50 + candidates.length),
      metrics_json: { discoveredPool: candidates.length, discoveredFromDatabase: true },
    })
  }

  let seeded = 0
  for (let index = 0; index < rows.length; index += 250) {
    const { data, error } = await admin
      .from('strategy_market_state')
      .upsert(rows.slice(index, index + 250), {
        onConflict: 'strategy_key,market,source_provider',
        // Fresh, unassigned inventory must wake an existing market immediately.
        // Once the leads are enrolled they leave `pools`, so this does not create
        // a perpetual retry loop for exhausted or cooling markets.
        ignoreDuplicates: false,
      })
      .select('id')
    if (error) throw error
    seeded += data?.length || 0
  }
  return seeded
}

async function loadMarketStates() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('strategy_market_state')
    .select('*')
    .in('status', ['active', 'cooling'])
    .order('priority_score', { ascending: false })
    .limit(2000)
  if (error) throw error
  return (data || []) as StrategyMarketStateRow[]
}

function chooseTargets(states: StrategyMarketStateRow[], pools: Map<string, Candidate[]>, limit: number) {
  const now = Date.now()
  const due = states.filter((state) => !state.next_run_at || Date.parse(state.next_run_at) <= now)
  const byLane = new Map<string, StrategyMarketStateRow[]>()
  for (const state of due) {
    const lane = STRATEGY_EXECUTION_LANES.find((item) => item.key === state.strategy_key && item.enabled)
    if (!lane) continue
    const rows = byLane.get(state.strategy_key) || []
    rows.push(state)
    byLane.set(state.strategy_key, rows)
  }

  const laneChoices = Array.from(byLane.entries()).map(([strategyKey, rows]) => {
    const sorted = [...rows].sort((left, right) => {
      const leftPool = pools.get(poolKey(strategyKey, left.market, left.source_provider))?.length || 0
      const rightPool = pools.get(poolKey(strategyKey, right.market, right.source_provider))?.length || 0
      const leftUntried = left.last_source_at ? 0 : 1
      const rightUntried = right.last_source_at ? 0 : 1
      if ((leftPool > 0) !== (rightPool > 0)) return rightPool > 0 ? 1 : -1
      if (leftUntried !== rightUntried) return rightUntried - leftUntried
      if (leftPool !== rightPool) return rightPool - leftPool
      return Number(right.priority_score || 0) - Number(left.priority_score || 0)
    })
    return {
      strategyKey,
      state: sorted[0],
      oldest: Math.min(...rows.map((row) => (row.last_source_at ? Date.parse(row.last_source_at) : 0))),
    }
  })

  return laneChoices
    .sort((left, right) => left.oldest - right.oldest)
    .slice(0, limit)
    .map((choice) => choice.state)
}

async function createStrategyRun(input: {
  runKey: string
  lane: StrategyLane
  state: StrategyMarketStateRow
  candidates: Candidate[]
  dryRun: boolean
  binding: OperatingStrategyBinding
}) {
  const admin = createAdminClient()
  const startedAt = new Date().toISOString()
  const payload = {
    run_key: input.runKey,
    strategy_key: input.lane.key,
    strategy_name: input.lane.label,
    status: input.dryRun ? 'dry_run' : input.candidates.length ? 'running' : 'awaiting_contacts',
    source_provider: input.state.source_provider,
    market: input.state.market,
    target_email_count: Math.min(input.candidates.length, envInt('STRATEGY_ENGINE_MAX_DRAFTS_PER_LANE', 25)),
    target_sms_count: 0,
    lead_count: input.candidates.length,
    qualified_count: input.candidates.length,
    draft_count: 0,
    approved_count: 0,
    sent_count: 0,
    sms_review_count: 0,
    execution_mode: 'execution',
    cost_guardrail_status: input.state.source_provider === 'public_records' ? 'blocked' : 'allowed',
    started_at: startedAt,
    completed_at: input.dryRun || !input.candidates.length ? startedAt : null,
    operating_strategy_id: input.binding.operatingStrategyId,
    operating_strategy_version_id: input.binding.operatingStrategyVersionId,
    strategy_identifier_namespace: input.binding.namespace,
    strategy_binding_mode: 'governed_v1',
    strategy_binding_recorded_at: startedAt,
    strategy_writer_release: 'gate_3c',
    destination_mode_snapshot: input.binding.destinationMode,
    destination_path_snapshot: input.binding.destinationPath,
    cta_label_snapshot: input.binding.ctaLabel,
    operating_contract_fingerprint: input.binding.contractFingerprint,
    metadata_json: {
      verifiedExecution: true,
      governedExecution: true,
      operatingStrategyVersionId: input.binding.operatingStrategyVersionId,
      operatingContractFingerprint: input.binding.contractFingerprint,
      dryRun: input.dryRun,
      candidateLeadIds: input.candidates.slice(0, 100).map((candidate) => candidate.lead.id),
      qualificationPreview: input.candidates.slice(0, 10).map((candidate) => ({
        leadId: candidate.lead.id,
        score: candidate.score,
        reasons: candidate.reasons,
        matchedStrategyKeys: candidate.matchedStrategyKeys,
      })),
    },
  }
  const existing = await admin
    .from('command_center_strategy_runs')
    .select(
      'id,status,started_at,canonical_activity_id,operating_strategy_version_id,operating_contract_fingerprint,metadata_json',
    )
    .eq('run_key', input.runKey)
    .maybeSingle()
  if (existing.error) throw existing.error
  const existingMetadata = (existing.data?.metadata_json || {}) as Record<string, unknown>
  if (
    existing.data &&
    (existing.data.operating_strategy_version_id !== input.binding.operatingStrategyVersionId ||
      existing.data.operating_contract_fingerprint !== input.binding.contractFingerprint ||
      Boolean(existingMetadata.dryRun) !== input.dryRun)
  ) {
    throw new Error('An existing strategy run cannot be rebound to a different operating contract or execution mode.')
  }

  let run = existing.data
  if (!run) {
    const inserted = await admin
      .from('command_center_strategy_runs')
      .insert(payload)
      .select(
        'id,status,started_at,canonical_activity_id,operating_strategy_version_id,operating_contract_fingerprint,metadata_json',
      )
      .single()
    if (inserted.error) throw inserted.error
    run = inserted.data
  }

  let canonicalActivityId = run.canonical_activity_id as string | null
  if (!canonicalActivityId) {
    canonicalActivityId = await recordOperatingStrategyActivity({
      binding: input.binding,
      activityType: 'domain_event',
      activityNamespace: 'command_center_strategy_run',
      activityKey: run.id,
      subjectNamespace: 'strategy_market',
      subjectKey: `${normalizeMarket(input.state.market).toLowerCase()}:${input.state.source_provider}`,
      idempotencyKey: `strategy-run:${input.binding.operatingStrategyVersionId}:${run.id}`,
      occurredAt: run.started_at || startedAt,
      provenance: [
        {
          kind: 'strategy_execution_catalog',
          sourceProvider: input.state.source_provider,
          market: input.state.market,
          dryRun: input.dryRun,
        },
      ],
      metadata: {
        runId: run.id,
        runKey: input.runKey,
        candidateCount: input.candidates.length,
        lifecycleEvent: input.dryRun ? 'dry_run_started' : 'run_started',
      },
    })
    const linked = await admin
      .from('command_center_strategy_runs')
      .update({ canonical_activity_id: canonicalActivityId, updated_at: new Date().toISOString() })
      .eq('id', run.id)
      .eq('operating_strategy_version_id', input.binding.operatingStrategyVersionId)
      .is('canonical_activity_id', null)
      .select('id')
    if (linked.error) throw linked.error
    if ((linked.data || []).length !== 1) {
      const current = await admin
        .from('command_center_strategy_runs')
        .select('id')
        .eq('id', run.id)
        .eq('canonical_activity_id', canonicalActivityId)
        .maybeSingle()
      if (current.error) throw current.error
      if (!current.data) throw new Error('Canonical strategy-run activity did not link exactly once.')
    }
  }
  return { id: run.id as string, status: run.status as string, canonicalActivityId }
}

async function updateMarketAfterRun(
  state: StrategyMarketStateRow,
  input: { qualified: number; drafted: number; status: string; message: string }
) {
  const admin = createAdminClient()
  const consecutiveEmptyRuns = input.qualified ? 0 : Number(state.consecutive_empty_runs || 0) + 1
  const nextDelayDays = input.qualified ? 14 : Math.min(30, Math.max(1, consecutiveEmptyRuns * 3))
  const nextRunAt = new Date(Date.now() + nextDelayDays * 24 * 60 * 60 * 1000).toISOString()
  const status = consecutiveEmptyRuns >= 3 ? 'exhausted' : input.qualified ? 'cooling' : 'active'
  const metrics = {
    ...(state.metrics_json || {}),
    lastRunStatus: input.status,
    lastMessage: input.message,
    lastQualified: input.qualified,
    lastDrafted: input.drafted,
    lastRunAt: new Date().toISOString(),
  }
  const priorityScore = Math.max(
    -100,
    Math.min(100, Number(state.priority_score || 0) + input.qualified * 0.5 - consecutiveEmptyRuns * 10)
  )
  const { error } = await admin
    .from('strategy_market_state')
    .update({
      status,
      priority_score: priorityScore,
      consecutive_empty_runs: consecutiveEmptyRuns,
      last_attempt_at: new Date().toISOString(),
      last_qualified_at: input.qualified ? new Date().toISOString() : null,
      next_run_at: nextRunAt,
      metrics_json: metrics,
      updated_at: new Date().toISOString(),
    })
    .eq('id', state.id)
  if (error) throw error
}

async function executeLane(input: {
  date: string
  state: StrategyMarketStateRow
  lane: StrategyLane
  pool: Candidate[]
  assigned: AssignedContacts
  dryRun: boolean
  deliveryAllowed: boolean
  binding: OperatingStrategyBinding
}): Promise<LaneRunResult> {
  const initiallyUnassigned = input.pool.filter((candidate) => {
    const recipientKey = String(candidate.lead.email || '').trim().toLowerCase()
    return !input.assigned.leadIds.has(candidate.lead.id) && !input.assigned.recipientKeys.has(recipientKey)
  })
  const key = runKey(
    input.date,
    input.lane.key,
    input.state.market,
    input.state.source_provider,
    input.binding,
    input.dryRun
  )
  const run = await createStrategyRun({
    runKey: key,
    lane: input.lane,
    state: input.state,
    candidates: initiallyUnassigned,
    dryRun: input.dryRun,
    binding: input.binding,
  })
  const admin = createAdminClient()
  const { data: existingRunMemberships, error: existingRunMembershipsError } = input.dryRun
    ? { data: [], error: null }
    : await admin
        .from('strategy_lead_memberships')
        .select(
          'id,lead_id,campaign_run_id,canonical_activity_id,operating_strategy_version_id,operating_contract_fingerprint,strategy_binding_recorded_at,assigned_at,metadata_json,status,qualification_score,qualification_reasons,email_verification_status,market,source_provider,recipient_key'
        )
        .eq('campaign_run_id', run.id)
  if (existingRunMembershipsError) throw existingRunMembershipsError
  const existingMembershipByLeadId = new Map(
    (existingRunMemberships || []).map((membership) => [String(membership.lead_id), membership])
  )
  const candidates = input.pool.filter((candidate) => {
    if (existingMembershipByLeadId.has(candidate.lead.id)) return true
    const recipientKey = String(candidate.lead.email || '').trim().toLowerCase()
    return !input.assigned.leadIds.has(candidate.lead.id) && !input.assigned.recipientKeys.has(recipientKey)
  })
  const draftLimit = envInt('STRATEGY_ENGINE_MAX_DRAFTS_PER_LANE', 25)

  if (input.dryRun || !candidates.length) {
    const message = candidates.length
      ? `${candidates.length} real lead(s) qualify; dry run created no drafts.`
      : 'No unassigned qualifying contacts were available for this city and source.'
    if (!input.dryRun) {
      await updateMarketAfterRun(input.state, { qualified: 0, drafted: 0, status: 'awaiting_contacts', message })
    }
    return {
      runId: run.id,
      runKey: key,
      strategyKey: input.lane.key,
      strategyName: input.lane.label,
      market: input.state.market,
      sourceProvider: input.state.source_provider,
      status: input.dryRun ? 'dry_run' : 'awaiting_contacts',
      discovered: candidates.length,
      qualified: candidates.length,
      draftsCreated: 0,
      reviewOnly: candidates.filter((candidate) => candidate.reviewOnly).length,
      message,
    }
  }

  let draftsCreated = 0
  let reviewOnly = 0
  const selected = candidates.slice(0, draftLimit)
  const verificationByLeadId = await verifySelectedRecipients(
    selected.filter((candidate) => !existingMembershipByLeadId.has(candidate.lead.id))
  )

  for (const candidate of selected) {
    let membershipRecordedAt = new Date().toISOString()
    const recipientKey = String(candidate.lead.email || '').trim().toLowerCase()
    let membership = existingMembershipByLeadId.get(candidate.lead.id) || null
    const storedMembershipMetadata = (membership?.metadata_json || {}) as Record<string, unknown>
    const storedVerification = storedMembershipMetadata.hunterVerification as HunterEmailVerification | undefined
    const verification = storedVerification || verificationByLeadId.get(candidate.lead.id) || {
      configured: Boolean(process.env.HUNTER_API_KEY),
      status: 'unverified' as const,
      score: null,
      smtpCheck: null,
      acceptAll: null,
      approvalSafe: false,
      hardInvalid: false,
      reason: 'Recipient was not verified in this execution.',
    }
    const effectiveReviewOnly =
      typeof storedMembershipMetadata.reviewOnly === 'boolean'
        ? storedMembershipMetadata.reviewOnly
        : candidate.reviewOnly || !verification.approvalSafe
    if (
      membership &&
      (membership.campaign_run_id !== run.id ||
        membership.operating_strategy_version_id !== input.binding.operatingStrategyVersionId ||
        membership.operating_contract_fingerprint !== input.binding.contractFingerprint)
    ) {
      throw new Error('An existing strategy membership cannot be rebound to a different governed run or contract.')
    }
    if (membership) {
      membershipRecordedAt = membership.strategy_binding_recorded_at || membership.assigned_at || membershipRecordedAt
    } else {
      const inserted = await admin.from('strategy_lead_memberships').insert({
        lead_id: candidate.lead.id,
        campaign_run_id: run.id,
        strategy_key: input.lane.key,
        market: input.state.market,
        source_provider: input.state.source_provider,
        recipient_key: recipientKey,
        qualification_score: candidate.score,
        qualification_reasons: candidate.reasons,
        email_verification_status: verification.status,
        status: verification.hardInvalid ? 'rejected' : 'qualified',
        operating_strategy_id: input.binding.operatingStrategyId,
        operating_strategy_version_id: input.binding.operatingStrategyVersionId,
        strategy_identifier_namespace: input.binding.namespace,
        strategy_binding_mode: 'governed_v1',
        strategy_binding_recorded_at: membershipRecordedAt,
        strategy_writer_release: 'gate_3c',
        destination_mode_snapshot: input.binding.destinationMode,
        destination_path_snapshot: input.binding.destinationPath,
        cta_label_snapshot: input.binding.ctaLabel,
        operating_contract_fingerprint: input.binding.contractFingerprint,
        metadata_json: {
          reviewOnly: effectiveReviewOnly,
          matchedStrategyKeys: candidate.matchedStrategyKeys,
          hunterVerification: verification,
        },
      })
        .select(
          'id,lead_id,campaign_run_id,canonical_activity_id,operating_strategy_version_id,operating_contract_fingerprint,strategy_binding_recorded_at,assigned_at,metadata_json,status,qualification_score,qualification_reasons,email_verification_status,market,source_provider,recipient_key'
        )
        .single()
      if (inserted.error?.code === '23505') {
        const raced = await admin
          .from('strategy_lead_memberships')
          .select(
            'id,lead_id,campaign_run_id,canonical_activity_id,operating_strategy_version_id,operating_contract_fingerprint,strategy_binding_recorded_at,assigned_at,metadata_json,status,qualification_score,qualification_reasons,email_verification_status,market,source_provider,recipient_key'
          )
          .eq('lead_id', candidate.lead.id)
          .maybeSingle()
        if (raced.error) throw raced.error
        if (
          !raced.data ||
          raced.data.campaign_run_id !== run.id ||
          raced.data.operating_strategy_version_id !== input.binding.operatingStrategyVersionId ||
          raced.data.operating_contract_fingerprint !== input.binding.contractFingerprint
        ) {
          input.assigned.leadIds.add(candidate.lead.id)
          input.assigned.recipientKeys.add(recipientKey)
          continue
        }
        membership = raced.data
        membershipRecordedAt =
          raced.data.strategy_binding_recorded_at || raced.data.assigned_at || membershipRecordedAt
      } else {
        if (inserted.error) throw inserted.error
        membership = inserted.data
      }
    }
    if (!membership) throw new Error('Strategy membership creation returned no row.')
    const immutableMembershipMetadata = (membership.metadata_json || {}) as Record<string, unknown>
    const immutableQualificationReasons = Array.isArray(membership.qualification_reasons)
      ? membership.qualification_reasons
      : candidate.reasons
    const immutableMatchedStrategyKeys = Array.isArray(immutableMembershipMetadata.matchedStrategyKeys)
      ? immutableMembershipMetadata.matchedStrategyKeys
      : candidate.matchedStrategyKeys
    const immutableVerification =
      (immutableMembershipMetadata.hunterVerification as HunterEmailVerification | undefined) || verification
    const immutableReviewOnly =
      typeof immutableMembershipMetadata.reviewOnly === 'boolean'
        ? immutableMembershipMetadata.reviewOnly
        : effectiveReviewOnly

    let membershipActivityId = membership.canonical_activity_id as string | null
    if (!membershipActivityId) {
      membershipActivityId = await recordOperatingStrategyActivity({
        binding: input.binding,
        activityType: 'operator_review',
        activityNamespace: 'strategy_lead_membership',
        activityKey: membership.id,
        subjectNamespace: 'lead',
        subjectKey: candidate.lead.id,
        idempotencyKey: `strategy-membership:${input.binding.operatingStrategyVersionId}:${membership.id}`,
        occurredAt: membershipRecordedAt,
        strategyLeadMembershipId: membership.id,
        provenance: [
          {
            kind: 'strategy_qualification',
            sourceProvider: membership.source_provider || input.state.source_provider,
            market: membership.market || input.state.market,
            qualificationScore: membership.qualification_score ?? candidate.score,
            matchedStrategyKeys: immutableMatchedStrategyKeys,
          },
        ],
        metadata: {
          runId: run.id,
          qualificationReasons: immutableQualificationReasons,
          reviewOnly: immutableReviewOnly,
          emailVerificationStatus: membership.email_verification_status || immutableVerification.status,
        },
      })
      const membershipLink = await admin
        .from('strategy_lead_memberships')
        .update({ canonical_activity_id: membershipActivityId, updated_at: new Date().toISOString() })
        .eq('id', membership.id)
        .eq('operating_strategy_version_id', input.binding.operatingStrategyVersionId)
        .is('canonical_activity_id', null)
        .select('id')
      if (membershipLink.error) throw membershipLink.error
      if ((membershipLink.data || []).length !== 1) {
        const current = await admin
          .from('strategy_lead_memberships')
          .select('id')
          .eq('id', membership.id)
          .eq('canonical_activity_id', membershipActivityId)
          .maybeSingle()
        if (current.error) throw current.error
        if (!current.data) throw new Error('Canonical membership activity did not link exactly once.')
      }
    }

    if (verification.hardInvalid) {
      const existingMetadata = candidate.lead.metadata_json || {}
      await updateLeadRecord(candidate.lead.id, {
        email_valid: false,
        metadata_json: {
          ...existingMetadata,
          hunterEmailVerification: verification,
          hunterEmailVerifiedAt: new Date().toISOString(),
        },
      })
      input.assigned.leadIds.add(candidate.lead.id)
      input.assigned.recipientKeys.add(recipientKey)
      continue
    }

    const expectedGenerator = `strategy_engine:${input.lane.key}`
    const existingMessageQuery = await admin
      .from('outreach_messages')
      .select('*')
      .eq('lead_id', candidate.lead.id)
      .eq('channel', 'email')
      .maybeSingle()
    if (existingMessageQuery.error) throw existingMessageQuery.error
    let emailMessage = existingMessageQuery.data as OutreachMessageRecord | null
    if (
      emailMessage &&
      (emailMessage.generated_with !== expectedGenerator ||
        emailMessage.status === 'sent' ||
        Boolean(emailMessage.sent_at))
    ) {
      await admin
        .from('strategy_lead_memberships')
        .update({
          status: 'rejected',
          metadata_json: {
            ...immutableMembershipMetadata,
            reason: 'An existing email belongs to another generator or has already been sent.',
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', membership.id)
      input.assigned.leadIds.add(candidate.lead.id)
      input.assigned.recipientKeys.add(recipientKey)
      continue
    }
    if (emailMessage) {
      const existingActivities = await admin
        .from('operating_strategy_activities')
        .select('id,operating_strategy_version_id')
        .eq('activity_namespace', 'outreach_message_draft')
        .eq('activity_key', emailMessage.id)
        .limit(2)
      if (existingActivities.error) throw existingActivities.error
      if (
        (existingActivities.data || []).some(
          (activity) => activity.operating_strategy_version_id !== input.binding.operatingStrategyVersionId
        )
      ) {
        throw new Error('An existing outreach draft is already bound to another operating-strategy version.')
      }
    } else {
      const draft = buildStrategyEmailDraft(input.lane.key, candidate.lead)
      const messages = await saveOutreachMessages(candidate.lead.id, [
        {
          channel: 'email',
          subject: draft.subject,
          body: draft.body,
          cta: draft.cta,
          language: 'en',
          complianceNote: draft.complianceNote,
          generatedWith: expectedGenerator,
        },
      ])
      emailMessage = messages.find((message) => message.channel === 'email') || null
    }
    if (!emailMessage || emailMessage.status === 'sent' || emailMessage.sent_at) {
      await admin
        .from('strategy_lead_memberships')
        .update({ status: 'rejected', metadata_json: { reason: 'No unsent email draft was available.' } })
        .eq('id', membership.id)
      continue
    }

    const messageContentSha256 = fingerprintGovernedOutreachMessage(emailMessage)
    const messageActivityId = await recordOperatingStrategyActivity({
      binding: input.binding,
      activityType: 'message',
      activityNamespace: 'outreach_message_draft',
      activityKey: emailMessage.id,
      subjectNamespace: 'lead',
      subjectKey: candidate.lead.id,
      idempotencyKey: `strategy-message-draft:${input.binding.operatingStrategyVersionId}:${emailMessage.id}`,
      occurredAt: emailMessage.created_at || membershipRecordedAt,
      parentActivityId: membershipActivityId,
      strategyLeadMembershipId: membership.id,
      messageVersionKey: `${emailMessage.id}:strategy-engine:${input.lane.key}:${messageContentSha256}`,
      provenance: [
        {
          kind: 'strategy_execution_draft',
          runId: run.id,
          sourceProvider: input.state.source_provider,
          market: input.state.market,
        },
      ],
      metadata: {
        reviewOnly: immutableReviewOnly,
        deliveryAuthorized: false,
        receivingStrategyMustResolveBeforeDispatch: true,
        messageContentSha256,
      },
    })

    const existingFlags = candidate.lead.automation_flags_json || {}
    const existingMetadata = candidate.lead.metadata_json || {}
    await updateLeadRecord(candidate.lead.id, {
      ...(verification.approvalSafe ? { email_valid: true } : {}),
      lead_score: Math.min(100, Math.max(Number(candidate.lead.lead_score || 0), candidate.score)),
      niche: `strategy_${input.lane.key}`,
      market_segment: input.lane.key,
      outreach_angle: input.lane.label,
      automation_flags_json: {
        ...existingFlags,
        strategyEngine: {
          strategyKey: input.lane.key,
          market: input.state.market,
          sourceProvider: input.state.source_provider,
          campaignRunId: run.id,
          reviewOnly: effectiveReviewOnly,
          autoApprovalAllowed: input.deliveryAllowed && !effectiveReviewOnly && verification.approvalSafe,
          assignedAt: new Date().toISOString(),
        },
      },
      metadata_json: {
        ...existingMetadata,
        strategy: input.lane.key,
        strategyRunId: run.id,
        strategyQualificationScore: candidate.score,
        strategyQualificationReasons: candidate.reasons,
        strategyStackMatches: candidate.matchedStrategyKeys,
        hunterEmailVerification: verification,
        hunterEmailVerifiedAt: new Date().toISOString(),
      },
    })

    const { error: membershipUpdateError } = await admin
      .from('strategy_lead_memberships')
      .update({
        status: 'needs_review',
        metadata_json: {
          reviewOnly: immutableReviewOnly,
          outreachMessageId: emailMessage.id,
          canonicalMessageActivityId: messageActivityId,
          matchedStrategyKeys: immutableMatchedStrategyKeys,
          hunterVerification: immutableVerification,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', membership.id)
    if (membershipUpdateError) throw membershipUpdateError

    input.assigned.leadIds.add(candidate.lead.id)
    input.assigned.recipientKeys.add(recipientKey)
    draftsCreated += 1
    if (effectiveReviewOnly) reviewOnly += 1
  }

  const status = draftsCreated ? 'drafted' : 'awaiting_contacts'
  const message = draftsCreated
    ? `Created ${draftsCreated} lane-specific email draft(s); ${reviewOnly} require sensitive-case review.`
    : 'Candidates were already enrolled or had preserved sent messages; no new drafts were created.'
  const { data: runMemberships, error: runMembershipError } = await admin
    .from('strategy_lead_memberships')
    .select('status')
    .eq('campaign_run_id', run.id)
  if (runMembershipError) throw runMembershipError
  const aggregateDrafts = (runMemberships || []).filter(
    (membership) => !['qualified', 'rejected', 'failed'].includes(String(membership.status || ''))
  ).length

  const { error: runError } = await admin
    .from('command_center_strategy_runs')
    .update({
      status,
      lead_count: runMemberships?.length || 0,
      qualified_count: runMemberships?.length || 0,
      draft_count: aggregateDrafts,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata_json: {
        verifiedExecution: true,
        dryRun: false,
        selectedLeadIds: selected.map((candidate) => candidate.lead.id),
        draftsCreatedThisExecution: draftsCreated,
        aggregateDrafts,
        reviewOnly,
        message,
      },
    })
    .eq('id', run.id)
  if (runError) throw runError

  await updateMarketAfterRun(input.state, {
    qualified: candidates.length,
    drafted: draftsCreated,
    status,
    message,
  })

  return {
    runId: run.id,
    runKey: key,
    strategyKey: input.lane.key,
    strategyName: input.lane.label,
    market: input.state.market,
    sourceProvider: input.state.source_provider,
    status,
    discovered: candidates.length,
    qualified: candidates.length,
    draftsCreated,
    reviewOnly,
    message,
  }
}

async function loadOutcomeTotals() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('strategy_lead_memberships')
    .select('status')
    .is('operating_strategy_version_id', null)
    .limit(10000)
  if (error) throw error
  const statuses = (data || []).map((row) => String(row.status || ''))
  return {
    accepted: statuses.filter((status) => ['accepted', 'delivered', 'opened', 'clicked', 'replied'].includes(status)).length,
    delivered: statuses.filter((status) => ['delivered', 'opened', 'clicked', 'replied'].includes(status)).length,
    replies: statuses.filter((status) => status === 'replied').length,
  }
}

async function persistDailyReport(result: StrategyExecutionResult) {
  const admin = createAdminClient()
  const { data: runs, error: runsError } = await admin
    .from('command_center_strategy_runs')
    .select('id,strategy_key,strategy_name,status,source_provider,market,lead_count,qualified_count,draft_count,accepted_count,delivered_count,reply_count,bounce_count,created_at,completed_at')
    .like('run_key', `${result.report.date}:%`)
    .order('created_at', { ascending: false })
  if (runsError) throw runsError

  const cumulative = {
    ...result.report,
    status: (
      result.report.blockers.length ||
      result.report.status === 'blocked' ||
      (runs || []).some((run) => ['failed', 'source_blocked', 'quality_blocked'].includes(String(run.status || '')))
        ? (runs || []).some((run) =>
            Number(run.draft_count || 0) > 0 ||
            Number(run.qualified_count || 0) > 0 ||
            Number(run.accepted_count || 0) > 0 ||
            Number(run.delivered_count || 0) > 0
          )
          ? 'partial'
          : 'blocked'
        : (runs || []).some((run) => Number(run.accepted_count || 0) > 0 || Number(run.delivered_count || 0) > 0)
          ? 'completed'
          : (runs || []).some((run) => Number(run.draft_count || 0) > 0 || Number(run.qualified_count || 0) > 0)
            ? 'partial'
            : result.report.status
    ) as StrategyExecutionResult['report']['status'],
    citiesAttempted: new Set((runs || []).map((run) => String(run.market || '')).filter(Boolean)).size,
    sourcesAttempted: new Set((runs || []).map((run) => String(run.source_provider || '')).filter(Boolean)).size,
    leadsDiscovered: (runs || []).reduce((sum, run) => sum + Number(run.lead_count || 0), 0),
    leadsQualified: (runs || []).reduce((sum, run) => sum + Number(run.qualified_count || 0), 0),
    draftsCreated: (runs || []).reduce((sum, run) => sum + Number(run.draft_count || 0), 0),
    accepted: (runs || []).reduce((sum, run) => sum + Number(run.accepted_count || 0), 0),
    delivered: (runs || []).reduce((sum, run) => sum + Number(run.delivered_count || 0), 0),
    replies: (runs || []).reduce((sum, run) => sum + Number(run.reply_count || 0), 0),
  }
  const { error } = await admin.from('strategy_daily_reports').upsert(
    {
      report_date: cumulative.date,
      status: cumulative.status,
      cities_attempted: cumulative.citiesAttempted,
      sources_attempted: cumulative.sourcesAttempted,
      leads_discovered: cumulative.leadsDiscovered,
      leads_qualified: cumulative.leadsQualified,
      drafts_created: cumulative.draftsCreated,
      accepted_count: cumulative.accepted,
      delivered_count: cumulative.delivered,
      reply_count: cumulative.replies,
      report_json: {
        ...result,
        report: cumulative,
        laneRuns: (runs || []).map((run) => ({
          runId: run.id,
          strategyKey: run.strategy_key,
          strategyName: run.strategy_name,
          market: run.market,
          sourceProvider: run.source_provider,
          status: run.status,
          qualified: Number(run.qualified_count || 0),
          draftsCreated: Number(run.draft_count || 0),
          accepted: Number(run.accepted_count || 0),
          delivered: Number(run.delivered_count || 0),
          replies: Number(run.reply_count || 0),
        })),
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'report_date' }
  )
  if (error) throw error
  return cumulative
}

function escapeReportHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

async function sendStrategyExecutionReport(result: StrategyExecutionResult) {
  const recipient = (
    process.env.OPERATIONS_REPORT_EMAIL ||
    process.env.OUTREACH_ALERT_EMAIL ||
    process.env.ACQUISITIONS_ALERT_EMAIL ||
    'acquisitions@vestblock.io'
  ).trim()
  if (!recipient) return { ok: false, skipped: true, error: 'No strategy-report recipient is configured.' }

  const source = result.sourceSync
  const acquisition = result.sourceAcquisition
  const laneRows = result.laneRuns.length
    ? result.laneRuns.map((run) =>
        `<li><strong>${escapeReportHtml(run.strategyName)}</strong> in ${escapeReportHtml(run.market)}: ` +
        `${run.qualified} qualified, ${run.draftsCreated} drafts, status ${escapeReportHtml(run.status)}.</li>`
      ).join('')
    : '<li>No strategy lane was due in this execution.</li>'
  const blockers = result.report.blockers.length
    ? `<ul>${result.report.blockers.map((blocker) => `<li>${escapeReportHtml(blocker)}</li>`).join('')}</ul>`
    : '<p>None.</p>'

  return sendEmail({
    to: recipient,
    subject: `VestBlock strategy run: ${result.report.status} - ${result.report.date}`,
    eventType: 'admin_lead_run_daily_report',
    html: `
      <h2>Strategy execution report</h2>
      <p><strong>Mode:</strong> ${result.dryRun ? 'dry run' : 'live draft-and-queue execution'}</p>
      <p><strong>Actual outcomes recorded:</strong> ${result.report.accepted} accepted, ${result.report.delivered} delivered, ${result.report.replies} replies.</p>
      <p><strong>This execution:</strong> ${result.report.leadsQualified} qualified and ${result.report.draftsCreated} drafts. Draft creation is not counted as a send.</p>
      <p><strong>Freshness guard:</strong> ${result.staleCandidateLeadsExcluded} old source record(s) were held out of new first-contact runs.</p>
      <p><strong>Provenance guard:</strong> ${result.unprovenCandidateLeadsExcluded} generic/unproven lead(s) and ${result.strategyContractMismatchExcluded} source-contract mismatch(es) were blocked from strategy automation.</p>
      <h3>Independent source progression</h3>
      <p>Property intelligence reviewed ${acquisition.propertiesSeen} record(s), found ${acquisition.candidatesStacked} contract-qualified stack(s), promoted ${acquisition.leadsPromoted} verified business-contact lead(s), and held ${acquisition.contactEnrichmentRequired} record(s) for compliant contact enrichment or mail/manual review.</p>
      <h3>DealMachine native API progression</h3>
      <p>Strategy cursor ${source.startAfter} to ${source.nextAfter}; ${source.fetched} owner/property records fetched, ${source.contactable} had usable contact data, ${source.contactless} had no usable API contact, ${source.mailReady} were mail-ready, and ${source.ingested} lead records were deduplicated into the CRM.</p>
      <h3>Delivery gate</h3>
      <p>Provider: ${escapeReportHtml(result.outboundReadiness.provider)}. Circuit: ${escapeReportHtml(result.deliveryCircuit.mode)}. Per-run cap: ${escapeReportHtml(result.deliveryCircuit.maxBatchSize ?? 'normal configured limit')}.</p>
      <p>Reply capture: ${result.replyCaptureReadiness.ready ? 'ready' : 'blocked'} for ${escapeReportHtml(result.replyCaptureReadiness.mailbox)}.</p>
      <h3>Lane results</h3>
      <ul>${laneRows}</ul>
      <h3>Blockers</h3>
      ${blockers}
    `,
  })
}

export async function runStrategyExecutionEngine(options: {
  dryRun?: boolean
  maxLaneRuns?: number
  syncDealMachine?: boolean
  sourceProviders?: StrategySourceProvider[]
} = {}): Promise<StrategyExecutionResult> {
  const dryRun = options.dryRun !== false
  const date = reportDate()
  const blockers: string[] = []
  const requestedSourceProviders = Array.from(new Set(
    options.sourceProviders?.length
      ? options.sourceProviders
      : (['homeharvest', 'public_records', 'property_intelligence'] as StrategySourceProvider[])
  ))
  const sourceProviderSet = new Set(requestedSourceProviders)
  const recoveredRuns = await recoverStaleStrategyRuns()
  let sourceAcquisition = emptySourceAcquisition(dryRun)
  if (sourceProviderSet.has('property_intelligence')) {
    try {
      sourceAcquisition = await runStrategySourceOrchestrator({
        dryRun,
        limit: envInt('STRATEGY_SOURCE_ORCHESTRATOR_LIMIT', 1000),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      sourceAcquisition = emptySourceAcquisition(dryRun, `Property-intelligence orchestration failed: ${message}`)
    }
  }
  blockers.push(...sourceAcquisition.blockers)

  const dealMachineRequested = Boolean(
    sourceProviderSet.has('dealmachine') &&
      (options.syncDealMachine ?? /^(1|true|yes|on)$/i.test(String(process.env.DEALMACHINE_SOURCE_ENABLED || '')))
  )
  // Provider discovery is deliberately detached from strategy execution. The
  // DealMachine pipeline may append raw observations and operator-review tasks,
  // but this engine cannot spend credits, create provider data, or turn a raw
  // observation into a customer-facing strategy run.
  const sourceSyncSkipped = true
  const sourceSync: Awaited<ReturnType<typeof syncDealMachineLeadSource>> = {
    configured: Boolean(process.env.DEALMACHINE_API_KEY),
    ok: !dealMachineRequested,
    blockedReason: dealMachineRequested
      ? 'DealMachine acquisition is isolated from strategy execution. Use the governed discovery surface and operator review queue.'
      : null,
    fetched: 0,
    contactable: 0,
    contactless: 0,
    mailReady: 0,
    ingested: 0,
    startAfter: 0,
    nextAfter: 0,
    wrapped: false,
    creditsReserved: 0,
    strategyRuns: [],
    leads: [],
  }
  if (sourceSync.blockedReason) blockers.push(sourceSync.blockedReason)

  const leads = (await loadSellerCandidates(envInt('STRATEGY_ENGINE_CANDIDATE_LIMIT', 5000)))
    .filter((lead) => {
      const provider = strategySourceProviderForLead(lead)
      return provider ? sourceProviderSet.has(provider) : true
    })
  const providerReadiness = getOutboundProviderReadiness()
  const replyCaptureReadiness = getReplyCaptureReadiness()
  const outboundProvider: StrategyExecutionResult['outboundReadiness']['provider'] =
    providerReadiness.defaultProvider === 'gmail'
      ? 'gmail'
      : providerReadiness.defaultProvider === 'resend'
        ? 'resend'
        : 'none'
  const [assigned, previouslyContactedLeadIds, deliveryEvidence] = await Promise.all([
    loadAssignedContacts(),
    loadPreviouslyContactedLeadIds(),
    getDeliveryCircuitBreaker({
      provider: outboundProvider,
      allowControlledTrial: true,
    }),
  ])
  const outboundReadiness: StrategyExecutionResult['outboundReadiness'] = {
    provider: outboundProvider,
    configured: outboundProvider !== 'none',
    ready: outboundProvider !== 'none' && providerReadiness.mailingAddressConfigured,
    reason: outboundProvider === 'none'
      ? 'No Google Workspace or Resend sender is configured for the guarded outreach queue.'
      : !providerReadiness.mailingAddressConfigured
        ? 'The business mailing address required for compliant outreach is not configured.'
        : null,
  }
  if (!deliveryEvidence.allowed) {
    blockers.push(`Delivery circuit is ${deliveryEvidence.mode}: ${deliveryEvidence.reason || 'provider evidence is not ready'}.`)
  }
  if (outboundReadiness.reason) blockers.push(outboundReadiness.reason)
  if (!replyCaptureReadiness.ready && replyCaptureReadiness.reason) blockers.push(replyCaptureReadiness.reason)
  const candidatePools = buildCandidatePools(leads, assigned, previouslyContactedLeadIds)
  const pools = candidatePools.pools
  const marketsSeeded = await seedMarketStates(pools, sourceProviderSet)
  const states = (await loadMarketStates())
    .filter((state) => sourceProviderSet.has(state.source_provider))
  const targets = chooseTargets(states, pools, options.maxLaneRuns || envInt('STRATEGY_ENGINE_LANES_PER_RUN', 6))
  const laneRuns: LaneRunResult[] = []

  for (const state of targets) {
    const lane = STRATEGY_EXECUTION_LANES.find((item) => item.key === state.strategy_key)
    if (!lane) continue
    const pool = pools.get(poolKey(lane.key, state.market, state.source_provider)) || []
    let binding: OperatingStrategyBinding
    try {
      binding = await resolveOperatingStrategyBinding({
        namespace: 'seller_execution',
        sourceIdentifier: lane.key,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      blockers.push(`Strategy ${lane.key} is governance-blocked: ${message}`)
      laneRuns.push({
        runId: null,
        runKey: `${date}:${lane.key}:governance-blocked`,
        strategyKey: lane.key,
        strategyName: lane.label,
        market: state.market,
        sourceProvider: state.source_provider,
        status: 'governance_blocked',
        discovered: pool.length,
        qualified: 0,
        draftsCreated: 0,
        reviewOnly: 0,
        message: 'No active, approved operating-strategy version authorizes this lane.',
      })
      continue
    }
    laneRuns.push(await executeLane({
      date,
      state,
      lane,
      pool,
      assigned,
      dryRun,
      deliveryAllowed: deliveryEvidence.allowed && outboundReadiness.ready && replyCaptureReadiness.ready,
      binding,
    }))
  }

  const outcomes = await loadOutcomeTotals()
  const leadsDiscovered = laneRuns.reduce((sum, run) => sum + run.discovered, 0)
  const leadsQualified = laneRuns.reduce((sum, run) => sum + run.qualified, 0)
  const draftsCreated = laneRuns.reduce((sum, run) => sum + run.draftsCreated, 0)
  const runFailures = laneRuns.filter((run) => ['failed', 'source_blocked'].includes(run.status))
  const currentExecutionHasWork = draftsCreated > 0 || leadsQualified > 0
  const currentExecutionHasSourceInventory = sourceAcquisition.candidatesStacked > 0 || sourceSync.fetched > 0
  const currentExecutionHasContacts = sourceAcquisition.contactReady > 0 || candidatePools.provenanceEligibleLeads > 0
  const reportStatus: StrategyExecutionResult['report']['status'] =
    runFailures.length || blockers.length || !currentExecutionHasSourceInventory || !currentExecutionHasContacts
      ? currentExecutionHasWork
        ? 'partial'
        : 'blocked'
      : draftsCreated || outcomes.accepted || outcomes.delivered
        ? 'completed'
        : 'partial'
  const result: StrategyExecutionResult = {
    dryRun,
    generatedAt: new Date().toISOString(),
    sourceProviders: requestedSourceProviders,
    sourceSyncSkipped,
    recoveredRuns,
    deliveryCircuit: {
      allowed: deliveryEvidence.allowed,
      mode: deliveryEvidence.mode,
      provider: deliveryEvidence.provider,
      reason: deliveryEvidence.reason,
      maxBatchSize: deliveryEvidence.maxBatchSize,
      badRate: deliveryEvidence.badRate,
      threshold: deliveryEvidence.threshold,
      sampleSize: deliveryEvidence.sampleSize,
    },
    sourceSync,
    sourceAcquisition,
    outboundReadiness,
    replyCaptureReadiness,
    candidateLeads: candidatePools.provenanceEligibleLeads,
    contactHistoryExcluded: leads.filter((lead) => previouslyContactedLeadIds.has(lead.id)).length,
    staleCandidateLeadsExcluded: candidatePools.staleCandidateLeadsExcluded,
    unprovenCandidateLeadsExcluded: candidatePools.unprovenCandidateLeadsExcluded,
    strategyContractMismatchExcluded: candidatePools.strategyContractMismatchExcluded,
    unassignedLeads: leads.filter((lead) => {
      const recipientKey = String(lead.email || '').trim().toLowerCase()
      return (
        Boolean(getStrategyLeadProvenance(lead)) &&
        !previouslyContactedLeadIds.has(lead.id) &&
        !assigned.leadIds.has(lead.id) &&
        !assigned.recipientKeys.has(recipientKey)
      )
    }).length,
    marketsSeeded,
    laneRuns,
    report: {
      date,
      status: reportStatus,
      citiesAttempted: new Set(laneRuns.map((run) => run.market)).size,
      sourcesAttempted:
        new Set(laneRuns.filter((run) => run.discovered > 0).map((run) => run.sourceProvider)).size +
        (sourceSyncSkipped || sourceSync.fetched === 0 ? 0 : 1) +
        (sourceAcquisition.propertiesSeen > 0 ? 1 : 0),
      leadsDiscovered,
      leadsQualified,
      draftsCreated,
      accepted: outcomes.accepted,
      delivered: outcomes.delivered,
      replies: outcomes.replies,
      blockers,
    },
  }

  result.report = await persistDailyReport(result)
  if (!dryRun) await sendStrategyExecutionReport(result).catch(() => null)
  return result
}
