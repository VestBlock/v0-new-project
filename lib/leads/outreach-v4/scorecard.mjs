import { getDailyTargetSends } from './config.mjs'
import { countBy, normalizeEmail } from './utils.mjs'

export function buildOutreachV4Scorecard({ plan, scraped, accepted, quarantined, drafts, targetSends, sentEmails = new Set(), sentToday = 0 }) {
  const allLeads = scraped.flatMap((item) => item.leads)
  const dailyTarget = getDailyTargetSends(targetSends)
  const isAlreadySent = (row) => sentEmails.has(normalizeEmail(row?.lead?.email))
  const sendReady = accepted.filter(
    (row) => row.score.sendReady && row.lead.sourceType === 'real_provider_dry_run' && !isAlreadySent(row)
  )
  const sourceTypeKey = (value) => value || 'unknown_source_type'
  const acceptedBySourceType = countBy(accepted, (row) => sourceTypeKey(row.lead.sourceType))
  const quarantinedBySourceType = countBy(quarantined, (row) => sourceTypeKey(row.lead.sourceType))
  const sendReadyBySourceType = countBy(sendReady, (row) => sourceTypeKey(row.lead.sourceType))
  const draftsBySourceType = countBy(drafts, (draft) => sourceTypeKey(draft.sourceType))
  const sourcePerformance = [...accepted, ...quarantined]
    .reduce((map, row) => {
      const key = sourceTypeKey(row.lead.sourceType)
      const current = map.get(key) || { total: 0, accepted: 0, draftReady: 0, sendReady: 0 }
      current.total += 1
      if (accepted.includes(row)) {
        current.accepted += 1
        if (row.status === 'draft_ready') current.draftReady += 1
        if (row.score.sendReady && !isAlreadySent(row)) current.sendReady += 1
      }
      map.set(key, current)
      return map
    }, new Map())
  const sourcePerformanceRows = [...sourcePerformance.entries()]
    .map(([sourceType, summary]) => ({
      sourceType,
      ...summary,
      acceptanceRate: summary.total > 0 ? Number((summary.accepted / summary.total).toFixed(3)) : 0,
      draftReadyRate: summary.accepted > 0 ? Number((summary.draftReady / summary.accepted).toFixed(3)) : 0,
      sendReadyRate: summary.accepted > 0 ? Number((summary.sendReady / summary.accepted).toFixed(3)) : 0,
    }))
    .sort(
      (left, right) =>
        right.sendReady - left.sendReady ||
        right.draftReady - left.draftReady ||
        right.acceptanceRate - left.acceptanceRate ||
        right.accepted - left.accepted
    )
  const nonRealSourceAccepted = accepted.filter((row) => row.lead.sourceType !== 'real_provider_dry_run')
  const manualReview = quarantined.filter((row) =>
    ['manual_only_distressed_property', 'distressed_house_pipeline_never_auto_sends'].some((needle) =>
      `${row.quarantine?.reason || ''} ${row.score?.blockReason || ''}`.includes(needle)
    )
  )
  const distressed = allLeads.filter((lead) => lead.vertical === 'distressed_house')
  const partnerTargets = distressed.filter((lead) => lead.metadata?.outputBucket === 'real_estate_partner_targets')
  const propertyOpportunities = distressed.filter((lead) => lead.metadata?.outputBucket === 'distressed_property_opportunities')
  const readyToSend = sendReady.length
  const remainingSendSlots = Math.max(0, dailyTarget - sentToday)
  const readyGapToTarget = Math.max(0, dailyTarget - readyToSend)

  const bottleneck =
    readyToSend >= remainingSendSlots
      ? 'approval_required_before_live_send'
      : readyToSend === 0 && nonRealSourceAccepted.length > 0
        ? 'non_real_source_leads_not_sendable'
      : allLeads.length < dailyTarget
        ? 'dry_run_source_volume_below_target'
        : 'quality_gate_blocks_or_missing_verified_email'

  return {
    ok: true,
    version: 'v4',
    generatedAt: new Date().toISOString(),
    date: plan.date,
    targetSends: dailyTarget,
    sentToday,
    readyToSend,
    remainingSendSlots,
    readyGapToTarget,
    targetGap: readyGapToTarget,
    newLeadsScraped: allLeads.length,
    newQualifiedLeads: accepted.length,
    quarantinedCount: quarantined.length,
    draftsGenerated: drafts.length,
    citiesScraped: Array.from(new Set(allLeads.map((lead) => `${lead.city}, ${lead.state}`))).sort(),
    verticalMix: countBy(allLeads, (lead) => lead.vertical),
    acceptedByVertical: countBy(accepted, (row) => row.lead.vertical),
    acceptedBySourceType,
    quarantinedBySourceType,
    draftsBySourceType,
    sendReadyBySourceType,
    sourcePerformance: sourcePerformanceRows,
    skippedByReason: countBy(quarantined, (row) => row.quarantine?.reason || row.score?.blockReason || 'unknown'),
    distressedHouse: {
      opportunitiesFound: propertyOpportunities.length,
      manualReviewRequired: manualReview.length,
      realEstatePartnerTargetsFound: partnerTargets.length,
      automaticSendBlocked: true,
    },
    bestPerformingSource: sourcePerformanceRows[0]?.sourceType || 'no_source_data',
    bottleneck,
    closeToTargetQualityEmailsPerDay:
      readyToSend >= dailyTarget
        ? 'yes_after_approval_and_live_provider_checks'
        : `not_yet_${readyToSend}_send_ready_in_dry_run`,
    closeTo100QualityEmailsPerDay:
      readyToSend >= 100
        ? 'yes_after_approval_and_live_provider_checks'
        : `not_yet_${readyToSend}_send_ready_in_dry_run`,
    exactNextAction:
      readyToSend >= dailyTarget
        ? 'Run Codex V4 approval, then use the future V4 send-control script only after explicit live-send approval.'
        : readyToSend === 0 && nonRealSourceAccepted.length > 0
          ? 'Run the V4 real-source lanes with enrichment and keep sample-path leads review-only until real provider leads produce usable direct emails.'
        : readyToSend > 0
          ? `Run Codex V4 approval for the ${readyToSend} current drafts, then increase real-source markets/enrichment until the ready gap reaches 0 before live sending.`
          : 'Connect real source adapters and email verification to V4; dry-run architecture works but send-ready supply is not enough yet.',
  }
}
