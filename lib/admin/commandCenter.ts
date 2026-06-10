import 'server-only'

import fs from 'node:fs'
import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

export type CommandStatus = 'green' | 'yellow' | 'red'
export type AgentStatus = 'active' | 'attention' | 'idle'
export type AgentKey =
  | 'acquisition'
  | 'outreach'
  | 'routing'
  | 'underwriting'
  | 'authority'
  | 'qa'
  | 'operator'

export type AgentKpi = {
  label: string
  value: string | number
  helper?: string
  status?: CommandStatus
}

export type AgentFeedItem = {
  label: string
  detail: string
  at: string | null
}

export type AgentAction = {
  label: string
  href: string
}

export type AgentPanelData = {
  key: AgentKey
  name: string
  role: string
  status: AgentStatus
  statusReason: string
  kpis: AgentKpi[]
  feed: AgentFeedItem[]
  actions: AgentAction[]
}

export type CommandAlert = {
  severity: 'critical' | 'warning' | 'info'
  message: string
  href?: string
}

export type MarketHeatRow = {
  market: string
  leads: number
  contactable: number
  recent7d: number
  replied: number
  heat: number
}

export type ActivityItem = {
  at: string
  source: string
  message: string
}

export type MissionNode = {
  key: AgentKey
  label: string
  intensity: number
}

export type CommandCenterData = {
  generatedAt: string
  liveDataReachable: boolean
  dataSourceIssues: { source: string; message: string }[]
  summary: {
    revenue30d: number
    revenueTarget: number
    outreach24h: number
    outreachTarget: number
    newLeads24h: number
    replySignals7d: number
    openTasks: number
    urgentTasks: number
    activePartners: number
    paidFundingRequests: number
  }
  missionNodes: MissionNode[]
  priorities: string[]
  alerts: CommandAlert[]
  agents: AgentPanelData[]
  marketHeat: MarketHeatRow[]
  routingQueue: { label: string; count: number; href: string }[]
  activity: ActivityItem[]
  localSignals: {
    dmExports: { file: string; ageDays: number }[]
    distressStackRows: number | null
  }
}

type DataSourceIssue = { source: string; message: string }

type AnyRow = Record<string, any>

async function safeRows<T = AnyRow>(
  buildQuery: () => {
    range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message?: string } | null }>
  },
  label: string,
  issues: DataSourceIssue[],
  options: { pageSize?: number; maxRows?: number } = {}
): Promise<T[]> {
  const pageSize = options.pageSize ?? 1000
  const maxRows = options.maxRows ?? 5000
  const rows: T[] = []

  for (let from = 0; from < maxRows; from += pageSize) {
    const to = Math.min(from + pageSize - 1, maxRows - 1)
    try {
      const { data, error } = await buildQuery().range(from, to)
      if (error) {
        issues.push({ source: label, message: error.message || 'Query unavailable.' })
        return []
      }
      rows.push(...(data || []))
      if (!data || data.length < pageSize) break
    } catch (error) {
      issues.push({ source: label, message: error instanceof Error ? error.message : 'Query failed.' })
      return []
    }
  }

  return rows
}

function envInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function hoursSince(value?: string | null) {
  if (!value) return Number.POSITIVE_INFINITY
  const ts = Date.parse(value)
  if (Number.isNaN(ts)) return Number.POSITIVE_INFINITY
  return (Date.now() - ts) / 36e5
}

const withinHours = (value: string | null | undefined, hours: number) => hoursSince(value) <= hours
const withinDays = (value: string | null | undefined, days: number) => hoursSince(value) <= days * 24

const lower = (value?: string | null) => String(value || '').toLowerCase()

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

function timestampOf(row: AnyRow): string | null {
  return row.created_at || row.updated_at || row.sent_at || row.published_at || null
}

function loadLocalSignals() {
  const dmExports: { file: string; ageDays: number }[] = []
  let distressStackRows: number | null = null

  try {
    const dir = path.join(process.cwd(), 'data', 'dm-exports')
    if (fs.existsSync(dir)) {
      for (const name of fs.readdirSync(dir)) {
        if (!name.toLowerCase().endsWith('.csv')) continue
        const stat = fs.statSync(path.join(dir, name))
        dmExports.push({ file: name, ageDays: Math.floor((Date.now() - stat.mtimeMs) / 864e5) })
      }
      dmExports.sort((a, b) => a.ageDays - b.ageDays)
    }
  } catch {
    // local filesystem unavailable (serverless) — fine
  }

  try {
    const master = path.join(process.cwd(), 'data', 'distress-leads', 'MASTER-distress-stack.csv')
    if (fs.existsSync(master)) {
      const text = fs.readFileSync(master, 'utf8')
      let count = 0
      for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) count++
      distressStackRows = Math.max(0, count - 1)
    }
  } catch {
    distressStackRows = null
  }

  return { dmExports, distressStackRows }
}

