import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_LATINO_MARKETS =
  'Chicago, IL|Milwaukee, WI|Houston, TX|Dallas, TX|Phoenix, AZ|Los Angeles, CA|San Antonio, TX|Miami, FL'
const DEFAULT_KIMI_INSTITUTIONAL =
  '/Users/mrsanders/Library/Mobile Documents/com~apple~CloudDocs/vestblock_hedge_fund_institutional_buyers.csv'
const DEFAULT_KIMI_WHOLESALE =
  '/Users/mrsanders/Library/Mobile Documents/com~apple~CloudDocs/vestblock_wholesale_buyers_4cities.csv'

function argValue(name, fallback = '') {
  const prefix = `${name}=`
  const inline = process.argv.filter((arg) => arg.startsWith(prefix)).at(-1)
  if (inline) return inline.slice(prefix.length)
  const index = process.argv.lastIndexOf(name)
  if (index >= 0 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--')) return process.argv[index + 1]
  return fallback
}

function hasFlag(name) {
  return process.argv.includes(name)
}

function intArg(name, fallback, cap) {
  const parsed = Number.parseInt(argValue(name, ''), 10)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Math.min(parsed, cap)
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return fallback
  }
}

function countCsvRows(filePath) {
  try {
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean)
    return Math.max(0, lines.length - 1)
  } catch {
    return 0
  }
}

function runStep(label, args, { allowFailure = false } = {}) {
  const startedAt = new Date().toISOString()
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'pipe',
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20,
  })
  const ok = result.status === 0
  const step = {
    label,
    ok,
    status: result.status ?? 1,
    startedAt,
    finishedAt: new Date().toISOString(),
    command: `${process.execPath} ${args.join(' ')}`,
    stdoutTail: String(result.stdout || '').slice(-6000),
    stderrTail: String(result.stderr || '').slice(-6000),
  }
  if (!ok && !allowFailure) {
    const error = new Error(`${label} failed with exit code ${step.status}`)
    error.step = step
    throw error
  }
  return step
}

function summarizeArtifacts(date, latinoDate, kimiRan) {
  const outreachDir = path.join(process.cwd(), 'artifacts', 'outreach-v4', date)
  const smallBusinessDir = path.join(process.cwd(), 'artifacts', 'offline-automation', 'small-business-leads', date)
  const latinoDir = path.join(process.cwd(), 'artifacts', 'offline-automation', 'latino-funding', latinoDate)
  const kimiDir = path.join(process.cwd(), 'artifacts', 'offline-automation', 'kimi-buyers', date)
  const sendsDir = path.join(process.cwd(), 'artifacts', 'offline-automation', 'outreach-sends', date)

  const v4Scorecard = readJson(path.join(outreachDir, 'outreach-v4-scorecard.json'), {})
  const approvalSummary = readJson(path.join(outreachDir, 'approval-summary.json'), {})
  const sendPreview = readJson(path.join(outreachDir, 'send-preview.json'), {})
  const smallBusinessSummary = readJson(path.join(smallBusinessDir, 'summary.json'), {})
  const latinoSummary = readJson(path.join(latinoDir, 'summary.json'), {})
  const kimiSummary = kimiRan ? readJson(path.join(kimiDir, 'summary.json'), {}) : null
  const discoveredBuyerPreview = readJson(path.join(sendsDir, 'buyer-discovered-send-preview.json'), {})
  const kimiBuyerPreview = readJson(path.join(sendsDir, 'kimi-buyers-send-preview.json'), {})

  return {
    outreachV4: {
      artifactDir: outreachDir,
      newLeadsScraped: v4Scorecard.newLeadsScraped || 0,
      newQualifiedLeads: v4Scorecard.newQualifiedLeads || 0,
      draftsGenerated: v4Scorecard.draftsGenerated || 0,
      readyToSend: v4Scorecard.readyToSend || 0,
      sentToday: v4Scorecard.sentToday || 0,
      readyGapToTarget: v4Scorecard.readyGapToTarget ?? null,
      bottleneck: v4Scorecard.bottleneck || '',
      approved: approvalSummary.approved || 0,
      previewSendable: Number.isFinite(sendPreview.sent) ? sendPreview.sent : sendPreview.sentRows?.length || 0,
      previewSkipped: Number.isFinite(sendPreview.skipped) ? sendPreview.skipped : sendPreview.skippedRows?.length || 0,
      skippedByReason: sendPreview.skippedByReason || {},
    },
    smallBusiness: {
      artifactDir: smallBusinessDir,
      markets: smallBusinessSummary.markets || [],
      placesFound: smallBusinessSummary.placesFound || 0,
      leadsAudited: smallBusinessSummary.leadsAudited || 0,
      directEmailReady: smallBusinessSummary.directEmailReady || countCsvRows(path.join(smallBusinessDir, 'direct-email-ready.csv')),
      roleEmailReview: smallBusinessSummary.roleEmailReview || countCsvRows(path.join(smallBusinessDir, 'role-email-review.csv')),
      contactFormOnly: smallBusinessSummary.contactFormOnly || countCsvRows(path.join(smallBusinessDir, 'contact-form-only.csv')),
    },
    latinoFunding: {
      artifactDir: latinoDir,
      markets: latinoSummary.markets || [],
      placesFound: latinoSummary.placesFound || 0,
      leadsAudited: latinoSummary.leadsAudited || 0,
      directEmailReady: latinoSummary.directEmailReady || countCsvRows(path.join(latinoDir, 'direct-email-ready.csv')),
      roleEmailReview: latinoSummary.roleEmailReview || countCsvRows(path.join(latinoDir, 'role-email-review.csv')),
      contactFormOnly: latinoSummary.contactFormOnly || countCsvRows(path.join(latinoDir, 'contact-form-only.csv')),
    },
    kimiBuyers: kimiSummary
      ? {
          artifactDir: kimiDir,
          uniqueBuyers: kimiSummary.uniqueBuyers || 0,
          draftReady: kimiSummary.draftReady || 0,
          draftsWritten: kimiSummary.draftsWritten || 0,
          targetHit: Boolean(kimiSummary.targetHit),
        }
      : {
          artifactDir: kimiDir,
          skipped: true,
          reason: 'kimi_csvs_not_present_or_not_requested',
        },
    discoveredBuyers: {
      draftsDir: path.join(process.cwd(), 'artifacts', 'offline-automation', 'outreach-drafts', date, 'buyers', 'discovered'),
      previewPath: path.join(sendsDir, 'buyer-discovered-send-preview.json'),
      previewSendable: discoveredBuyerPreview.sent || 0,
      previewSkipped: discoveredBuyerPreview.skipped || 0,
    },
    kimiBuyerPreview: {
      previewPath: path.join(sendsDir, 'kimi-buyers-send-preview.json'),
      previewSendable: kimiBuyerPreview.sent || 0,
      previewSkipped: kimiBuyerPreview.skipped || 0,
    },
  }
}

