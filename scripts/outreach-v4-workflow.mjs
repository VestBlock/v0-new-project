import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

function runStep(label, args, { allowFailure = false } = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  })

  if (result.status !== 0 && !allowFailure) {
    throw new Error(`${label} failed with exit code ${result.status}`)
  }

  return {
    label,
    ok: result.status === 0,
    status: result.status ?? 1,
  }
}

function getArgValue(name, fallback = '') {
  const prefix = `${name}=`
  const inline = process.argv.find((arg) => arg.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)
  const index = process.argv.indexOf(name)
  if (index >= 0 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--')) return process.argv[index + 1]
  return fallback
}

const date = getArgValue('--date', new Date().toISOString().slice(0, 10))
const target = getArgValue('--target', process.env.OUTREACH_V4_DAILY_TARGET || '50')
const artifactDir = path.join(process.cwd(), 'artifacts', 'outreach-v4', date)

const results = []

const dryRunResult = runStep(
  'outreach-v4-dry-run',
  [
    '--env-file=.env.local',
    'scripts/outreach-v4-dry-run.mjs',
    `--date=${date}`,
    '--real-source',
    '--real-source-only',
    '--enrich-missing-email',
    '--real-source-verticals=real_estate_partners,contractors_home_services,ai_receptionist,no_website,weak_website',
    '--business-markets=8',
    '--distressed-markets=0',
    '--per-market-limit=4',
    '--real-source-limit=10',
    '--real-source-niches=5',
    '--website-audit-limit=25',
    '--enrichment-limit=100',
    `--target=${target}`,
    '--real-source-timeout-ms=55000',
    '--enrichment-timeout-ms=16000',
  ],
  { allowFailure: true }
)

results.push(dryRunResult)

results.push(
  runStep(
    'outreach-v4-approve',
    [
      '--env-file=.env.local',
      'scripts/outreach-v4-approve-drafts.mjs',
      `--date=${date}`,
      `--limit=${target}`,
    ],
    { allowFailure: !dryRunResult.ok }
  )
)

results.push(
  runStep(
    'outreach-v4-send-preview',
    [
      '--env-file=.env.local',
      'scripts/outreach-v4-send-approved.mjs',
      `--date=${date}`,
      '--limit=50',
      '--daily-cap=50',
    ],
    { allowFailure: !dryRunResult.ok }
  )
)

let scorecard = null
let approvalSummary = null
let sendPreview = null
try {
  scorecard = JSON.parse(fs.readFileSync(path.join(artifactDir, 'outreach-v4-scorecard.json'), 'utf8'))
} catch {}
try {
  approvalSummary = JSON.parse(fs.readFileSync(path.join(artifactDir, 'approval-summary.json'), 'utf8'))
} catch {}
try {
  sendPreview = JSON.parse(fs.readFileSync(path.join(artifactDir, 'send-preview.json'), 'utf8'))
} catch {}

const targetNumber = Number(target)
const previewSendable = Number(sendPreview?.sent || 0)
const approved = Number(approvalSummary?.approved || 0)
const targetHit = previewSendable >= targetNumber
const ok = results.every((result) => result.ok) && targetHit
process.stdout.write(
  `${JSON.stringify({
    ok,
    date,
    target: targetNumber,
    targetHit,
    approved,
    previewSendable,
    readyToSend: scorecard?.readyToSend || 0,
    readyGapToTarget: Math.max(0, targetNumber - previewSendable),
    bottleneck: scorecard?.bottleneck || '',
    results,
  })}\n`
)
if (!ok) process.exit(1)
