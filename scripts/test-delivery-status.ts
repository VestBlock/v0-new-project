import assert from 'node:assert/strict'

import {
  countUniqueProviderAcceptedSends,
  isProviderAcceptedSendStatus,
} from '../lib/outreach/delivery-status'

assert.equal(isProviderAcceptedSendStatus('accepted'), true)
assert.equal(isProviderAcceptedSendStatus('sent'), true)
assert.equal(isProviderAcceptedSendStatus('delivered'), false)
assert.equal(isProviderAcceptedSendStatus('failed'), false)

assert.equal(
  countUniqueProviderAcceptedSends([
    { id: 'event-1', outreach_message_id: 'message-1', status: 'accepted' },
    { id: 'event-2', outreach_message_id: 'message-1', status: 'sent' },
    { id: 'event-3', outreach_message_id: 'message-2', status: 'accepted' },
    { id: 'event-4', outreach_message_id: 'message-3', status: 'delivered' },
    { id: 'event-5', outreach_message_id: 'message-4', status: 'failed' },
  ]),
  2
)

console.log('delivery status tests passed')
