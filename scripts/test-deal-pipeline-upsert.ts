import assert from 'node:assert/strict'

import type { DealPipelineItemRecord } from '../lib/buyers/types'
import { buildDealPipelineUpsertPayload } from '../lib/deals/pipelineUpsert'

const transition = {
  from_stage: 'buyer_packet_sent',
  to_stage: 'buyer_interested',
  note: 'Buyer confirmed price and timing.',
  actor_user_id: 'admin-1',
  changed_at: '2026-09-16T14:00:00.000Z',
  source: 'admin_api',
}

function record(
  currentStage: DealPipelineItemRecord['current_stage']
): DealPipelineItemRecord {
  return {
    id: `deal-${currentStage}`,
    property_analysis_run_id: 'analysis-1',
    buyer_packet_id: 'packet-1',
    lead_id: 'lead-1',
    property_address: '123 Main St',
    city: 'Milwaukee',
    state: 'WI',
    zip_code: '53202',
    current_stage: currentStage,
    stage_label: currentStage
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' '),
    priority: 'urgent',
    deal_grade: 'GOOD',
    deal_strength_score: 84,
    buyer_packet_sent_count: 1,
    buyer_reply_count: 1,
    estimated_assignment_fee: 18_000,
    expected_profit: 32_000,
    next_action: 'Complete the current operator-reviewed step.',
    next_action_at: '2026-09-17T15:00:00.000Z',
    metadata_json: {
      source: 'property_analysis',
      stage_transitions: [transition],
      stage_transition_history: [transition],
      last_stage_transition: transition,
    },
    created_at: '2026-09-15T10:00:00.000Z',
    updated_at: '2026-09-16T14:00:00.000Z',
  }
}

const routinePacketUpdate = {
  propertyAnalysisRunId: 'analysis-1',
  buyerPacketId: 'packet-1',
  leadId: 'lead-1',
  propertyAddress: '123 Main St',
  currentStage: 'buyer_packet_sent' as const,
  buyerPacketSentCount: 2,
  nextAction: 'Watch for buyer replies.',
  metadata: {
    packetStatus: 'accepted',
    sendResults: [{ status: 'accepted' }],
    stage_transitions: [],
    stage_transition_history: [],
    last_stage_transition: null,
  },
}

for (const stage of [
  'buyer_interested',
  'assignment_drafted',
  'closed_won',
] as const) {
  const existing = record(stage)
  const payload = buildDealPipelineUpsertPayload(
    routinePacketUpdate,
    new Date('2026-09-16T16:00:00.000Z'),
    existing
  )

  assert.equal(payload.current_stage, stage)
  assert.equal(payload.stage_label, existing.stage_label)
  assert.equal(payload.next_action, existing.next_action)
  assert.equal(payload.next_action_at, existing.next_action_at)
  assert.equal(payload.buyer_packet_sent_count, 2)
  assert.equal(payload.metadata_json.source, 'property_analysis')
  assert.equal(payload.metadata_json.packetStatus, 'accepted')
  assert.deepEqual(payload.metadata_json.stage_transitions, [transition])
  assert.deepEqual(payload.metadata_json.stage_transition_history, [transition])
  assert.deepEqual(payload.metadata_json.last_stage_transition, transition)
}

const analyzed = record('analyzed')
const advanced = buildDealPipelineUpsertPayload(
  routinePacketUpdate,
  new Date('2026-09-16T16:00:00.000Z'),
  analyzed
)
assert.equal(advanced.current_stage, 'buyer_packet_sent')
assert.equal(advanced.stage_label, 'Buyer Packet Sent')
assert.equal(advanced.next_action, 'Watch for buyer replies.')
assert.equal(advanced.metadata_json.source, 'property_analysis')
assert.equal(advanced.metadata_json.packetStatus, 'accepted')
assert.deepEqual(advanced.metadata_json.stage_transitions, [transition])

console.log('deal-pipeline-upsert: ok')
