import assert from 'node:assert/strict'

import { buildDatabaseDealMachineFreshness } from '../lib/admin/dealMachineFreshness'

const now = new Date('2026-07-20T12:00:00.000Z')
const snapshot = buildDatabaseDealMachineFreshness(
  [
    {
      provider: 'dealmachine',
      external_event_id: 'fresh-native-sync',
      event_type: 'scheduled_lead_sync',
      market: 'cleveland-oh',
      status: 'completed',
      rows_received: 50,
      rows_ingested: 42,
      occurred_at: '2026-07-19T12:00:00.000Z',
    },
    {
      provider: 'dealmachine',
      external_event_id: 'stale-native-sync',
      event_type: 'scheduled_lead_sync',
      market: 'memphis-tn',
      status: 'completed',
      rows_received: 30,
      rows_ingested: 20,
      occurred_at: '2026-07-01T12:00:00.000Z',
    },
    {
      provider: 'dealmachine',
      external_event_id: 'legacy-contact-export-needed:1',
      event_type: 'contact_export_needed',
      strategy_key: 'vacant-equity',
      market: 'detroit-mi',
      status: 'received',
      rows_received: 1,
      occurred_at: '2026-07-20T11:00:00.000Z',
    },
  ],
  now
)

assert.ok(snapshot)
assert.equal(snapshot.freshCount, 1)
assert.equal(snapshot.staleCount, 1)
assert.equal(snapshot.topStale[0]?.market, 'Memphis, TN')
assert.equal(snapshot.latestExportRequest, null)
assert.ok(snapshot.nextRefreshMarkets.includes('Memphis, TN'))
assert.match(snapshot.summary, /production database/i)
assert.match(snapshot.summary, /archived/i)

console.log('dealmachine-freshness: ok')