async function main() {
  if (hasFlag('--send') || hasFlag('--live-send')) {
    throw new Error('Daily offline orchestrator does not live-send. Run preview first, then use the explicit reviewed send command.')
  }

  const date = argValue('--date', new Date().toISOString().slice(0, 10))
  const target = intArg('--target', Number.parseInt(process.env.OUTREACH_V4_DAILY_TARGET || '75', 10), 100)
  const marketCount = intArg('--market-count', 8, 12)
  const websiteLimit = intArg('--website-limit', 96, 140)
  const queryLimit = intArg('--queries-per-vertical', 5, 10)
  const perQuery = intArg('--per-query', 4, 10)
  const v4PerMarketLimit = intArg('--v4-per-market-limit', 4, 8)
  const v4RealSourceLimit = intArg('--v4-real-source-limit', 10, 10)
  const v4RealSourceNiches = intArg('--v4-real-source-niches', 5, 5)
  const v4WebsiteAuditLimit = intArg('--v4-website-audit-limit', 25, 25)
  const v4EnrichmentLimit = intArg('--v4-enrichment-limit', 100, 100)
  const latinoDate = argValue('--latino-date', `${date}-latino-funding`)
  const runKimi = hasFlag('--include-kimi') || (fs.existsSync(DEFAULT_KIMI_INSTITUTIONAL) && fs.existsSync(DEFAULT_KIMI_WHOLESALE))
  const reportDir = path.join(process.cwd(), 'artifacts', 'offline-automation', 'daily-outreach', date)
  const steps = []

  fs.mkdirSync(reportDir, { recursive: true })

  steps.push(
    runStep('process-gmail-bounces', ['--env-file=.env.local', 'scripts/process-gmail-bounces.mjs', '--max=100', '--apply'], {
      allowFailure: true,
    })
  )

  steps.push(
    runStep('small-business-lead-builder', [
      '--env-file=.env.local',
      'scripts/offline-small-business-lead-builder.mjs',
      `--date=${date}`,
      '--verticals=ai_receptionist,funding_prep',
      `--market-count=${marketCount}`,
      `--queries-per-vertical=${queryLimit}`,
      `--per-query=${perQuery}`,
      `--website-limit=${websiteLimit}`,
    ])
  )

  steps.push(
    runStep('latino-funding-lead-builder', [
      '--env-file=.env.local',
      'scripts/offline-small-business-lead-builder.mjs',
      `--date=${latinoDate}`,
      '--verticals=spanish_funding',
      `--markets=${DEFAULT_LATINO_MARKETS}`,
      '--queries-per-vertical=6',
      '--per-query=4',
      `--website-limit=${websiteLimit}`,
    ])
  )

  steps.push(
    runStep('outreach-v4-expanded-dry-run', [
      '--env-file=.env.local',
      'scripts/outreach-v4-dry-run.mjs',
      `--date=${date}`,
      '--real-source',
      '--real-source-only',
      '--enrich-missing-email',
      '--real-source-verticals=real_estate_partners,contractors_home_services,ai_receptionist,no_website,weak_website',
      `--business-markets=${marketCount}`,
      '--distressed-markets=0',
      `--per-market-limit=${v4PerMarketLimit}`,
      `--real-source-limit=${v4RealSourceLimit}`,
      `--real-source-niches=${v4RealSourceNiches}`,
      `--website-audit-limit=${v4WebsiteAuditLimit}`,
      `--enrichment-limit=${v4EnrichmentLimit}`,
      `--target=${target}`,
      '--real-source-timeout-ms=55000',
      '--enrichment-timeout-ms=20000',
    ])
  )

  steps.push(
    runStep('outreach-v4-approve', [
      '--env-file=.env.local',
      'scripts/outreach-v4-approve-drafts.mjs',
      `--date=${date}`,
      `--limit=${target}`,
    ])
  )

  steps.push(
    runStep('outreach-v4-send-preview', [
      '--env-file=.env.local',
      'scripts/outreach-v4-send-approved.mjs',
      `--date=${date}`,
      '--limit=50',
      '--daily-cap=50',
    ])
  )

  const buyerLeadsDir = path.join(process.cwd(), 'artifacts', 'offline-automation', 'buyer-leads', date)
  if (fs.existsSync(path.join(buyerLeadsDir, 'direct-email-ready.csv'))) {
    steps.push(
      runStep('discovered-buyer-criteria-drafts', [
        'scripts/buyer-leads-to-criteria-drafts.mjs',
        `--date=${date}`,
        '--limit=25',
      ])
    )
    steps.push(
      runStep('discovered-buyer-send-preview', [
        '--env-file=.env.local',
        'scripts/send-buyer-criteria-drafts.mjs',
        `--date=${date}`,
        `--dir=${path.join(process.cwd(), 'artifacts', 'offline-automation', 'outreach-drafts', date, 'buyers', 'discovered')}`,
        '--lane=buyer_discovered',
        '--limit=25',
        '--daily-cap=50',
      ])
    )
  }

  if (runKimi) {
    steps.push(
      runStep('kimi-buyer-outreach-optional', [
        'scripts/kimi-buyer-outreach-pipeline.mjs',
        `--date=${date}`,
        '--daily-target=25',
        '--draft-limit=25',
      ])
    )
    steps.push(
      runStep('kimi-buyer-send-preview-optional', [
        '--env-file=.env.local',
        'scripts/send-buyer-criteria-drafts.mjs',
        `--date=${date}`,
        '--limit=25',
        '--daily-cap=50',
        '--lane=kimi_buyers',
      ])
    )
  }

  const artifactSummary = summarizeArtifacts(date, latinoDate, runKimi)
  const ok = steps.every((step) => step.ok)
  const liveSendCommand =
    artifactSummary.outreachV4.previewSendable > 0
      ? `npm run outreach:v4-send-approved:live -- --date=${date} --limit=${Math.min(50, artifactSummary.outreachV4.previewSendable)} --daily-cap=50`
      : ''
  const report = {
    ok,
    date,
    generatedAt: new Date().toISOString(),
    liveSendBlocked: true,
    target,
    steps,
    artifactSummary,
    nextActions: [
      artifactSummary.outreachV4.previewSendable > 0
        ? `Review preview, then live-send V4 with: ${liveSendCommand}`
        : 'No V4 preview-sendable rows. Increase markets/enrichment or inspect skippedByReason.',
      artifactSummary.kimiBuyers?.draftsWritten
        ? `Review optional Kimi buyer drafts, then send with: npm run buyers:kimi-send-approved -- --date=${date} --confirm-live-send=${date}`
        : 'Kimi buyer CSVs are optional; daily discovery does not depend on them.',
      'Use buyer-leads direct-email-ready/call-first outputs for call-first buyer criteria work.',
    ],
    liveSendCommand,
  }
  fs.writeFileSync(path.join(reportDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
  fs.writeFileSync(
    path.join(reportDir, 'report.md'),
    [
      `# VestBlock Daily Offline Outreach - ${date}`,
      '',
      `- V4 scraped: ${artifactSummary.outreachV4.newLeadsScraped}`,
      `- V4 qualified: ${artifactSummary.outreachV4.newQualifiedLeads}`,
      `- V4 approved: ${artifactSummary.outreachV4.approved}`,
      `- V4 preview-sendable: ${artifactSummary.outreachV4.previewSendable}`,
      `- Small-business direct-ready: ${artifactSummary.smallBusiness.directEmailReady}`,
      `- Latino funding direct-ready: ${artifactSummary.latinoFunding.directEmailReady}`,
      `- Discovered buyer preview-sendable: ${artifactSummary.discoveredBuyers.previewSendable}`,
      `- Optional Kimi drafts: ${artifactSummary.kimiBuyers.draftsWritten || 0}`,
      '',
      liveSendCommand ? `Reviewed live-send command: \`${liveSendCommand}\`` : 'No reviewed live-send command yet.',
      '',
      `Full JSON: ${path.join(reportDir, 'report.json')}`,
    ].join('\n')
  )

  console.log(JSON.stringify(report, null, 2))
  if (!ok) process.exit(1)
}

main().catch((error) => {
  const step = error?.step
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error), step }, null, 2))
  process.exit(1)
})
