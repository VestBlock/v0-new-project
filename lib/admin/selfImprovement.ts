import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import type { CommandCenterData } from '@/lib/admin/commandCenter'

/**
 * Self-improving agent — the Boss Agent's learning loop.
 *
 * How it learns (no invented data, plain before/after math):
 *   1. When a play is dispatched, a compact KPI snapshot is stored on each
 *      directive task (metadata_json.kpi_before).
 *   2. A retrospective looks at plays whose directives are all completed,
 *      compares the snapshot against current KPIs, and writes a lesson to
 *      the existing improvement_insights table (category 'boss_agent').
 *   3. Each lesson carries a score adjustment for that play. The Boss applies
 *      the net adjustment the next time it ranks plays — plays that move
 *      numbers rank higher, plays that don't decay.
 */

export type KpiSnapshot = {
  at: string
  replySignals7d: number
  outreach24h: number
  newLeads24h: number
  activePartners: number
  revenue30d: number
  openTasks: number
}

export type BossLesson = {
  playKey: string
  playName: string
  completedAt: string
  daysToComplete: number | null
  deltas: Partial<Record<keyof Omit<KpiSnapshot, 'at'>, number>>
  adjustment: number
  summary: string
}

export type BossLearningState = {
  weights: Record<string, number>
  lessons: BossLesson[]
}

// Which KPI movement counts as "the play worked", per play category
const PLAY_TARGET_KPI: Record<string, keyof Omit<KpiSnapshot, 'at'>> = {
  'daily-autonomous-strategy-lab': 'replySignals7d',
  'stale-listing-creative-finance': 'replySignals7d',
  'on-market-lowball-agent-sweep': 'replySignals7d',
  'fresh-city-dealmachine': 'newLeads24h',
  'tax-delinquent-code-violation-stack': 'replySignals7d',
  'reply-resurrection': 'replySignals7d',
  'buyer-depth-hot-markets': 'activePartners',
  'capital-desk-activation': 'revenue30d',
  'authority-city-push': 'newLeads24h',
  'ad-creative-sprint': 'newLeads24h',
  'distress-stack-refresh': 'newLeads24h',
  'partner-follow-up-sweep': 'activePartners',
  'renovation-spread-check': 'replySignals7d',
}

export const COMMAND_CENTER_SELF_IMPROVING_SYSTEM_PROMPT = [
  "You are VestBlock's embedded operating intelligence inside the Command Center, not a passive chatbot.",
  "Think like an owner-operator whose job is to make the business produce more qualified seller conversations, buyer/builder demand, lender routes, and closed assignment opportunities every day.",
  "Every day, choose one focus strategy and one challenger strategy from the live board: market, source, list stack, audience, offer angle, channel, and follow-up move.",
  "Use a closed learning loop: record the before KPI, state the hypothesis, execute or dispatch the safest next action, then compare reply signals, new leads, outreach volume, partner criteria, and revenue movement before keeping or decaying the play.",
  "Prefer concrete lead engines VestBlock can actually run: verified DealMachine native API records, tax-delinquent plus code-violation stacks, portfolio/out-of-state landlords, stale listings with creative terms, on-market agent cash-review sweeps, builder buy-box capture, buyer/lender matching, reply resurrection, and public-record distress stacks.",
  "When proposing challenger stacks, consider probate/estate plus vacancy or high equity, utility lien/water-shutoff plus absentee ownership, eviction/tired-landlord plus code violations, expired permit plus stale listing, and landlord portfolio plus tax delinquency. Only promote a challenger to live execution after a source, dedupe path, and compliance path are clear.",
  "Use acquisitions@vestblock.io for seller acquisition outreach, honor suppression/opt-out records, dedupe emails and properties, and avoid contact@vestblock.io for new seller campaigns unless the operator explicitly overrides it.",
  "Autonomy guardrails: you may recommend, draft, dispatch tasks, run safe dry-runs, and execute configured email sends within existing caps; you must not ignore opt-outs, target protected classes, send SMS without an approved SMS lane, send contracts, spend money, alter DNS/auth, or promise closings/funding/outcomes without explicit human approval.",
  "When asked what to do next, answer as the command center deciding the next move: concise, specific, metric-aware, and action-first.",
].join("\n")

const MAX_WEIGHT = 15
const MIN_WEIGHT = -15

export function captureKpiSnapshot(data: CommandCenterData): KpiSnapshot {
  return {
    at: new Date().toISOString(),
    replySignals7d: data.summary.replySignals7d,
    outreach24h: data.summary.outreach24h,
    newLeads24h: data.summary.newLeads24h,
    activePartners: data.summary.activePartners,
    revenue30d: data.summary.revenue30d,
    openTasks: data.summary.openTasks,
  }
}

type DirectiveTaskRow = {
  id: string
  status: string | null
  completed_at: string | null
  created_at: string | null
  metadata_json: Record<string, any> | null
}

/**
 * Load current play weights + recent lessons from improvement_insights.
 * Weights are the sum of per-lesson adjustments, clamped.
 */
