import assert from "node:assert/strict"

import {
  buildOperatingLoopCards,
  type OperatingLoopKey,
  type StrategyCampaignRollup,
} from "../lib/admin/operatingLoopCore"

const campaigns: StrategyCampaignRollup[] = [
  {
    key: "on-market-lowball-agent-sweep",
    label: "On-market agent cash review",
    status: "green",
    sent: 100,
    failed: 2,
    drafted: 0,
    blocked: 0,
    replies: 3,
    optOuts: 1,
    lastEventAt: "2026-06-13T18:30:00.000Z",
    markets: [
      { market: "Macon, GA", count: 42 },
      { market: "Milwaukee, WI", count: 31 },
    ],
    latestArtifact: "stale-listing-results-test.json",
    nextMove: "Monitor replies before repeating volume.",
    learningSignal: "Replies visible.",
  },
  {
    key: "tax-code-stack",
    label: "Tax delinquent + code violation",
    status: "yellow",
    sent: 0,
    failed: 0,
    drafted: 50,
    blocked: 1,
    replies: 0,
    optOuts: 0,
    lastEventAt: "2026-06-13T17:00:00.000Z",
    markets: [
      { market: "Cleveland, OH", count: 20 },
      { market: "Toledo, OH", count: 15 },
    ],
    latestArtifact: "dealmachine-tax-code-stack-summary-test.json",
    nextMove: "Code-violation overlay source is missing.",
    learningSignal: "Blocked by source.",
  },
]

const loops = buildOperatingLoopCards({
  sentToday: 25,
  sent7d: 225,
  remainingToday: 75,
  replySignals7d: 4,
  emailReady: 60,
  needsReview: 12,
  campaigns,
  blockedSources: ["Tax delinquent + code violation: Code-violation overlay source is missing."],
  ledgerEventCount: 151,
  lastEventAt: "2026-06-13T18:30:00.000Z",
  followupsDue: 3,
  partnerFollowupsDue: 2,
  activeSuppressionCount: 18,
  missingSuppressionDb: false,
  bounceRiskLeads: 1,
  buyerDemandSignals: 9,
  pendingMatches: 6,
  partnerBuyBoxesConfirmed: 2,
  partnerResearchReady: 7,
  partnerOutreachReady: 5,
  partnerDiscoveryRuns7d: 3,
  failedPartnerRuns7d: 0,
  failedScrapes24h: 0,
  sourceFreshCount: 4,
  sourceStaleCount: 1,
  staleExportCount: 1,
  staleExportTotal: 5,
  activeDirectiveCount: 2,
  overdueTaskCount: 1,
  urgentTaskCount: 1,
  openTaskCount: 12,
  legacyDraftCount: 4,
  archivedLegacyRuntimeRows: 0,
  openResearchChecklistCount: 3,
  analyzerOutcomeCount: 1,
})

const expectedKeys: OperatingLoopKey[] = [
  "reply_to_revenue",
  "offer_follow_up",
  "lead_source_quality",
  "market_rotation",
  "offer_accuracy",
  "suppression_compliance",
  "buyer_demand",
  "agent_performance",
  "dead_code_dirty_system",
  "daily_war_room",
]

assert.equal(loops.length, 10, "Boss operating surface should expose exactly ten loops")
assert.deepEqual(
  loops.map((loop) => loop.key),
  expectedKeys,
  "Loop order should match the command-center operating cadence"
)

for (const loop of loops) {
  assert.ok(loop.title.endsWith("Loop"), `${loop.key} should have a loop title`)
  assert.ok(loop.summary.length > 20, `${loop.key} should have a useful summary`)
  assert.ok(loop.nextAction.length > 20, `${loop.key} should have a concrete next action`)
  assert.ok(["green", "yellow", "red"].includes(loop.status), `${loop.key} should use a command status`)
}

assert.equal(
  loops.find((loop) => loop.key === "reply_to_revenue")?.status,
  "green",
  "Replies should make the reply-to-revenue loop active"
)
assert.equal(
  loops.find((loop) => loop.key === "offer_follow_up")?.status,
  "yellow",
  "Due follow-ups should warn without becoming critical at low volume"
)
assert.equal(
  loops.find((loop) => loop.key === "lead_source_quality")?.status,
  "yellow",
  "A source blocker should keep source quality out of green"
)
assert.equal(
  loops.find((loop) => loop.key === "buyer_demand")?.status,
  "green",
  "Confirmed buy boxes should make buyer demand actionable"
)

console.log("operating-loops: ok")
