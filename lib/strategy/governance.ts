import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  PLATFORM_STRATEGY_LANES,
  type PlatformStrategyLaneKey,
} from '@/lib/strategy/registry'

export {
  OPERATING_STRATEGY_DEFINITIONS,
  OPERATING_STRATEGY_KEYS,
  PLATFORM_STRATEGY_LANES,
  PROPOSED_PLATFORM_STRATEGY_LANES,
  STRATEGY_IDENTIFIER_CROSSWALK,
} from '@/lib/strategy/registry'
export { OPERATING_STRATEGY_VERSION_CONTRACTS } from '@/lib/strategy/operating-contracts'
export type {
  OperatingStrategyKey,
  PlatformStrategyLaneKey,
  StrategyIdentifierNamespace,
} from '@/lib/strategy/registry'
export type {
  OperatingStrategyVersionContractDefinition,
  StrategyLifecycleContract as Gate3BStrategyLifecycleContract,
  StrategyOperatingContract as Gate3BStrategyOperatingContract,
  StrategyOutcomeContract as Gate3BStrategyOutcomeContract,
  StrategyOwnerContract as Gate3BStrategyOwnerContract,
} from '@/lib/strategy/operating-contracts'

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

export type OperatingStrategyContract = {
  objective: string
  targetParticipant: string
  problem: string
  valueExchange: string
  eligibilityCriteria: string[]
  disqualificationCriteria: string[]
  sourceData: string[]
  primaryChannels: string[]
  secondaryChannels: string[]
  followupCadence: string[]
  humanApprovalPoints: string[]
  complianceLimits: string[]
  learningInputs: string[]
  failureConditions: string[]
  stopRules: string[]
  handoffRules: string[]
  versionDecisionRule: Record<string, string>
}

export type StrategyLifecycleContract = {
  states: string[]
  initialState: string
  terminalStates: string[]
  transitions: Array<{ from: string; to: string; event: string }>
  cadence: string[]
  stopConditions: string[]
}

export type StrategyOutcomeContract = {
  primaryConversionEvent: string
  leadingIndicators: string[]
  businessValue: string
  learningInputs: string[]
  learningWindowDays: number
  minimumExposure: number
  attributionDimensions: string[]
  stopConditions: string[]
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

const OPERATING_CONTRACT_KEYS: Array<keyof OperatingStrategyContract> = [
  'objective',
  'targetParticipant',
  'problem',
  'valueExchange',
  'eligibilityCriteria',
  'disqualificationCriteria',
  'sourceData',
  'primaryChannels',
  'secondaryChannels',
  'followupCadence',
  'humanApprovalPoints',
  'complianceLimits',
  'learningInputs',
  'failureConditions',
  'stopRules',
  'handoffRules',
  'versionDecisionRule',
]

function requireObject(value: unknown, label: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`)
  return value as Record<string, unknown>
}

function requireNonEmptyArray(value: unknown, label: string) {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} must be a non-empty array.`)
}

export function validateOperatingStrategyContract(value: unknown): OperatingStrategyContract {
  const contract = requireObject(value, 'Operating strategy contract')
  for (const key of OPERATING_CONTRACT_KEYS) {
    if (contract[key] === undefined || contract[key] === null || contract[key] === '') {
      throw new Error(`Operating strategy contract is missing ${key}.`)
    }
  }
  for (const key of [
    'eligibilityCriteria',
    'disqualificationCriteria',
    'sourceData',
    'primaryChannels',
    'followupCadence',
    'humanApprovalPoints',
    'complianceLimits',
    'learningInputs',
    'failureConditions',
    'stopRules',
    'handoffRules',
  ] as const) {
    requireNonEmptyArray(contract[key], key)
  }
  requireObject(contract.versionDecisionRule, 'versionDecisionRule')
  return contract as OperatingStrategyContract
}

