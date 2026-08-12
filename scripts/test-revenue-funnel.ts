import assert from 'node:assert/strict'

import { buildRevenueFunnelSnapshot } from '../lib/admin/revenueFunnel'

const now = new Date().toISOString()
const base = {
  leads: [
    { id: 'lead-1', created_at: now, updated_at: now, email: 'seller@ownerexample.com', email_valid: true, status: 'qualified', delivery_status: 'delivered' },
  ],
  outreachMessages: [
    { id: 'message-1', lead_id: 'lead-1', status: 'sent', created_at: now },
  ],
  outreachSendEvents: [
    { id: 'send-1', lead_id: 'lead-1', outreach_message_id: 'message-1', status: 'accepted', created_at: now },
    { id: 'send-2', lead_id: 'lead-1', outreach_message_id: 'message-1', status: 'delivered', created_at: now },
  ],
  buyerPackets: [
    { id: 'packet-1', status: 'accepted', created_at: now },
  ],
  buyerPacketSends: [
    { id: 'packet-send-1', buyer_packet_id: 'packet-1', status: 'replied', created_at: now },
  ],
  dealPipelineItems: [
    { id: 'deal-1', current_stage: 'closed_won', updated_at: now },
  ],
  mailboxReady: true,
  outboundReady: true,
}

const complete = buildRevenueFunnelSnapshot(base)
assert.equal(complete.status, 'green')
assert.equal(complete.stages.find((stage) => stage.key === 'accepted')?.count, 1)
assert.equal(complete.stages.find((stage) => stage.key === 'delivered')?.count, 1)
assert.equal(complete.stages.find((stage) => stage.key === 'closed')?.count, 1)

const missingDelivery = buildRevenueFunnelSnapshot({
  ...base,
  outreachSendEvents: [base.outreachSendEvents[0]],
  buyerPackets: [],
  buyerPacketSends: [],
  dealPipelineItems: [],
  mailboxReady: false,
})
assert.equal(missingDelivery.status, 'red')
assert.ok(missingDelivery.blockers.some((blocker) => blocker.key === 'delivery_evidence'))
assert.ok(missingDelivery.blockers.some((blocker) => blocker.key === 'reply_capture'))

console.log('revenue-funnel: ok')
