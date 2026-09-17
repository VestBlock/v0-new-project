import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { DealPipelineItemRecord } from '../lib/buyers/types'
import {
  DEAL_PIPELINE_STAGES,
  DealPipelineTransitionError,
  dealPipelineStageLabel,
  isDealPipelineStage,
  transitionDealPipelineItem,
  type DealPipelineStage,
  type DealPipelineTransitionRepository,
} from '../lib/deals/pipelineTransitions'

function record(
  overrides: Partial<DealPipelineItemRecord> = {}
): DealPipelineItemRecord {
  return {
    id: 'deal-1',
    property_analysis_run_id: 'analysis-1',
    buyer_packet_id: null,
    lead_id: 'lead-1',
    property_address: '123 Main St',
    city: 'Milwaukee',
    state: 'WI',
    zip_code: '53202',
    current_stage: 'analyzed',
    stage_label: 'Analyzed',
    priority: 'high',
    deal_grade: 'GOOD',
    deal_strength_score: 84,
    buyer_packet_sent_count: 0,
    buyer_reply_count: 0,
    estimated_assignment_fee: 18_000,
    expected_profit: 32_000,
    next_action: 'Review offer terms.',
    next_action_at: null,
    metadata_json: { source: 'property_analysis' },
    created_at: '2026-09-15T10:00:00.000Z',
    updated_at: '2026-09-15T10:00:00.000Z',
    ...overrides,
  }
}

function memoryRepository(initial: DealPipelineItemRecord | null) {
  let current = initial
  let capturedExpectedUpdatedAt: string | null = null

  const repository: DealPipelineTransitionRepository = {
    async findById(id) {
      return current?.id === id ? current : null
    },
    async updateIfUnchanged({ id, expectedUpdatedAt, update }) {
      capturedExpectedUpdatedAt = expectedUpdatedAt
      if (
        !current ||
        current.id !== id ||
        current.updated_at !== expectedUpdatedAt
      ) {
        return null
      }
      current = { ...current, ...update }
      return current
    },
  }

  return {
    repository,
    current: () => current,
    expectedUpdatedAt: () => capturedExpectedUpdatedAt,
    replace: (next: DealPipelineItemRecord) => {
      current = next
    },
  }
}

async function expectTransitionError(
  action: () => Promise<unknown>,
  status: number,
  message: RegExp
) {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof DealPipelineTransitionError)
    assert.equal(error.status, status)
    assert.match(error.message, message)
    return true
  })
}

async function main() {
assert.deepEqual(DEAL_PIPELINE_STAGES, [
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
])
assert.equal(isDealPipelineStage('offer_sent'), true)
assert.equal(isDealPipelineStage('under_contract'), true)
assert.equal(isDealPipelineStage('diligence_required'), false)
assert.equal(dealPipelineStageLabel('under_contract'), 'Under Contract')

await expectTransitionError(
  () =>
    transitionDealPipelineItem(memoryRepository(record()).repository, {
      itemId: 'deal-1',
      toStage: 'contract_pending' as DealPipelineStage,
      note: 'Reviewed.',
      actorUserId: 'admin-1',
    }),
  400,
  /Invalid deal pipeline stage/
)

const store = memoryRepository(record())
const result = await transitionDealPipelineItem(
  store.repository,
  {
    itemId: 'deal-1',
    toStage: 'offer_sent',
    note: 'Seller-approved offer was sent for review.',
    actorUserId: 'admin-1',
    nextAction: 'Follow up with the seller.',
    nextActionAt: '2026-09-17T15:00:00.000Z',
  },
  new Date('2026-09-16T14:30:00.000Z')
)

assert.equal(result.item.current_stage, 'offer_sent')
assert.equal(result.item.stage_label, 'Offer Sent')
assert.equal(result.item.next_action, 'Follow up with the seller.')
assert.equal(result.item.next_action_at, '2026-09-17T15:00:00.000Z')
assert.equal(store.expectedUpdatedAt(), '2026-09-15T10:00:00.000Z')
assert.deepEqual(result.transition, {
  from_stage: 'analyzed',
  to_stage: 'offer_sent',
  note: 'Seller-approved offer was sent for review.',
  actor_user_id: 'admin-1',
  changed_at: '2026-09-16T14:30:00.000Z',
  source: 'admin_api',
})
assert.equal(result.item.metadata_json.source, 'property_analysis')
assert.deepEqual(result.item.metadata_json.last_stage_transition, result.transition)
assert.deepEqual(result.item.metadata_json.stage_transitions, [result.transition])

const contractResult = await transitionDealPipelineItem(
  store.repository,
  {
    itemId: 'deal-1',
    toStage: 'under_contract',
    note: 'Executed purchase agreement reviewed by the operator.',
    actorUserId: 'admin-1',
  },
  new Date('2026-09-16T16:00:00.000Z')
)
assert.equal(contractResult.item.current_stage, 'under_contract')
assert.equal(contractResult.item.stage_label, 'Under Contract')
assert.equal(
  (contractResult.item.metadata_json.stage_transitions as unknown[]).length,
  2
)

await expectTransitionError(
  () =>
    transitionDealPipelineItem(store.repository, {
      itemId: 'deal-1',
      toStage: 'under_contract',
      note: 'No-op transition.',
      actorUserId: 'admin-1',
    }),
  409,
  /already in under_contract/
)

await expectTransitionError(
  () =>
    transitionDealPipelineItem(store.repository, {
      itemId: 'deal-1',
      toStage: 'closed_won',
      note: '   ',
      actorUserId: 'admin-1',
    }),
  400,
  /review note is required/
)

await expectTransitionError(
  () =>
    transitionDealPipelineItem(memoryRepository(null).repository, {
      itemId: 'missing',
      toStage: 'offer_sent',
      note: 'Reviewed.',
      actorUserId: 'admin-1',
    }),
  404,
  /not found/
)

const concurrentStore = memoryRepository(record())
const concurrentRepository: DealPipelineTransitionRepository = {
  async findById(id) {
    const existing = await concurrentStore.repository.findById(id)
    if (existing) {
      concurrentStore.replace({
        ...existing,
        updated_at: '2026-09-16T13:00:00.000Z',
      })
    }
    return existing
  },
  updateIfUnchanged: concurrentStore.repository.updateIfUnchanged,
}
await expectTransitionError(
  () =>
    transitionDealPipelineItem(concurrentRepository, {
      itemId: 'deal-1',
      toStage: 'offer_sent',
      note: 'Reviewed.',
      actorUserId: 'admin-1',
    }),
  409,
  /changed during review/
)

const routeSource = readFileSync(
  resolve(
    process.cwd(),
    'app/api/admin/deal-pipeline/[id]/stage/route.ts'
  ),
  'utf8'
)
assert.match(routeSource, /requireLeadAdmin\(request\)/)
assert.match(routeSource, /createSupabaseDealPipelineTransitionRepository\(admin\)/)
assert.match(routeSource, /eventType: 'admin_action'/)
assert.match(routeSource, /action: 'deal_pipeline_stage_changed'/)
assert.doesNotMatch(routeSource, /cron|automatic|autoAdvance/i)

console.log('deal-pipeline-transitions: ok')
}

void main()