export function validateStrategyLifecycleContract(value: unknown): StrategyLifecycleContract {
  const contract = requireObject(value, 'Strategy lifecycle contract')
  requireNonEmptyArray(contract.states, 'lifecycle states')
  requireNonEmptyArray(contract.terminalStates, 'lifecycle terminalStates')
  requireNonEmptyArray(contract.transitions, 'lifecycle transitions')
  requireNonEmptyArray(contract.cadence, 'lifecycle cadence')
  requireNonEmptyArray(contract.stopConditions, 'lifecycle stopConditions')
  if (!contract.initialState || typeof contract.initialState !== 'string') {
    throw new Error('Strategy lifecycle contract needs an initialState.')
  }
  return contract as StrategyLifecycleContract
}

export function validateStrategyOutcomeContract(value: unknown): StrategyOutcomeContract {
  const contract = requireObject(value, 'Strategy outcome contract')
  for (const key of ['leadingIndicators', 'learningInputs', 'attributionDimensions', 'stopConditions'] as const) {
    requireNonEmptyArray(contract[key], `outcome ${key}`)
  }
  if (!contract.primaryConversionEvent || !contract.businessValue) {
    throw new Error('Strategy outcome contract needs a conversion event and business value.')
  }
  if (!Number.isInteger(contract.learningWindowDays) || Number(contract.learningWindowDays) < 1) {
    throw new Error('Strategy outcome learning window must be at least one day.')
  }
  if (!Number.isInteger(contract.minimumExposure) || Number(contract.minimumExposure) < 1) {
    throw new Error('Strategy outcome minimum exposure must be at least one.')
  }
  return contract as StrategyOutcomeContract
}

export async function getStrategyGovernanceSnapshot() {
  const admin = createAdminClient()
  const [portfolios, versions, operatingStrategies, crosswalk, proposals, evidence, outcomes] = await Promise.all([
    admin.from('strategy_portfolios').select('*').order('portfolio_key'),
    admin.from('strategy_lane_versions').select('*').eq('status', 'active').order('lane_key'),
    admin
      .from('operating_strategy_versions')
      .select('*,operating_strategies!inner(strategy_key,portfolio_key,title)')
      .in('status', ['draft', 'active'])
      .order('created_at'),
    admin
      .from('strategy_identifier_crosswalk')
      .select('source_namespace,source_identifier,identifier_kind,resolution_status,allows_new_activity,portfolio_key,operating_strategy_id,valid_from,valid_to')
      .order('source_namespace')
      .order('source_identifier'),
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
  for (const result of [portfolios, versions, operatingStrategies, crosswalk, proposals, evidence, outcomes]) {
    if (result.error) throw result.error
  }
  return {
    portfolios: portfolios.data || [],
    lanes: (versions.data || []) as StrategyLaneVersion[],
    operatingStrategies: operatingStrategies.data || [],
    identifierCrosswalk: crosswalk.data || [],
    proposals: proposals.data || [],
    evidence: evidence.data || [],
    outcomes: outcomes.data || [],
    generatedAt: new Date().toISOString(),
  }
}

export async function resolveOperatingStrategyIdentifier(input: {
  namespace: string
  sourceIdentifier: string
  asOf?: string
}) {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('resolve_operating_strategy_identifier', {
    p_source_namespace: input.namespace,
    p_source_identifier: input.sourceIdentifier,
    p_as_of: input.asOf || new Date().toISOString(),
  })
  if (error) throw error
  const rows = Array.isArray(data) ? data : data ? [data] : []
  if (rows.length !== 1) throw new Error('Strategy identifier did not resolve to exactly one active version.')
  return rows[0] as {
    portfolio_key: PlatformStrategyLaneKey
    strategy_key: string
    operating_strategy_id: string
    operating_strategy_version_id: string
    operating_strategy_version: number
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
  const applied = await admin.rpc('apply_strategy_lane_proposal', {
    p_proposal_id: input.id,
    p_actor_user_id: input.actorUserId,
  })
  if (applied.error) throw applied.error
  const row = (Array.isArray(applied.data) ? applied.data[0] : applied.data) as {
    proposal_json?: unknown
    version_json?: unknown
  } | null
  if (!row?.proposal_json || !row.version_json) {
    throw new Error('Atomic proposal application returned no result.')
  }
  return {
    proposal: row.proposal_json,
    version: row.version_json as StrategyLaneVersion,
  }
}
