import fs from 'node:fs'
import path from 'node:path'

import { loadSentLedgerSummary } from '../lib/leads/outreach-v4/sent-ledger.mjs'

function getArgValue(name, fallback = '') {
  const prefix = `${name}=`
  const inline = process.argv.find((arg) => arg.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)
  const index = process.argv.indexOf(name)
  if (index >= 0 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--')) return process.argv[index + 1]
  return fallback
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function readOptionalJson(filePath) {
  if (!fs.existsSync(filePath)) return null
  return readJson(filePath)
}

function findLatestOutreachV4Run(baseDir) {
  if (!fs.existsSync(baseDir)) return null

  const candidates = fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}/.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left))

  for (const candidate of candidates) {
    const scorecardPath = path.join(baseDir, candidate, 'outreach-v4-scorecard.json')
    if (fs.existsSync(scorecardPath)) return candidate
  }

  return null
}

function normalizeScorecard(scorecard) {
  const targetSends = Number.parseInt(String(scorecard?.targetSends ?? ''), 10)
  const sentToday = Number.parseInt(String(scorecard?.sentToday ?? ''), 10)
  const readyToSend = Number.parseInt(String(scorecard?.readyToSend ?? ''), 10)

  if (![targetSends, sentToday, readyToSend].every(Number.isFinite)) {
    return { scorecard, changed: false }
  }

  const remainingSendSlots = Math.max(0, targetSends - sentToday)
  const readyGapToTarget = Math.max(0, targetSends - readyToSend)
  const next = {
    ...scorecard,
    remainingSendSlots,
    readyGapToTarget,
    targetGap: readyGapToTarget,
  }

  const changed =
    next.remainingSendSlots !== scorecard?.remainingSendSlots ||
    next.readyGapToTarget !== scorecard?.readyGapToTarget ||
    next.targetGap !== scorecard?.targetGap

  return { scorecard: next, changed }
}

function mergeApprovalState(scorecard, approvalSummary) {
  if (!approvalSummary || !scorecard) return { scorecard, changed: false }

  const approved = Number.parseInt(String(approvalSummary?.approved ?? ''), 10)
  const rejected = Number.parseInt(String(approvalSummary?.rejected ?? ''), 10)
  const reviewed = Number.parseInt(String(approvalSummary?.reviewed ?? ''), 10)
  const reviewedAt = approvalSummary?.reviewedAt || null
  const approvalComplete = Number.isFinite(reviewed) && Number.isFinite(approved) && reviewed === approved + rejected
  const readyToSend =
    approvalComplete && Number.isFinite(approved) ? Math.min(Number(scorecard?.readyToSend || 0), approved) : scorecard?.readyToSend

  const nextAction =
    approvalComplete && approved > 0
      ? Math.max(0, Number(scorecard?.targetSends || 0) - Number(readyToSend || 0)) > 0
        ? `Codex V4 approval is complete for ${approved} drafts; increase real-source markets/enrichment until the ready gap reaches 0 before any live-send decision.`
        : 'Codex V4 approval is complete; use the future V4 send-control script only after explicit live-send approval.'
      : scorecard.exactNextAction

  const next = {
    ...scorecard,
    readyToSend,
    readyGapToTarget: Math.max(0, Number(scorecard?.targetSends || 0) - Number(readyToSend || 0)),
    targetGap: Math.max(0, Number(scorecard?.targetSends || 0) - Number(readyToSend || 0)),
    approvalReviewed: Number.isFinite(reviewed) ? reviewed : scorecard?.approvalReviewed ?? null,
    approvedDrafts: Number.isFinite(approved) ? approved : scorecard?.approvedDrafts ?? null,
    rejectedDrafts: Number.isFinite(rejected) ? rejected : scorecard?.rejectedDrafts ?? null,
    approvalReviewedAt: reviewedAt,
    exactNextAction: nextAction,
  }

  const changed =
    next.approvalReviewed !== scorecard?.approvalReviewed ||
    next.approvedDrafts !== scorecard?.approvedDrafts ||
    next.rejectedDrafts !== scorecard?.rejectedDrafts ||
    next.approvalReviewedAt !== scorecard?.approvalReviewedAt ||
    next.exactNextAction !== scorecard?.exactNextAction

  return { scorecard: next, changed }
}

function mergeLedgerState(scorecard, ledgerSummary) {
  if (!scorecard || !ledgerSummary) return { scorecard, changed: false }

  const sentToday = Number.parseInt(String(ledgerSummary?.sentToday ?? ''), 10)
  if (!Number.isFinite(sentToday)) return { scorecard, changed: false }

  const readyToSend = Number.parseInt(String(scorecard?.readyToSend ?? ''), 10)
  const targetSends = Number.parseInt(String(scorecard?.targetSends ?? ''), 10)
  if (![readyToSend, targetSends].every(Number.isFinite)) return { scorecard, changed: false }

  const next = {
    ...scorecard,
    sentToday,
    remainingSendSlots: Math.max(0, targetSends - sentToday),
    readyGapToTarget: Math.max(0, targetSends - readyToSend),
    targetGap: Math.max(0, targetSends - readyToSend),
  }

  const changed =
    next.sentToday !== scorecard?.sentToday ||
    next.remainingSendSlots !== scorecard?.remainingSendSlots ||
    next.readyGapToTarget !== scorecard?.readyGapToTarget ||
    next.targetGap !== scorecard?.targetGap

  return { scorecard: next, changed }
}

async function main() {
  const requestedDate = getArgValue('--date', new Date().toISOString().slice(0, 10))
  const baseDir = path.join(process.cwd(), 'artifacts', 'outreach-v4')
  let date = requestedDate
  let scorecardPath = path.join(baseDir, date, 'outreach-v4-scorecard.json')

  if (!fs.existsSync(scorecardPath)) {
    const latestRun = findLatestOutreachV4Run(baseDir)
    if (!latestRun) {
      throw new Error(`No V4 scorecard found for ${requestedDate}. Run npm run outreach:v4-dry-run first.`)
    }
    date = latestRun
    scorecardPath = path.join(baseDir, date, 'outreach-v4-scorecard.json')
  }

  const approvalSummaryPath = path.join(baseDir, date, 'approval-summary.json')
  const loaded = readJson(scorecardPath)
  const normalized = normalizeScorecard(loaded)
  const withApproval = mergeApprovalState(normalized.scorecard, readOptionalJson(approvalSummaryPath))
  const withLedger = mergeLedgerState(withApproval.scorecard, loadSentLedgerSummary({ date }))
  const scorecard = {
    ...withLedger.scorecard,
    requestedDate,
    resolvedDate: date,
    usedLatestAvailableRun: date !== requestedDate,
  }
  if (normalized.changed || withApproval.changed || withLedger.changed) {
    fs.writeFileSync(scorecardPath, `${JSON.stringify(scorecard, null, 2)}\n`)
  }
  console.log(JSON.stringify(scorecard, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2))
  process.exit(1)
})