async function loadTables(admin: SupabaseClient<any, any, any>, issues: DataSourceIssue[]) {
  const [
    leads,
    outreachMessages,
    outreachSendEvents,
    buyers,
    buyerOutreach,
    buyerMatches,
    lenders,
    lenderOutreach,
    lenderMatches,
    investors,
    investorFollowUps,
    fundingRequests,
    payments,
    fundingPayments,
    contentAssets,
    seoOpportunities,
    prTargets,
    prPitches,
    scrapeRuns,
    adminTasks,
    dailyReports,
    researchChecklists,
    targetMarkets,
  ] = await Promise.all([
    safeRows(
      () =>
        admin
          .from('leads')
          .select(
            'id,email,email_valid,status,outreach_status,source,city,state,lead_score,lead_type,delivery_status,bounce_risk_score,created_at,updated_at,last_contacted_at'
          )
          .order('created_at', { ascending: false }),
      'leads',
      issues,
      { maxRows: 5000 }
    ),
    safeRows(
      () =>
        admin
          .from('outreach_messages')
          .select('id,status,channel,approved_at,sent_at,created_at,updated_at')
          .order('updated_at', { ascending: false }),
      'outreach_messages',
      issues,
      { maxRows: 5000 }
    ),
    safeRows(
      () =>
        admin
          .from('outreach_send_events')
          .select('id,channel,status,created_at')
          .order('created_at', { ascending: false }),
      'outreach_send_events',
      issues,
      { maxRows: 5000 }
    ),
    safeRows(
      () =>
        admin
          .from('buyers')
          .select('id,company_name,relationship_stage,outreach_status,state,next_follow_up_at,last_contacted_at,created_at,updated_at'),
      'buyers',
      issues,
      { maxRows: 2000 }
    ),
    safeRows(
      () =>
        admin
          .from('buyer_outreach_messages')
          .select('id,status,channel,sent_at,created_at,updated_at'),
      'buyer_outreach_messages',
      issues,
      { maxRows: 2000 }
    ),
    safeRows(() => admin.from('buyer_matches').select('*'), 'buyer_matches', issues, { maxRows: 1000 }),
    safeRows(
      () =>
        admin
          .from('lenders')
          .select('id,company_name,relationship_stage,outreach_status,state,next_follow_up_at,last_contacted_at,created_at,updated_at'),
      'lenders',
      issues,
      { maxRows: 2000 }
    ),
    safeRows(
      () =>
        admin
          .from('lender_outreach_messages')
          .select('id,status,channel,sent_at,created_at,updated_at'),
      'lender_outreach_messages',
      issues,
      { maxRows: 2000 }
    ),
    safeRows(() => admin.from('lender_matches').select('*'), 'lender_matches', issues, { maxRows: 1000 }),
    safeRows(() => admin.from('investor_profiles').select('*'), 'investor_profiles', issues, { maxRows: 1000 }),
    safeRows(() => admin.from('investor_follow_up_tasks').select('*'), 'investor_follow_up_tasks', issues, {
      maxRows: 500,
    }),
    safeRows(
      () =>
        admin
          .from('funding_strategy_requests')
          .select('id,status,payment_status,readiness_score,created_at,updated_at'),
      'funding_strategy_requests',
      issues,
      { maxRows: 1000 }
    ),
    safeRows(() => admin.from('payments').select('amount,status,created_at,updated_at'), 'payments', issues, {
      maxRows: 2000,
    }),
    safeRows(
      () => admin.from('funding_payments').select('amount_paid,status,created_at,updated_at'),
      'funding_payments',
      issues,
      { maxRows: 2000 }
    ),
    safeRows(
      () =>
        admin
          .from('content_assets')
          .select('id,status,content_type,service_key,indexed_status,published_at,created_at,updated_at')
          .order('updated_at', { ascending: false }),
      'content_assets',
      issues,
      { maxRows: 2000 }
    ),
    safeRows(() => admin.from('entity_seo_opportunities').select('*'), 'entity_seo_opportunities', issues, {
      maxRows: 500,
    }),
    safeRows(() => admin.from('pr_targets').select('*'), 'pr_targets', issues, { maxRows: 500 }),
    safeRows(() => admin.from('pr_pitch_drafts').select('*'), 'pr_pitch_drafts', issues, { maxRows: 500 }),
    safeRows(
      () =>
        admin
          .from('scrape_runs')
          .select('id,source_key,status,result_count,started_at,completed_at,created_at')
          .order('created_at', { ascending: false }),
      'scrape_runs',
      issues,
      { maxRows: 300 }
    ),
    safeRows(
      () =>
        admin
          .from('admin_tasks')
          .select('id,title,status,priority,due_at,created_at')
          .order('created_at', { ascending: false }),
      'admin_tasks',
      issues,
      { maxRows: 500 }
    ),
    safeRows(
      () =>
        admin
          .from('daily_growth_reports')
          .select('id,report_date,recommended_actions,created_at')
          .order('report_date', { ascending: false }),
      'daily_growth_reports',
      issues,
      { maxRows: 10 }
    ),
    safeRows(() => admin.from('osint_research_checklists').select('*'), 'osint_research_checklists', issues, {
      maxRows: 500,
    }),
    safeRows(() => admin.from('target_markets').select('*'), 'target_markets', issues, { maxRows: 250 }),
  ])

  return {
    leads,
    outreachMessages,
    outreachSendEvents,
    buyers,
    buyerOutreach,
    buyerMatches,
    lenders,
    lenderOutreach,
    lenderMatches,
    investors,
    investorFollowUps,
    fundingRequests,
    payments,
    fundingPayments,
    contentAssets,
    seoOpportunities,
    prTargets,
    prPitches,
    scrapeRuns,
    adminTasks,
    dailyReports,
    researchChecklists,
    targetMarkets,
  }
}

