/*
 * VestBlock Google Ads report-only monitor.
 * Paste into Google Ads Scripts, preview first, then schedule only after account review.
 * This script never mutates campaigns, budgets, ads, keywords, or targeting.
 */

var VESTBLOCK_ADS_RULES = {
  lookbackDays: 7,
  minimumSpendForZeroConversionAlert: 100,
  maximumCpl: 150,
  minimumClicksForCtrAlert: 50,
  minimumCtr: 0.01,
}

function toNumber(value) {
  var parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function analyzeCampaign(row, rules) {
  var cost = toNumber(row.metrics.costMicros) / 1000000
  var conversions = toNumber(row.metrics.conversions)
  var clicks = toNumber(row.metrics.clicks)
  var impressions = toNumber(row.metrics.impressions)
  var cpl = conversions > 0 ? cost / conversions : null
  var ctr = impressions > 0 ? clicks / impressions : null
  var alerts = []

  if (cost >= rules.minimumSpendForZeroConversionAlert && conversions === 0) {
    alerts.push('SPEND_WITHOUT_CONVERSION')
  }
  if (cpl !== null && cpl > rules.maximumCpl) alerts.push('CPL_ABOVE_GUARDRAIL')
  if (clicks >= rules.minimumClicksForCtrAlert && ctr !== null && ctr < rules.minimumCtr) {
    alerts.push('LOW_CTR')
  }

  return {
    campaignId: String(row.campaign.id),
    campaignName: String(row.campaign.name),
    status: String(row.campaign.status),
    cost: Number(cost.toFixed(2)),
    clicks: clicks,
    impressions: impressions,
    conversions: conversions,
    cpl: cpl === null ? null : Number(cpl.toFixed(2)),
    ctr: ctr === null ? null : Number(ctr.toFixed(4)),
    alerts: alerts,
    recommendedAction: alerts.length ? 'REVIEW' : 'MAINTAIN',
  }
}

function buildVestBlockAdsReport(adsApp, rules) {
  var query = [
    'SELECT campaign.id, campaign.name, campaign.status,',
    'metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions',
    'FROM campaign',
    'WHERE segments.date DURING LAST_7_DAYS',
    "AND campaign.status != 'REMOVED'",
  ].join(' ')
  var rows = adsApp.search(query)
  var campaigns = []
  while (rows.hasNext()) campaigns.push(analyzeCampaign(rows.next(), rules))
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: 'REPORT_ONLY',
    lookbackDays: rules.lookbackDays,
    campaignCount: campaigns.length,
    alertCount: campaigns.reduce(function (total, campaign) { return total + campaign.alerts.length }, 0),
    campaigns: campaigns,
  }
}

function main() {
  var report = buildVestBlockAdsReport(AdsApp, VESTBLOCK_ADS_RULES)
  Logger.log(JSON.stringify(report))
  return report
}

if (typeof module !== 'undefined') {
  module.exports = { VESTBLOCK_ADS_RULES: VESTBLOCK_ADS_RULES, analyzeCampaign: analyzeCampaign, buildVestBlockAdsReport: buildVestBlockAdsReport }
}