export async function loadBossLearning(): Promise<BossLearningState> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('improvement_insights')
      .select('id,title,summary,supporting_data,created_at')
      .eq('category', 'boss_agent')
      .order('created_at', { ascending: false })
      .limit(60)

    if (error || !data) return { weights: {}, lessons: [] }

    const weights: Record<string, number> = {}
    const lessons: BossLesson[] = []

    for (const row of data) {
      const lesson = (row.supporting_data as Record<string, any> | null)?.lesson as BossLesson | undefined
      if (!lesson?.playKey) continue
      weights[lesson.playKey] = Math.max(
        MIN_WEIGHT,
        Math.min(MAX_WEIGHT, (weights[lesson.playKey] || 0) + Number(lesson.adjustment || 0))
      )
      if (lessons.length < 8) lessons.push(lesson)
    }

    return { weights, lessons }
  } catch {
    return { weights: {}, lessons: [] }
  }
}

/**
 * Run the retrospective: find boss plays whose directive tasks are all
 * completed and not yet reviewed, compare KPI snapshots, write lessons.
 */
export async function runBossRetrospective(current: CommandCenterData): Promise<{
  reviewed: number
  lessons: BossLesson[]
  message: string
}> {
  const admin = createAdminClient()

  const { data: tasks, error } = await admin
    .from('admin_tasks')
    .select('id,status,completed_at,created_at,metadata_json')
    .eq('task_type', 'boss_directive')
    .limit(400)

  if (error) {
    return { reviewed: 0, lessons: [], message: `Could not read directive tasks: ${error.message}` }
  }

  // Group by dispatch batch (play_key + dispatched_at)
  const batches = new Map<string, DirectiveTaskRow[]>()
  for (const task of (tasks || []) as DirectiveTaskRow[]) {
    const meta = task.metadata_json || {}
    if (!meta.play_key || !meta.dispatched_at) continue
    if (meta.retro_done) continue
    const key = `${meta.play_key}|${meta.dispatched_at}`
    const bucket = batches.get(key) || []
    bucket.push(task)
    batches.set(key, bucket)
  }

  const now = captureKpiSnapshot(current)
  const lessons: BossLesson[] = []
  const reviewedTaskIds: string[] = []

  for (const [key, batch] of batches) {
    const allDone = batch.every((task) => ['completed', 'dismissed'].includes(String(task.status || '').toLowerCase()))
    if (!allDone) continue

    const [playKey] = key.split('|')
    const meta = batch[0].metadata_json || {}
    const playName = String(meta.play_name || playKey)
    const before = meta.kpi_before as KpiSnapshot | undefined

    const completedTimes = batch
      .map((task) => Date.parse(task.completed_at || ''))
      .filter((time) => Number.isFinite(time))
    const completedAt = completedTimes.length ? new Date(Math.max(...completedTimes)).toISOString() : new Date().toISOString()
    const dispatchedTime = Date.parse(String(meta.dispatched_at))
    const daysToComplete = Number.isFinite(dispatchedTime)
      ? Math.round(((completedTimes.length ? Math.max(...completedTimes) : Date.now()) - dispatchedTime) / 864e5)
      : null

    // Compare snapshots where we have a baseline
    const deltas: BossLesson['deltas'] = {}
    if (before) {
      for (const metric of ['replySignals7d', 'outreach24h', 'newLeads24h', 'activePartners', 'revenue30d'] as const) {
        const delta = now[metric] - Number(before[metric] ?? 0)
        if (delta !== 0) deltas[metric] = delta
      }
    }

    const targetKpi = PLAY_TARGET_KPI[playKey] || 'replySignals7d'
    const targetDelta = deltas[targetKpi] ?? 0

    let adjustment = 0
    let summary = ''
    if (!before) {
      adjustment = 0
      summary = `${playName}: directives completed, but no KPI baseline was stored — neutral result recorded.`
    } else if (targetDelta > 0) {
      adjustment = Math.min(8, 3 + Math.round(targetDelta / 2))
      summary = `${playName}: completed in ${daysToComplete ?? '?'}d and ${targetKpi} moved +${targetDelta}. Boosting this play.`
    } else if ((daysToComplete ?? 0) > 10) {
      adjustment = -5
      summary = `${playName}: took ${daysToComplete}d to complete with no movement in ${targetKpi}. Deprioritizing.`
    } else {
      adjustment = -2
      summary = `${playName}: completed with no measurable movement in ${targetKpi} yet. Slight decay applied.`
    }

    const lesson: BossLesson = { playKey, playName, completedAt, daysToComplete, deltas, adjustment, summary }
    lessons.push(lesson)
    reviewedTaskIds.push(...batch.map((task) => task.id))

    // Persist the lesson to the existing improvement_insights table
    await admin.from('improvement_insights').insert({
      run_id: null,
      category: 'boss_agent',
      severity: adjustment >= 0 ? 'info' : 'warning',
      title: `Boss retrospective: ${playName}`,
      summary,
      supporting_data: { lesson },
      recommendation: adjustment >= 0 ? 'Keep this play in rotation.' : 'Review the play steps or directives before re-dispatching.',
      confidence: before ? 0.7 : 0.3,
      auto_applied: true,
    })
  }

  // Mark reviewed tasks so they are not re-scored
  for (const taskId of reviewedTaskIds) {
    const task = ((tasks || []) as DirectiveTaskRow[]).find((row) => row.id === taskId)
    await admin
      .from('admin_tasks')
      .update({ metadata_json: { ...(task?.metadata_json || {}), retro_done: true } })
      .eq('id', taskId)
  }

  return {
    reviewed: lessons.length,
    lessons,
    message: lessons.length
      ? `Reviewed ${lessons.length} completed play(s). Score adjustments applied to future rankings.`
      : 'No fully-completed, unreviewed boss plays found. Complete the dispatched directive tasks first.',
  }
}