export async function getCommandCenterData(): Promise<CommandCenterData> {
  const admin = createAdminClient()
  const issues: DataSourceIssue[] = []
  const t = await loadTables(admin, issues)
  const local = loadLocalSignals()
  const liveDataReachable = issues.length === 0

  // ── Shared signals ─────────────────────────────────────────────────────────
  const outreachTarget = envInt('LEADS_TARGET_EMAILS_PER_DAY', 100)
  const revenueTarget = envInt('VESTBLOCK_MONTHLY_REVENUE_TARGET', 100000)

  const newLeads24h = t.leads.filter((lead) => withinHours(lead.created_at, 24)).length
  const newLeads7d = t.leads.filter((lead) => withinDays(lead.created_at, 7)).length
  const contactableLeads = t.leads.filter((lead) => String(lead.email || '').trim()).length

  const leadSends24h = t.outreachSendEvents.filter(
    (event) => lower(event.status) === 'sent' && lower(event.channel) === 'email' && withinHours(event.created_at, 24)
  ).length
  const partnerSends24h =
    t.lenderOutreach.filter((m) => lower(m.status) === 'sent' && withinHours(m.sent_at || m.updated_at, 24)).length +
    t.buyerOutreach.filter((m) => lower(m.status) === 'sent' && withinHours(m.sent_at || m.updated_at, 24)).length
  const outreach24h = leadSends24h + partnerSends24h
  const sends7d =
    t.outreachSendEvents.filter((event) => lower(event.status) === 'sent' && withinDays(event.created_at, 7)).length +
    t.lenderOutreach.filter((m) => lower(m.status) === 'sent' && withinDays(m.sent_at || m.updated_at, 7)).length +
    t.buyerOutreach.filter((m) => lower(m.status) === 'sent' && withinDays(m.sent_at || m.updated_at, 7)).length

  const sendReady = t.outreachMessages.filter(
    (m) => lower(m.channel) === 'email' && ['approved', 'queued'].includes(lower(m.status))
  ).length
  const needsReview = t.outreachMessages.filter(
    (m) => lower(m.channel) === 'email' && lower(m.status) === 'needs_review'
  ).length

  const replySignals7d = t.leads.filter(
    (lead) =>
      ['replied', 'interested', 'qualified', 'closed_won'].includes(lower(lead.status)) &&
      withinDays(lead.updated_at || lead.last_contacted_at || lead.created_at, 7)
  ).length

  const followupsDue = t.leads.filter((lead) => lower(lead.outreach_status) === 'followup_due').length
  const bounceRiskLeads = t.leads.filter(
    (lead) => Number(lead.bounce_risk_score || 0) >= 70 || lower(lead.delivery_status) === 'bounced'
  ).length

  const completedPayments = t.payments.filter((p) => ['completed', 'paid', 'succeeded'].includes(lower(p.status)))
  const paidFunding = t.fundingPayments.filter((p) => ['paid', 'completed'].includes(lower(p.status)))
  const revenue30d =
    completedPayments
      .filter((p) => withinDays(p.created_at || p.updated_at, 30))
      .reduce((sum, p) => sum + Number(p.amount || 0), 0) +
    paidFunding
      .filter((p) => withinDays(p.created_at || p.updated_at, 30))
      .reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)

  const hotFunding = t.fundingRequests.filter(
    (r) =>
      ['submitted', 'paid', 'in_review', 'strategy_ready'].includes(lower(r.status)) &&
      Number(r.readiness_score || 0) >= 70
  ).length
  const paidFundingRequests = t.fundingRequests.filter((r) => lower(r.payment_status) === 'paid').length
  const openFundingRequests = t.fundingRequests.filter(
    (r) => !['closed', 'rejected', 'complete', 'completed'].includes(lower(r.status))
  ).length

  const activeBuyers = t.buyers.filter((b) =>
    ['contacted', 'responded', 'reviewing', 'active_buyer'].includes(lower(b.relationship_stage))
  ).length
  const activeLenders = t.lenders.filter((l) =>
    ['contacted', 'responded', 'reviewing', 'active_partner'].includes(lower(l.relationship_stage))
  ).length
  const partnerFollowupsDue =
    t.buyers.filter((b) => b.next_follow_up_at && Date.parse(b.next_follow_up_at) < Date.now()).length +
    t.lenders.filter((l) => l.next_follow_up_at && Date.parse(l.next_follow_up_at) < Date.now()).length

  const pendingBuyerMatches = t.buyerMatches.filter(
    (m) => !['closed', 'rejected', 'won', 'lost', 'complete', 'completed'].includes(lower(m.status))
  ).length
  const pendingLenderMatches = t.lenderMatches.filter(
    (m) => !['closed', 'rejected', 'won', 'lost', 'complete', 'completed'].includes(lower(m.status))
  ).length

  const openChecklists = t.researchChecklists.filter(
    (c) => !['done', 'completed', 'complete', 'archived'].includes(lower(c.status))
  ).length

  const investorFollowupsOpen = t.investorFollowUps.filter(
    (task) => !['done', 'completed', 'complete', 'cancelled'].includes(lower(task.status))
  ).length

  const publishedContent = t.contentAssets.filter((a) => lower(a.status) === 'published')
  const publishedContent7d = publishedContent.filter((a) =>
    withinDays(a.published_at || a.updated_at || a.created_at, 7)
  ).length
  const openSeoOpportunities = t.seoOpportunities.filter(
    (o) => !['done', 'completed', 'published', 'dismissed'].includes(lower(o.status))
  ).length
  const draftPitches = t.prPitches.filter((p) => ['draft', 'ready', 'pending'].includes(lower(p.status))).length

  const recentScrapeRuns = t.scrapeRuns.filter((run) => withinHours(run.created_at || run.started_at, 24))
  const failedScrapes24h = recentScrapeRuns.filter((run) => lower(run.status) === 'failed').length
  const okScrapes24h = recentScrapeRuns.filter((run) => ['completed', 'partial'].includes(lower(run.status))).length

  const openTasks = t.adminTasks.filter((task) => !['done', 'completed', 'closed'].includes(lower(task.status)))
  const urgentTasks = openTasks.filter((task) => ['urgent', 'high'].includes(lower(task.priority)))
  const overdueTasks = openTasks.filter((task) => task.due_at && Date.parse(task.due_at) < Date.now())

  const latestReport = t.dailyReports[0] || null

  // ── Market heat ────────────────────────────────────────────────────────────
  const marketMap = new Map<string, MarketHeatRow>()
  for (const lead of t.leads) {
    if (!lead.city) continue
    const market = `${lead.city}${lead.state ? `, ${lead.state}` : ''}`
    const row = marketMap.get(market) || { market, leads: 0, contactable: 0, recent7d: 0, replied: 0, heat: 0 }
    row.leads++
    if (String(lead.email || '').trim()) row.contactable++
    if (withinDays(lead.created_at, 7)) row.recent7d++
    if (['replied', 'interested', 'qualified', 'closed_won'].includes(lower(lead.status))) row.replied++
    marketMap.set(market, row)
  }
  const marketHeat = [...marketMap.values()]
    .map((row) => ({
      ...row,
      heat: Math.round(
        clamp01(row.recent7d / 25) * 40 + clamp01(row.replied / 5) * 35 + clamp01(row.contactable / 100) * 25
      ),
    }))
    .sort((a, b) => b.heat - a.heat || b.leads - a.leads)
    .slice(0, 8)

  // ── Activity feed ──────────────────────────────────────────────────────────
  const activity: ActivityItem[] = []
  for (const event of t.outreachSendEvents.slice(0, 30)) {
    if (!event.created_at) continue
    activity.push({
      at: event.created_at,
      source: 'Outreach',
      message: `Email ${lower(event.status) || 'event'} via ${event.channel || 'email'}`,
    })
  }
  for (const lead of t.leads.slice(0, 25)) {
    if (!lead.created_at) continue
    activity.push({
      at: lead.created_at,
      source: 'Leads',
      message: `New ${lead.lead_type || 'lead'}${lead.city ? ` in ${lead.city}` : ''}${lead.source ? ` from ${lead.source}` : ''}`,
    })
  }
  for (const run of t.scrapeRuns.slice(0, 15)) {
    const at = run.completed_at || run.created_at
    if (!at) continue
    activity.push({
      at,
      source: 'Sources',
      message: `${run.source_key || 'source'} run ${lower(run.status) || 'logged'}${
        run.result_count ? ` · ${run.result_count} results` : ''
      }`,
    })
  }
  for (const asset of publishedContent.slice(0, 10)) {
    const at = asset.published_at || asset.updated_at
    if (!at) continue
    activity.push({ at, source: 'Authority', message: `Published ${asset.content_type || 'asset'}` })
  }
  for (const message of t.buyerOutreach.slice(0, 10)) {
    if (lower(message.status) !== 'sent' || !(message.sent_at || message.updated_at)) continue
    activity.push({ at: message.sent_at || message.updated_at!, source: 'Buyers', message: 'Buyer outreach sent' })
  }
  for (const message of t.lenderOutreach.slice(0, 10)) {
    if (lower(message.status) !== 'sent' || !(message.sent_at || message.updated_at)) continue
    activity.push({ at: message.sent_at || message.updated_at!, source: 'Lenders', message: 'Lender outreach sent' })
  }
  activity.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  const activityFeed = activity.slice(0, 40)

  // ── Alerts ─────────────────────────────────────────────────────────────────
  const alerts: CommandAlert[] = []
  if (!liveDataReachable) {
    alerts.push({
      severity: 'critical',
      message: 'Some live data sources are unreachable. Zero counts may not be real.',
    })
  }
  if (failedScrapes24h > 0) {
    alerts.push({
      severity: 'critical',
      message: `${failedScrapes24h} source run${failedScrapes24h === 1 ? '' : 's'} failed in the last 24h.`,
      href: '/admin/scrape-runs',
    })
  }
  if (sendReady === 0 && liveDataReachable) {
    alerts.push({
      severity: 'warning',
      message: 'Send-ready outreach queue is empty. Refill before expecting replies.',
      href: '/admin/leads',
    })
  }
  if (overdueTasks.length > 0) {
    alerts.push({
      severity: 'warning',
      message: `${overdueTasks.length} admin task${overdueTasks.length === 1 ? '' : 's'} overdue.`,
      href: '/admin-panel?tab=tasks',
    })
  }
  if (partnerFollowupsDue > 0) {
    alerts.push({
      severity: 'warning',
      message: `${partnerFollowupsDue} partner follow-up${partnerFollowupsDue === 1 ? ' is' : 's are'} past due.`,
      href: '/admin/buyers',
    })
  }
  if (bounceRiskLeads > 0) {
    alerts.push({
      severity: 'info',
      message: `${bounceRiskLeads} lead${bounceRiskLeads === 1 ? '' : 's'} flagged for bounce risk or failed delivery.`,
      href: '/admin/leads',
    })
  }
  const staleExports = local.dmExports.filter((e) => e.ageDays > 7).length
  if (local.dmExports.length > 0 && local.dmExports.every((e) => e.ageDays > 7)) {
    alerts.push({
      severity: 'warning',
      message: `All ${staleExports} DealMachine contact exports on disk are older than 7 days. Export fresh contacts before the next send.`,
    })
  }

  // ── Priorities ─────────────────────────────────────────────────────────────
  const priorities = (
    liveDataReachable
      ? [
          hotFunding > 0
            ? `Work the ${hotFunding} high-readiness funding request${hotFunding === 1 ? '' : 's'} — closest thing to revenue today.`
            : null,
          replySignals7d > 0
            ? `Answer and advance ${replySignals7d} live repl${replySignals7d === 1 ? 'y' : 'ies'} before sending anything new.`
            : null,
          sendReady === 0
            ? 'Refill the outreach queue: source, score, and draft before volume.'
            : `Approve and send from the ${sendReady}-message ready queue (target ${outreachTarget}/day).`,
          followupsDue > 0 ? `Clear ${followupsDue} lead follow-up${followupsDue === 1 ? '' : 's'} marked due.` : null,
          pendingBuyerMatches + pendingLenderMatches > 0
            ? `Route ${pendingBuyerMatches + pendingLenderMatches} open match${pendingBuyerMatches + pendingLenderMatches === 1 ? '' : 'es'} to buyers/lenders.`
            : null,
          openChecklists > 0
            ? `Finish ${openChecklists} research checklist${openChecklists === 1 ? '' : 's'} blocking outreach.`
            : null,
          publishedContent7d < 5
            ? 'Publish proof-backed authority content — visibility cadence is below 5/week.'
            : null,
          overdueTasks.length > 0 ? `Close ${overdueTasks.length} overdue operator task${overdueTasks.length === 1 ? '' : 's'}.` : null,
        ]
      : ['Restore live data reads first — operating blind on cached zeros is how bad sends happen.']
  ).filter(Boolean) as string[]

  // ── Agents ─────────────────────────────────────────────────────────────────
  const agentStatus = (active: boolean, attention: boolean): AgentStatus =>
    attention ? 'attention' : active ? 'active' : 'idle'

  const recentLeadFeed: AgentFeedItem[] = t.leads.slice(0, 5).map((lead) => ({
    label: lead.city ? `${lead.city}${lead.state ? `, ${lead.state}` : ''}` : lead.source || 'Lead',
    detail: `${lead.lead_type || 'lead'} · ${lead.status || 'new'}`,
    at: lead.created_at || null,
  }))

  const agents: AgentPanelData[] = [
    {
      key: 'acquisition',
      name: 'Lead Acquisition',
      role: 'Sellers, distress stacks, DealMachine lanes, partner signups',
      status: agentStatus(newLeads7d > 0, failedScrapes24h > 0 || (local.dmExports.length > 0 && staleExports === local.dmExports.length)),
      statusReason:
        failedScrapes24h > 0
          ? `${failedScrapes24h} failed source runs need review`
          : newLeads7d > 0
            ? `${newLeads7d} new leads this week`
            : 'No new inflow this week',
      kpis: [
        { label: 'New 24h', value: newLeads24h, status: newLeads24h > 0 ? 'green' : 'yellow' },
        { label: 'New 7d', value: newLeads7d },
        { label: 'Contactable', value: contactableLeads, helper: 'leads with an email on file' },
        {
          label: 'Distress stack',
          value: local.distressStackRows ?? '—',
          helper: local.distressStackRows != null ? 'rows in local master file' : 'local file not present here',
        },
      ],
      feed: recentLeadFeed,
      actions: [
        { label: 'Open leads', href: '/admin/leads' },
        { label: 'Lead sources', href: '/admin/lead-sources' },
        { label: 'Market expansion', href: '/admin/market-expansion' },
        { label: 'Scrape runs', href: '/admin/scrape-runs' },
      ],
    },
    {
      key: 'outreach',
      name: 'Outreach',
      role: 'Email/SMS sends, follow-up cadence, queue health',
      status: agentStatus(outreach24h > 0, sendReady === 0 || followupsDue > 10),
      statusReason:
        sendReady === 0
          ? 'Queue empty — needs refill'
          : `${outreach24h}/${outreachTarget} sent in 24h · ${sendReady} ready`,
      kpis: [
        {
          label: 'Sent 24h',
          value: outreach24h,
          helper: `target ${outreachTarget}`,
          status: outreach24h >= outreachTarget ? 'green' : outreach24h > 0 ? 'yellow' : 'red',
        },
        { label: 'Send-ready', value: sendReady, status: sendReady >= 25 ? 'green' : sendReady > 0 ? 'yellow' : 'red' },
        { label: 'Needs review', value: needsReview },
        { label: 'Follow-ups due', value: followupsDue, status: followupsDue > 10 ? 'yellow' : undefined },
      ],
      feed: t.outreachSendEvents.slice(0, 5).map((event) => ({
        label: `Email ${lower(event.status) || 'event'}`,
        detail: event.channel || 'email',
        at: event.created_at || null,
      })),
      actions: [
        { label: 'Buyer outreach', href: '/admin/buyer-outreach' },
        { label: 'Lender outreach', href: '/admin/lender-outreach' },
        { label: 'Lead queue', href: '/admin/leads' },
      ],
    },
    {
      key: 'routing',
      name: 'Deal Routing',
      role: 'Fit decisions: cash, creative, novation, buy boxes, lending boxes',
      status: agentStatus(pendingBuyerMatches + pendingLenderMatches > 0, pendingBuyerMatches + pendingLenderMatches > 20),
      statusReason: `${pendingBuyerMatches + pendingLenderMatches} open matches awaiting routing`,
      kpis: [
        { label: 'Buyer matches', value: pendingBuyerMatches },
        { label: 'Lender matches', value: pendingLenderMatches },
        { label: 'Active buyers', value: activeBuyers },
        { label: 'Active lenders', value: activeLenders },
      ],
      feed: [],
      actions: [
        { label: 'Buyer matches', href: '/admin/buyer-matches' },
        { label: 'Lender matches', href: '/admin/lender-matches' },
        { label: 'DealFlow command', href: '/admin/dealflow' },
      ],
    },
    {
      key: 'underwriting',
      name: 'Underwriting & Capital',
      role: 'Analyzer output, packets, funding readiness, capital gaps',
      status: agentStatus(openFundingRequests > 0, hotFunding > 0),
      statusReason:
        hotFunding > 0
          ? `${hotFunding} high-readiness funding request${hotFunding === 1 ? '' : 's'} waiting`
          : `${openFundingRequests} open funding requests`,
      kpis: [
        { label: 'Open requests', value: openFundingRequests },
        { label: 'High readiness', value: hotFunding, status: hotFunding > 0 ? 'yellow' : undefined },
        { label: 'Paid', value: paidFundingRequests, status: paidFundingRequests > 0 ? 'green' : undefined },
        { label: 'Revenue 30d', value: `$${Math.round(revenue30d).toLocaleString()}` },
      ],
      feed: [],
      actions: [
        { label: 'Funding pipeline', href: '/admin/funding' },
        { label: 'Lender programs', href: '/admin/lender-programs' },
      ],
    },
    {
      key: 'authority',
      name: 'Authority Engine',
      role: 'AEO, SEO, PR, content, indexing — runs behind the scenes',
      status: agentStatus(publishedContent7d > 0, publishedContent7d === 0 && openSeoOpportunities > 0),
      statusReason: `${publishedContent7d} published this week · ${openSeoOpportunities} SEO opportunities open`,
      kpis: [
        { label: 'Published 7d', value: publishedContent7d, helper: 'target 5/week', status: publishedContent7d >= 5 ? 'green' : 'yellow' },
        { label: 'Total published', value: publishedContent.length },
        { label: 'SEO opportunities', value: openSeoOpportunities },
        { label: 'PR drafts', value: draftPitches },
      ],
      feed: publishedContent.slice(0, 4).map((asset) => ({
        label: asset.content_type || 'asset',
        detail: lower(asset.indexed_status) || 'published',
        at: asset.published_at || asset.updated_at || null,
      })),
      actions: [
        { label: 'SEO opportunities', href: '/admin/seo-opportunities' },
        { label: 'PR engine', href: '/admin/pr-engine' },
        { label: 'Daily reports', href: '/admin/reports/daily' },
      ],
    },
    {
      key: 'qa',
      name: 'QA / Funnel Health',
      role: 'Intake, signup, analyzer, delivery, broken-state detection',
      status: agentStatus(true, failedScrapes24h > 0 || bounceRiskLeads > 25),
      statusReason:
        failedScrapes24h > 0
          ? `${failedScrapes24h} failed runs · ${bounceRiskLeads} delivery-risk leads`
          : `${bounceRiskLeads} delivery-risk leads tracked`,
      kpis: [
        { label: 'Source runs ok 24h', value: okScrapes24h, status: failedScrapes24h === 0 ? 'green' : 'yellow' },
        { label: 'Failed 24h', value: failedScrapes24h, status: failedScrapes24h > 0 ? 'red' : 'green' },
        { label: 'Bounce-risk leads', value: bounceRiskLeads },
        { label: 'Research open', value: openChecklists },
      ],
      feed: t.scrapeRuns.slice(0, 4).map((run) => ({
        label: run.source_key || 'source',
        detail: `${lower(run.status) || 'run'}${run.result_count ? ` · ${run.result_count}` : ''}`,
        at: run.completed_at || run.created_at || null,
      })),
      actions: [
        { label: 'Scrape runs', href: '/admin/scrape-runs' },
        { label: 'Research checklists', href: '/admin/research-checklists' },
        { label: 'Diagnostics', href: '/admin-panel?tab=diagnostics' },
      ],
    },
    {
      key: 'operator',
      name: 'Operator Intelligence',
      role: 'Today’s priorities, escalations, stalled work, relationships',
      status: agentStatus(true, urgentTasks.length > 0 || overdueTasks.length > 0),
      statusReason: `${openTasks.length} open tasks · ${urgentTasks.length} urgent · ${overdueTasks.length} overdue`,
      kpis: [
        { label: 'Open tasks', value: openTasks.length },
        { label: 'Urgent', value: urgentTasks.length, status: urgentTasks.length > 0 ? 'yellow' : 'green' },
        { label: 'Overdue', value: overdueTasks.length, status: overdueTasks.length > 0 ? 'red' : 'green' },
        { label: 'Investor follow-ups', value: investorFollowupsOpen },
      ],
      feed: openTasks.slice(0, 5).map((task) => ({
        label: task.title || 'Task',
        detail: `${lower(task.priority) || 'normal'}${task.due_at ? ` · due ${new Date(task.due_at).toLocaleDateString()}` : ''}`,
        at: task.created_at || null,
      })),
      actions: [
        { label: 'Task board', href: '/admin-panel?tab=tasks' },
        { label: 'Investor partnerships', href: '/admin/investor-partnerships' },
        { label: 'Revenue command', href: '/admin/revenue-command' },
        { label: 'Improvement', href: '/admin/improvement' },
      ],
    },
  ]

  // ── Mission nodes (intensity drives the visualization) ─────────────────────
  const missionNodes: MissionNode[] = [
    { key: 'acquisition', label: 'Acquire', intensity: clamp01(newLeads7d / 50) },
    { key: 'outreach', label: 'Outreach', intensity: clamp01(sends7d / (outreachTarget * 3)) },
    { key: 'routing', label: 'Route', intensity: clamp01((pendingBuyerMatches + pendingLenderMatches) / 20) },
    { key: 'underwriting', label: 'Capital', intensity: clamp01((hotFunding + paidFundingRequests) / 6) },
    { key: 'authority', label: 'Authority', intensity: clamp01(publishedContent7d / 5) },
    { key: 'qa', label: 'QA', intensity: failedScrapes24h > 0 ? 0.9 : clamp01(okScrapes24h / 10) },
    { key: 'operator', label: 'Operator', intensity: clamp01(openTasks.length / 20) },
  ]

  return {
    generatedAt: new Date().toISOString(),
    liveDataReachable,
    dataSourceIssues: issues,
    summary: {
      revenue30d,
      revenueTarget,
      outreach24h,
      outreachTarget,
      newLeads24h,
      replySignals7d,
      openTasks: openTasks.length,
      urgentTasks: urgentTasks.length,
      activePartners: activeBuyers + activeLenders,
      paidFundingRequests,
    },
    missionNodes,
    priorities: priorities.slice(0, 7),
    alerts: alerts.slice(0, 8),
    agents,
    marketHeat,
    routingQueue: [
      { label: 'Buyer matches open', count: pendingBuyerMatches, href: '/admin/buyer-matches' },
      { label: 'Lender matches open', count: pendingLenderMatches, href: '/admin/lender-matches' },
      { label: 'Research checklists open', count: openChecklists, href: '/admin/research-checklists' },
      { label: 'Follow-ups due', count: followupsDue + partnerFollowupsDue, href: '/admin/leads' },
      { label: 'Funding requests open', count: openFundingRequests, href: '/admin/funding' },
    ],
    activity: activityFeed,
    localSignals: {
      dmExports: local.dmExports.slice(0, 6),
      distressStackRows: local.distressStackRows,
    },
  }
}

export type { DataSourceIssue }
