process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: 'commonjs' })
process.env.DEALMACHINE_WEBHOOK_SECRET = 'test-secret'
require('ts-node/register')

const crypto = require('node:crypto')
const fs = require('node:fs')
const Module = require('module')
const path = require('path')

const originalResolveFilename = Module._resolveFilename
const originalLoad = Module._load
Module._load = function loadServerOnly(request, parent, isMain) {
  if (request === 'server-only') return {}
  return originalLoad.call(this, request, parent, isMain)
}
Module._resolveFilename = function resolveVestBlockAlias(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    return originalResolveFilename.call(this, path.join(process.cwd(), request.slice(2)), parent, isMain, options)
  }
  return originalResolveFilename.call(this, request, parent, isMain, options)
}

const {
  normalizeDealMachineWebhookPayload,
  verifyDealMachineWebhook,
} = require('../lib/dealmachine/webhooks.ts')
const { ingestDealMachineContactsCsv } = require('../lib/dealmachine/contactExport.ts')

const payload = {
  event_type: 'export.completed',
  event_id: 'evt_123',
  data: {
    list_name: 'VB preforeclosure-equity detroit-mi 2026-07-07',
    list_id: 'list_1',
    export_id: 'export_1',
    download_url: 'https://example.com/export.csv',
  },
}
const rawBody = JSON.stringify(payload)
const signature = crypto.createHmac('sha256', process.env.DEALMACHINE_WEBHOOK_SECRET).update(rawBody).digest('hex')

const verified = verifyDealMachineWebhook(rawBody, new Headers({ 'x-dealmachine-signature': signature }))
if (!verified.ok || !verified.verified) throw new Error('Expected webhook signature to verify.')

const invalid = verifyDealMachineWebhook(rawBody, new Headers({ 'x-dealmachine-signature': 'bad-signature' }))
if (invalid.ok) throw new Error('Expected invalid webhook signature to fail.')

const configuredSecret = process.env.DEALMACHINE_WEBHOOK_SECRET
delete process.env.DEALMACHINE_WEBHOOK_SECRET
const unsigned = verifyDealMachineWebhook(rawBody, new Headers())
process.env.DEALMACHINE_WEBHOOK_SECRET = configuredSecret
if (unsigned.ok) throw new Error('Expected a missing webhook secret to fail closed.')

const normalized = normalizeDealMachineWebhookPayload(payload)
if (normalized.eventType !== 'export.completed') throw new Error('Expected event type to normalize.')
if (normalized.listId !== 'list_1') throw new Error('Expected list id to normalize.')
if (normalized.exportId !== 'export_1') throw new Error('Expected export id to normalize.')
if (normalized.market !== 'detroit-mi') throw new Error(`Expected market detroit-mi, got ${normalized.market}.`)
if (normalized.strategyKey !== 'preforeclosure-equity') {
  throw new Error(`Expected strategy preforeclosure-equity, got ${normalized.strategyKey}.`)
}
if (normalized.downloadUrl !== 'https://example.com/export.csv') throw new Error('Expected download URL to normalize.')

const sampleCsv = fs.readFileSync(
  path.join(process.cwd(), 'data/dm-exports/milwaukee-wi-2026-06-14.csv'),
  'utf8'
)

ingestDealMachineContactsCsv({
  csvContent: sampleCsv,
  strategyKey: 'vacant-equity',
  market: 'milwaukee-wi',
  dryRun: true,
}).then((ingestion) => {
  if (ingestion.rows < 1) throw new Error('Expected real DealMachine CSV rows to parse.')
  if (ingestion.withEmail < 1) throw new Error('Expected real DealMachine emails to normalize.')

  console.log(JSON.stringify({
    verified: verified.verified,
    invalidRejected: !invalid.ok,
    unsignedRejected: !unsigned.ok,
    market: normalized.market,
    strategyKey: normalized.strategyKey,
    downloadUrl: normalized.downloadUrl,
    csvRows: ingestion.rows,
    contactsWithEmail: ingestion.withEmail,
    contactsWithPhone: ingestion.withPhone,
    rejectedRows: ingestion.rejected,
  }, null, 2))
}).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
