import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const source = fs.readFileSync(new URL('./google-ads/vestblock-monitor.gs.js', import.meta.url), 'utf8')
const sandbox = { module: { exports: {} }, exports: {}, console, Date, Number, String, JSON }
vm.runInNewContext(source, sandbox, { filename: 'vestblock-monitor.gs.js' })
const { buildVestBlockAdsReport } = sandbox.module.exports

const fixtures = [
  {
    campaign: { id: 101, name: 'DSCR Education', status: 'ENABLED' },
    metrics: { costMicros: 184_000_000, clicks: 60, impressions: 12_000, conversions: 0 },
  },
  {
    campaign: { id: 102, name: 'Business Funding', status: 'ENABLED' },
    metrics: { costMicros: 120_000_000, clicks: 80, impressions: 4_000, conversions: 3 },
  },
]
let index = 0
const adsApp = {
  search(query) {
    assert.match(query, /LAST_7_DAYS/)
    assert.doesNotMatch(source, /\.pause\(|\.remove\(|setAmount\(|setStatus\(/)
    return {
      hasNext: () => index < fixtures.length,
      next: () => fixtures[index++],
    }
  },
}

const report = buildVestBlockAdsReport(adsApp, sandbox.VESTBLOCK_ADS_RULES)
assert.equal(report.mode, 'REPORT_ONLY')
assert.equal(report.campaignCount, 2)
assert.equal(report.campaigns[0].recommendedAction, 'REVIEW')
assert.ok(report.campaigns[0].alerts.includes('SPEND_WITHOUT_CONVERSION'))
assert.equal(report.campaigns[1].cpl, 40)
console.log('Google Ads report-only monitor passed its controlled fixture test; no account mutation API is present.')
