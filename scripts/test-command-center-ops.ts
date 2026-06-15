import assert from 'node:assert/strict'
import Module from 'node:module'
import path from 'node:path'

require.cache[require.resolve('server-only')] = {
  id: 'server-only',
  filename: 'server-only',
  loaded: true,
  exports: {},
} as NodeModule

const originalResolveFilename = (Module as any)._resolveFilename
;(Module as any)._resolveFilename = function resolveFilename(request: string, parent: unknown, isMain: boolean, options: unknown) {
  if (request.startsWith('@/')) {
    return originalResolveFilename.call(this, path.join(process.cwd(), request.slice(2)), parent, isMain, options)
  }
  return originalResolveFilename.call(this, request, parent, isMain, options)
}

const {
  buildForeclosureCommandSnapshot,
  buildForeclosureLeadRoute,
  buildOsintSourceBoard,
  buildBuyBoxGraphSnapshot,
  buildOutboundGovernanceSnapshot,
  buildOutcomeLearningSnapshot,
} = require('../lib/admin/commandCenter') as typeof import('../lib/admin/commandCenter')
const { configuredAdminEmails, isConfiguredAdminEmail } =
  require('../lib/auth/admin-emails') as typeof import('../lib/auth/admin-emails')

assert.ok(configuredAdminEmails().includes('contact@vestblock.io'))
assert.ok(isConfiguredAdminEmail('contact@vestblock.io'))
assert.ok(isConfiguredAdminEmail('acquisitions@vestblock.io'))
assert.ok(isConfiguredAdminEmail('vestblockio@gmail.com'))

const learning = buildOutcomeLearningSnapshot({
  replySignals7d: 2,
  commandCenterEvents: [
    {
      event_type: 'seller_reply_outcome',
      title: 'Qualified seller outcome logged',
      summary: '123 Main St moved to qualified.',
      source: 'lead_update',
      occurred_at: '2026-06-14T10:00:00.000Z',
      metadata_json: { status: 'qualified', propertyAddress: '123 Main St' },
    },
    {
      event_type: 'seller_reply_outcome',
      title: 'Seller suppression outcome logged',
      source: 'lead_update',
      occurred_at: '2026-06-14T09:00:00.000Z',
      metadata_json: { status: 'do_not_contact' },
    },
  ],
})

assert.equal(learning.status, 'green')
assert.equal(learning.totalEvents, 2)
assert.equal(learning.qualified, 1)
assert.equal(learning.doNotContact, 1)
assert.ok(learning.nextMove.includes('qualified'))

const blockedGovernor = buildOutboundGovernanceSnapshot({
  sender: 'contact@vestblock.io',
  dailyLimit: 500,
  sent24h: 120,
  remainingToday: 380,
  readyToSend: 75,
  needsReview: 10,
  replySignals7d: 0,
  bounceRiskLeads: 3,
  suppressionCount: 12,
  paidSourcesBlocked: 1,
  mailingAddressConfigured: true,
  autoSendEnabled: true,
  missingSuppressionDb: false,
})

assert.equal(blockedGovernor.status, 'yellow')
assert.ok(blockedGovernor.nextGate.includes('acquisitions@vestblock.io'))
assert.equal(blockedGovernor.checks.find((check) => check.label === 'Paid sources')?.status, 'green')

const graph = buildBuyBoxGraphSnapshot({
  propertyAnalysisRuns: [
    {
      id: 'analysis-1',
      property_address: '456 Walnut St',
      city: 'Toledo',
      state: 'OH',
      grade: 'GOOD',
      primary_route_label: 'Builder rehab path',
      repair_budget: 48000,
      created_at: '2026-06-14T11:00:00.000Z',
    },
    {
      id: 'analysis-2',
      property_address: '789 Oak St',
      city: 'Milwaukee',
      state: 'WI',
      grade: 'RISKY',
      primary_route_label: 'Subject-to creative route',
      created_at: '2026-06-14T10:00:00.000Z',
    },
  ],
  buyers: [{ id: 'buyer-1', contact_email: 'buyer@example.com' }],
  lenders: [{ id: 'lender-1', contact_email: 'lender@example.com' }],
  investorPipelineRows: [
    { investor: { id: 'builder-1', display_name: 'Builder Co' }, pipeline: { builderLane: true } },
    { investor: { id: 'creative-1', display_name: 'Creative Buyer', notes: 'subject-to and wrap buyer' }, pipeline: {} },
  ],
  pendingBuyerMatches: 1,
  pendingLenderMatches: 1,
})

assert.equal(graph.status, 'green')
assert.equal(graph.recentProperties[0]?.suggestedLane, 'Builder / developer')
assert.equal(graph.recentProperties[1]?.suggestedLane, 'Creative route')
assert.equal(graph.lanes.find((lane) => lane.key === 'creative')?.count, 1)

const foreclosureRoute = buildForeclosureLeadRoute({
  equityPercent: 45,
  daysToSale: 10,
  ownerOccupied: true,
  foreclosureFiled: true,
  taxDelinquent: true,
  codeViolation: true,
  vacant: true,
  buyerMatchCount: 2,
  lenderMatchCount: 1,
  rentalDemand: 7,
  arvSpread: 32000,
})

assert.equal(foreclosureRoute.urgency, 'urgent')
assert.ok(foreclosureRoute.buckets.includes('investor_buyer_match'))
assert.ok(foreclosureRoute.buckets.includes('attorney_housing_referral'))
assert.ok(foreclosureRoute.complianceFlags.some((flag) => flag.includes('Owner-occupant')))
assert.ok(foreclosureRoute.nextMove.includes('compliance review'))

const foreclosureSnapshot = buildForeclosureCommandSnapshot({
  buyerMatchesOpen: 2,
  lenderMatchesOpen: 1,
  freshDealMachineExports: 2,
})

assert.equal(foreclosureSnapshot.status, 'green')
assert.equal(foreclosureSnapshot.countySources.length, 5)
assert.equal(foreclosureSnapshot.exitBuckets.length, 10)
assert.ok(foreclosureSnapshot.starterPlays.some((play) => play.difficulty === 'easy'))
assert.ok(foreclosureSnapshot.guardrails.some((guardrail) => guardrail.includes('foreclosure-stop promises')))

const osintBoard = buildOsintSourceBoard({
  researchChecklists: [
    {
      city: 'Milwaukee',
      state: 'WI',
      outreach_status: 'ready',
      confidence_score: 76,
      contact_email: 'seller@example.com',
      recommended_lane: 'seller_fast_cash',
    },
    {
      city: 'Toledo',
      state: 'OH',
      outreach_status: 'needs_review',
      confidence_score: 52,
      recommended_lane: 'seller_creative',
    },
  ],
  dmExports: [{ file: 'milwaukee-wi-2026-06-14.csv', ageDays: 0 }],
  taxCodeStack: {
    latestRunAt: '2026-06-14T12:00:00.000Z',
    writtenRows: 42,
    totalOutputRows: 100,
    markets: [],
    sourceNeededCount: 0,
    latestSummaryFile: 'tax-code-summary.json',
    summary: 'test',
  },
  distressStackRows: 100,
  foreclosureCommand: foreclosureSnapshot,
})

assert.equal(osintBoard.status, 'green')
assert.equal(osintBoard.totals.checklists, 2)
assert.equal(osintBoard.totals.ready, 1)
assert.ok(osintBoard.sourceCards.find((card) => card.key === 'dealmachine-contacts')?.status === 'green')
assert.ok(osintBoard.marketSignals.find((market) => market.market === 'Milwaukee, WI')?.ready === 1)

console.log('command-center-ops: ok')
