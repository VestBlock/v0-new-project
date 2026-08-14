import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

export const PLATFORM_STRATEGY_LANES = [
  'capital_funding',
  'real_estate_buyers_investors',
  'seller_property_acquisition',
  'lenders_capital_providers',
  'real_estate_professionals_providers',
  'business_buyers_sellers',
  'next_move_roadmaps',
  'dealvault_opportunities',
  'partnerships_referrals',
  'content_visibility',
] as const

export type PlatformStrategyLaneKey = (typeof PLATFORM_STRATEGY_LANES)[number]

export type StrategyContract = {
  objective: string
  targetCustomer: string
  qualificationCriteria: string[]
  approvedDataSources: string[]
  recommendedCustomerPath: string
  outreachMethods: string[]
  consentOrLawfulBasis: string[]
  exclusionsAndSuppressions: string[]
  primaryConversionEvent: string
  kpis: string[]
  costAndCapacityLimits: Record<string, unknown>
  failureConditions: string[]
  humanReviewRequirements: string[]
  experimentHypothesis: string
  learningWindowDays: number
  versionDecisionRule: Record<string, string>
}
export type StrategyLaneVersion = {
  id: string
  lane_key: PlatformStrategyLaneKey
  version: number
  title: string
  status: 'draft' | 'active' | 'retired'
  contract_json: StrategyContract
  source_provenance_json: Array<Record<string, unknown>>
  approved_at: string | null
  created_at: string
}

const REQUIRED_CONTRACT_KEYS: Array<keyof StrategyContract> = [
  'objective',
  'targetCustomer',
  'qualificationCriteria',
  'approvedDataSources',
  'recommendedCustomerPath',
  'outreachMethods',
  'consentOrLawfulBasis',
  'exclusionsAndSuppressions',
  'primaryConversionEvent',
  'kpis',
  'costAndCapacityLimits',
  'failureConditions',
  'humanReviewRequirements',
  'experimentHypothesis',
  'learningWindowDays',
  'versionDecisionRule',
]

export function validateStrategyContract(value: unknown): StrategyContract {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Strategy contract must be an object.')
  const contract = value as Record<string, unknown>
  for (const key of REQUIRED_CONTRACT_KEYS) {
    if (contract[key] === undefined || contract[key] === null || contract[key] === '') {
      throw new Error(`Strategy contract is missing ${key}.`)
    }
  }
  if (!Number.isInteger(contract.learningWindowDays) || Number(contract.learningWindowDays) < 1) {
    throw new Error('Strategy learning window must be at least one day.')
  }
  return contract as StrategyContract
}

export async function getStrategyGovernanceSnapshot() {
  const admin = createAdminClient()
  const [versions, proposals, evidence, outcomes] = await Promise.all([
    admin.from('strategy_lane_versions').select('*').eq('status', 'active').order('lane_key'),
    admin
      .from('strategy_updates')
      .select('id,category,target_type,target_key,risk_level,approval_status,title,rationale,proposed_change_json,requires_admin_review,created_at,updated_at')
      .eq('target_type', 'platform_strategy_lane')
      .in('approval_status', ['queued', 'approved'])
      .order('created_at', { ascending: false })
      .limit(30),
    admin
      .from('research_briefs')
      .select('id,theme,source_type,source_url,source_title,brief_title,summary,recommendations_json,priority,status,created_at')
      .order('created_at', { ascending: false })
      .limit(20),
    admin
      .from('strategy_lane_outcomes')
      .select('id,strategy_version_id,experiment_key,execution_mode,window_started_at,window_ended_at,metrics_json,sourced_facts_json,ai_inferences_json,learning,decision,reviewed_at,created_at')
      .order('created_at', { ascending: false })
      .limit(20),
  ])
  for (const result of [versions, proposals, evidence, outcomes]) {
    if (result.error) throw result.error
  }
  return {
    lanes: (versions.data || []) as StrategyLaneVersion[],
    proposals: proposals.data || [],
    evidence: evidence.data || [],
    outcomes: outcomes.data || [],
    generatedAt: new Date().toISOString(),
  }
}

