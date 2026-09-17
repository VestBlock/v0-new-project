import type { DealPipelineItemRecord } from '@/lib/buyers/types'

export type DealPipelineUpsertInput = {
  propertyAnalysisRunId?: string | null
  buyerPacketId?: string | null
  leadId?: string | null
  propertyAddress: string
  city?: string | null
  state?: string | null
  zipCode?: string | null
  currentStage?: DealPipelineItemRecord['current_stage']
  priority?: DealPipelineItemRecord['priority']
  dealGrade?: string | null
  dealStrengthScore?: number | null
  buyerPacketSentCount?: number
  buyerReplyCount?: number
  estimatedAssignmentFee?: number | null
  expectedProfit?: number | null
  nextAction?: string | null
  nextActionAt?: string | null
  metadata?: Record<string, unknown>
}

export type DealPipelineUpsertPayload = Omit<
  DealPipelineItemRecord,
  'id' | 'created_at'
>

const STAGE_ORDER: Record<DealPipelineItemRecord['current_stage'], number> = {
  new_lead: 0,
  contacted: 1,
  replied: 2,
  analyzed: 3,
  offer_sent: 4,
  under_contract: 5,
  buyer_packet_sent: 6,
  buyer_interested: 7,
  assignment_drafted: 8,
  closed_won: 9,
  closed_lost: 9,
  archived: 9,
}

const TERMINAL_STAGES = new Set<DealPipelineItemRecord['current_stage']>([
  'closed_won',
  'closed_lost',
  'archived',
])

const AUDIT_METADATA_KEYS = [
  'stage_transitions',
  'stage_transition_history',
  'last_stage_transition',
] as const

function stageLabel(stage: DealPipelineItemRecord['current_stage']) {
  return stage
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function objectMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {}
}

function mergeMetadata(
  existingValue: unknown,
  incomingValue: unknown
): Record<string, unknown> {
  const existing = objectMetadata(existingValue)
  const merged = { ...existing, ...objectMetadata(incomingValue) }

  // Routine projections may add packet facts, but they are not allowed to
  // rewrite the operator-authored stage audit ledger.
  for (const key of AUDIT_METADATA_KEYS) {
    if (Object.prototype.hasOwnProperty.call(existing, key)) {
      merged[key] = existing[key]
    }
  }

  return merged
}

function shouldPreserveExistingStage(
  existing: DealPipelineItemRecord['current_stage'],
  requested: DealPipelineItemRecord['current_stage']
) {
  return (
    TERMINAL_STAGES.has(existing) ||
    STAGE_ORDER[existing] > STAGE_ORDER[requested]
  )
}

export function buildDealPipelineUpsertPayload(
  input: DealPipelineUpsertInput,
  now = new Date(),
  existing: DealPipelineItemRecord | null = null
): DealPipelineUpsertPayload {
  const requestedStage = input.currentStage ?? 'analyzed'
  const preserveStage = existing
    ? shouldPreserveExistingStage(existing.current_stage, requestedStage)
    : false
  const currentStage = preserveStage
    ? existing!.current_stage
    : requestedStage

  return {
    property_analysis_run_id:
      input.propertyAnalysisRunId !== undefined
        ? input.propertyAnalysisRunId
        : existing?.property_analysis_run_id ?? null,
    buyer_packet_id:
      input.buyerPacketId !== undefined
        ? input.buyerPacketId
        : existing?.buyer_packet_id ?? null,
    lead_id:
      input.leadId !== undefined ? input.leadId : existing?.lead_id ?? null,
    property_address: input.propertyAddress,
    city: input.city !== undefined ? input.city : existing?.city ?? null,
    state: input.state !== undefined ? input.state : existing?.state ?? null,
    zip_code:
      input.zipCode !== undefined ? input.zipCode : existing?.zip_code ?? null,
    current_stage: currentStage,
    stage_label: preserveStage ? existing!.stage_label : stageLabel(currentStage),
    priority: input.priority ?? existing?.priority ?? 'normal',
    deal_grade:
      input.dealGrade !== undefined
        ? input.dealGrade
        : existing?.deal_grade ?? null,
    deal_strength_score:
      input.dealStrengthScore !== undefined
        ? input.dealStrengthScore
        : existing?.deal_strength_score ?? null,
    buyer_packet_sent_count:
      input.buyerPacketSentCount ?? existing?.buyer_packet_sent_count ?? 0,
    buyer_reply_count:
      input.buyerReplyCount ?? existing?.buyer_reply_count ?? 0,
    estimated_assignment_fee:
      input.estimatedAssignmentFee !== undefined
        ? input.estimatedAssignmentFee
        : existing?.estimated_assignment_fee ?? null,
    expected_profit:
      input.expectedProfit !== undefined
        ? input.expectedProfit
        : existing?.expected_profit ?? null,
    next_action: preserveStage
      ? existing!.next_action
      : input.nextAction !== undefined
        ? input.nextAction
        : existing?.next_action ?? null,
    next_action_at: preserveStage
      ? existing!.next_action_at
      : input.nextActionAt !== undefined
        ? input.nextActionAt
        : existing?.next_action_at ?? null,
    metadata_json: mergeMetadata(existing?.metadata_json, input.metadata),
    updated_at: now.toISOString(),
  }
}
