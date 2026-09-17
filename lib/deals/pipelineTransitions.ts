import type { createAdminClient } from '@/lib/supabase/admin'
import type { DealPipelineItemRecord } from '@/lib/buyers/types'

export const DEAL_PIPELINE_STAGES = [
  'new_lead',
  'contacted',
  'replied',
  'analyzed',
  'offer_sent',
  'under_contract',
  'buyer_packet_sent',
  'buyer_interested',
  'assignment_drafted',
  'closed_won',
  'closed_lost',
  'archived',
] as const

export type DealPipelineStage = (typeof DEAL_PIPELINE_STAGES)[number]

export type DealPipelineStageTransition = {
  from_stage: DealPipelineStage
  to_stage: DealPipelineStage
  note: string
  actor_user_id: string
  changed_at: string
  source: 'admin_api'
}

export type DealPipelineTransitionInput = {
  itemId: string
  toStage: DealPipelineStage
  note: string
  actorUserId: string
  nextAction?: string | null
  nextActionAt?: string | null
}

export type DealPipelineTransitionResult = {
  item: DealPipelineItemRecord
  transition: DealPipelineStageTransition
}

export class DealPipelineTransitionError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 | 500
  ) {
    super(message)
    this.name = 'DealPipelineTransitionError'
  }
}

type DealPipelineUpdate = Pick<
  DealPipelineItemRecord,
  'current_stage' | 'stage_label' | 'metadata_json' | 'updated_at'
> &
  Partial<Pick<DealPipelineItemRecord, 'next_action' | 'next_action_at'>>

export type DealPipelineTransitionRepository = {
  findById(id: string): Promise<DealPipelineItemRecord | null>
  updateIfUnchanged(input: {
    id: string
    expectedUpdatedAt: string
    update: DealPipelineUpdate
  }): Promise<DealPipelineItemRecord | null>
}

type AdminClient = ReturnType<typeof createAdminClient>

const MAX_RECORDED_TRANSITIONS = 50

export function isDealPipelineStage(value: unknown): value is DealPipelineStage {
  return DEAL_PIPELINE_STAGES.includes(value as DealPipelineStage)
}

export function dealPipelineStageLabel(stage: DealPipelineStage) {
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

function recordedTransitions(metadata: Record<string, unknown>) {
  return Array.isArray(metadata.stage_transitions)
    ? metadata.stage_transitions.filter(
        (entry): entry is Record<string, unknown> =>
          Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry)
      )
    : []
}

export function createSupabaseDealPipelineTransitionRepository(
  admin: AdminClient
): DealPipelineTransitionRepository {
  return {
    async findById(id) {
      const { data, error } = await admin
        .from('deal_pipeline_items')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error) {
        throw new DealPipelineTransitionError(error.message, 500)
      }

      return (data as DealPipelineItemRecord | null) ?? null
    },

    async updateIfUnchanged({ id, expectedUpdatedAt, update }) {
      const { data, error } = await admin
        .from('deal_pipeline_items')
        .update(update)
        .eq('id', id)
        .eq('updated_at', expectedUpdatedAt)
        .select('*')
        .maybeSingle()

      if (error) {
        throw new DealPipelineTransitionError(error.message, 500)
      }

      return (data as DealPipelineItemRecord | null) ?? null
    },
  }
}

export async function transitionDealPipelineItem(
  repository: DealPipelineTransitionRepository,
  input: DealPipelineTransitionInput,
  now = new Date()
): Promise<DealPipelineTransitionResult> {
  if (!isDealPipelineStage(input.toStage)) {
    throw new DealPipelineTransitionError('Invalid deal pipeline stage.', 400)
  }

  const note = input.note.trim()
  if (!note) {
    throw new DealPipelineTransitionError(
      'A review note is required for every deal stage change.',
      400
    )
  }

  const existing = await repository.findById(input.itemId)
  if (!existing) {
    throw new DealPipelineTransitionError('Deal pipeline item not found.', 404)
  }

  if (!isDealPipelineStage(existing.current_stage)) {
    throw new DealPipelineTransitionError(
      `Deal pipeline item has an unsupported current stage: ${String(existing.current_stage)}.`,
      409
    )
  }

  if (existing.current_stage === input.toStage) {
    throw new DealPipelineTransitionError(
      `Deal pipeline item is already in ${input.toStage}.`,
      409
    )
  }

  const changedAt = now.toISOString()
  const transition: DealPipelineStageTransition = {
    from_stage: existing.current_stage,
    to_stage: input.toStage,
    note,
    actor_user_id: input.actorUserId,
    changed_at: changedAt,
    source: 'admin_api',
  }
  const metadata = objectMetadata(existing.metadata_json)
  const history = [...recordedTransitions(metadata), transition].slice(
    -MAX_RECORDED_TRANSITIONS
  )

  const update: DealPipelineUpdate = {
    current_stage: input.toStage,
    stage_label: dealPipelineStageLabel(input.toStage),
    metadata_json: {
      ...metadata,
      stage_transitions: history,
      last_stage_transition: transition,
    },
    updated_at: changedAt,
  }

  if (input.nextAction !== undefined) {
    update.next_action = input.nextAction
  }
  if (input.nextActionAt !== undefined) {
    update.next_action_at = input.nextActionAt
  }

  const updated = await repository.updateIfUnchanged({
    id: existing.id,
    expectedUpdatedAt: existing.updated_at,
    update,
  })

  if (!updated) {
    throw new DealPipelineTransitionError(
      'Deal pipeline item changed during review. Refresh it before trying again.',
      409
    )
  }

  return { item: updated, transition }
}