export async function createStrategyProposal(input: {
  laneKey: PlatformStrategyLaneKey
  title: string
  rationale: string
  contractPatch: Record<string, unknown>
  sourcedFacts: Array<Record<string, unknown>>
  aiInferences: Array<Record<string, unknown>>
  riskLevel: 'low' | 'medium' | 'high'
}) {
  if (!PLATFORM_STRATEGY_LANES.includes(input.laneKey)) throw new Error('Unknown platform strategy lane.')
  if (!input.sourcedFacts.length) throw new Error('A strategy proposal needs at least one sourced fact with provenance.')
  const admin = createAdminClient()
  const { data, error } = await admin.from('strategy_updates').insert({
    run_id: null,
    category: 'platform_strategy',
    target_type: 'platform_strategy_lane',
    target_key: input.laneKey,
    risk_level: input.riskLevel,
    approval_status: 'queued',
    title: input.title,
    rationale: input.rationale,
    proposed_change_json: {
      contractPatch: input.contractPatch,
      sourcedFacts: input.sourcedFacts,
      aiInferences: input.aiInferences,
      proposedAt: new Date().toISOString(),
    },
    requires_admin_review: true,
  }).select('*').single()
  if (error) throw error
  return data
}

export async function decideStrategyProposal(input: {
  id: string
  action: 'approve' | 'reject' | 'apply'
  actorUserId: string
}) {
  const admin = createAdminClient()
  const { data: proposal, error } = await admin.from('strategy_updates').select('*').eq('id', input.id).single()
  if (error || !proposal) throw error || new Error('Strategy proposal not found.')
  if (proposal.target_type !== 'platform_strategy_lane') throw new Error('This is not a platform strategy proposal.')

  const now = new Date().toISOString()
  if (input.action === 'reject') {
    const result = await admin.from('strategy_updates').update({
      approval_status: 'rejected', approved_by_user_id: input.actorUserId, approved_at: now, updated_at: now,
    }).eq('id', input.id).in('approval_status', ['queued', 'approved']).select('*').single()
    if (result.error) throw result.error
    return { proposal: result.data, version: null }
  }
  if (input.action === 'approve') {
    const result = await admin.from('strategy_updates').update({
      approval_status: 'approved', approved_by_user_id: input.actorUserId, approved_at: now, updated_at: now,
    }).eq('id', input.id).eq('approval_status', 'queued').select('*').single()
    if (result.error) throw result.error
    return { proposal: result.data, version: null }
  }
  if (proposal.approval_status !== 'approved') throw new Error('Approve this material strategy change before applying it.')

  const { data: current, error: currentError } = await admin
    .from('strategy_lane_versions').select('*')
    .eq('lane_key', proposal.target_key).eq('status', 'active').single()
  if (currentError || !current) throw currentError || new Error('Active strategy version not found.')
  const change = (proposal.proposed_change_json || {}) as Record<string, unknown>
  const patch = (change.contractPatch || {}) as Record<string, unknown>
  const contract = validateStrategyContract({ ...(current.contract_json || {}), ...patch })
  const provenance = Array.isArray(change.sourcedFacts) ? change.sourcedFacts : []
  if (!provenance.length) throw new Error('Cannot apply a strategy change without sourced evidence.')

  const retire = await admin.from('strategy_lane_versions').update({ status: 'retired', updated_at: now })
    .eq('id', current.id).eq('status', 'active')
  if (retire.error) throw retire.error
  const inserted = await admin.from('strategy_lane_versions').insert({
    lane_key: current.lane_key,
    version: Number(current.version) + 1,
    title: current.title,
    status: 'active',
    contract_json: contract,
    source_provenance_json: provenance,
    approved_by_user_id: input.actorUserId,
    approved_at: now,
    supersedes_id: current.id,
  }).select('*').single()
  if (inserted.error) {
    await admin.from('strategy_lane_versions').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', current.id)
    throw inserted.error
  }
  const applied = await admin.from('strategy_updates').update({
    approval_status: 'auto_applied',
    applied_change_json: { strategyVersionId: inserted.data.id, version: inserted.data.version },
    applied_at: now,
    updated_at: now,
  }).eq('id', input.id).eq('approval_status', 'approved').select('*').single()
  if (applied.error) throw applied.error
  return { proposal: applied.data, version: inserted.data }
}
