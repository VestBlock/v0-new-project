import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { evaluateOutreachV2Lead } from '@/lib/leads/outreachV2'

type DataSourceIssue = {
  source: string
  message: string
}

type Status = 'green' | 'yellow' | 'red'

type Metric = {
  label: string
  value: string | number
  target?: string | number
  status: Status
  helper: string
}

type LeadRow = {
  id: string
  email?: string | null
  status?: string | null
  outreach_status?: string | null
  source?: string | null
  city?: string | null
  state?: string | null
  best_offer?: string | null
  lead_score?: number | null
  lead_type?: string | null
  category?: string | null
  niche?: string | null
  market_segment?: string | null
  outreach_angle?: string | null
  pain_signal?: string | null
  notes?: string | null
  email_valid?: boolean | null
  bounce_risk_score?: number | null
  delivery_status?: string | null
  suppression_reason?: string | null
  contact_info?: Record<string, unknown> | null
  metadata_json?: Record<string, unknown> | null
  form_data?: Record<string, unknown> | null
  website_audit_json?: Record<string, unknown> | null
  created_at?: string | null
  updated_at?: string | null
  last_contacted_at?: string | null
}

type OutreachMessageRow = {
  id: string
  status?: string | null
  channel?: string | null
  approved_at?: string | null
  sent_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type OutreachSendEventRow = {
  id: string
  channel?: string | null
  status?: string | null
  created_at?: string | null
}

type AdminTaskRow = {
  id: string
  title?: string | null
  status?: string | null
  priority?: string | null
  due_at?: string | null
  created_at?: string | null
}

type ContentAssetRow = {
  id: string
  status?: string | null
  content_type?: string | null
  service_key?: string | null
  indexed_status?: string | null
  published_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type FundingStrategyRequestRow = {
  id: string
  status?: string | null
  payment_status?: string | null
  readiness_score?: number | null
  created_at?: string | null
  updated_at?: string | null
}

type PaymentRow = {
  amount?: number | null
  status?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type FundingPaymentRow = {
  amount_paid?: number | null
  status?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type PartnerRow = {
  id: string
  relationship_stage?: string | null
  next_follow_up_at?: string | null
  last_contacted_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type DailyReportRow = {
  id: string
  report_date?: string | null
  summary_json?: Record<string, unknown> | null
  recommended_actions?: string[] | null
  created_at?: string | null
}

type ScrapeRunRow = {
  id: string
  source_key?: string | null
  status?: string | null
  result_count?: number | null
  started_at?: string | null
  completed_at?: string | null
  created_at?: string | null
}

async function safeRows<T>(
  buildQuery: () => { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message?: string } | null }> },
  label: string,
  issues: DataSourceIssue[],
  options: { pageSize?: number; maxRows?: number } = {}
): Promise<T[]> {
  const pageSize = options.pageSize ?? 1000
  const maxRows = options.maxRows ?? 10000
  const rows: T[] = []

  for (let from = 0; from < maxRows; from += pageSize) {
    const to = Math.min(from + pageSize - 1, maxRows - 1)
    const { data, error } = await buildQuery().range(from, to)
    if (error) {
      issues.push({ source: label, message: error.message || 'Query unavailable.' })
      return []
    }

    rows.push(...(data || []))
    if (!data || data.length < pageSize) break
  }

  return rows
}

function envInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function hoursSince(value?: string | null) {
  if (!value) return Number.POSITIVE_INFINITY
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return Number.POSITIVE_INFINITY
  return (Date.now() - timestamp) / (1000 * 60 * 60)
}

function isWithinHours(value: string | null | undefined, hours: number) {
  return hoursSince(value) <= hours
}

function isWithinDays(value: string | null | undefined, days: number) {
  return hoursSince(value) <= days * 24
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function lower(value?: string | null) {
  return String(value || '').toLowerCase()
}

function hasEmail(lead: LeadRow) {
  return Boolean(String(lead.email || '').trim())
}

function countBy<T>(rows: T[], keyFn: (row: T) => string | null | undefined, limit = 6) {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = keyFn(row)
    if (!key) continue
    counts.set(key, (counts.get(key) || 0) + 1)
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }))
}

function metric(input: Metric) {
  return input
}

function getCadenceStatus(actual: number, target: number): Status {
  if (actual >= target) return 'green'
  if (actual >= Math.max(1, Math.round(target * 0.5))) return 'yellow'
  return 'red'
}

function getOverallGrade(redCount: number, yellowCount: number) {
  if (redCount >= 4) return 'C'
  if (redCount >= 2) return 'B-'
  if (redCount === 1 || yellowCount >= 3) return 'B'
  if (yellowCount >= 1) return 'A-'
  return 'A'
}

async function loadRevenueCommandTables(admin: SupabaseClient<any, any, any>, issues: DataSourceIssue[]) {
  const [
    leads,
    outreachMessages,
    outreachSendEvents,
    adminTasks,
    contentAssets,
    fundingStrategyRequests,
    payments,
    fundingPayments,
    lenders,
    lenderOutreachMessages,
    buyers,
    buyerOutreachMessages,
    dailyReports,
    scrapeRuns,
  ] = await Promise.all([
    safeRows<LeadRow>(
      () =>
        admin
        .from('leads')
        .select('id,email,email_valid,status,outreach_status,source,city,state,best_offer,lead_score,lead_type,category,niche,market_segment,outreach_angle,pain_signal,notes,bounce_risk_score,delivery_status,suppression_reason,contact_info,metadata_json,form_data,website_audit_json,created_at,updated_at,last_contacted_at')
        .order('created_at', { ascending: false })
      ,
      'leads',
      issues,
      { maxRows: 5000 }
    ),
    safeRows<OutreachMessageRow>(
      () =>
        admin
        .from('outreach_messages')
        .select('id,status,channel,approved_at,sent_at,created_at,updated_at')
        .order('updated_at', { ascending: false })
      ,
      'outreach_messages',
      issues,
      { maxRows: 10000 }
    ),
    safeRows<OutreachSendEventRow>(
      () =>
        admin
        .from('outreach_send_events')
        .select('id,channel,status,created_at')
        .order('created_at', { ascending: false })
      ,
      'outreach_send_events',
      issues,
      { maxRows: 10000 }
    ),
    safeRows<AdminTaskRow>(
      () =>
        admin
        .from('admin_tasks')
        .select('id,title,status,priority,due_at,created_at')
        .order('created_at', { ascending: false })
      ,
      'admin_tasks',
      issues,
      { maxRows: 1000 }
    ),
    safeRows<ContentAssetRow>(
      () =>
        admin
        .from('content_assets')
        .select('id,status,content_type,service_key,indexed_status,published_at,created_at,updated_at')
        .order('updated_at', { ascending: false })
      ,
      'content_assets',
      issues,
      { maxRows: 2000 }
    ),
    safeRows<FundingStrategyRequestRow>(
      () =>
        admin
        .from('funding_strategy_requests')
        .select('id,status,payment_status,readiness_score,created_at,updated_at')
        .order('created_at', { ascending: false })
      ,
      'funding_strategy_requests',
      issues,
      { maxRows: 2000 }
    ),
    safeRows<PaymentRow>(
      () => admin.from('payments').select('amount,status,created_at,updated_at'),
      'payments',
      issues,
      { maxRows: 2000 }
    ),
    safeRows<FundingPaymentRow>(
      () => admin.from('funding_payments').select('amount_paid,status,created_at,updated_at'),
      'funding_payments',
      issues,
      { maxRows: 2000 }
    ),
    safeRows<PartnerRow>(
      () =>
        admin
        .from('lenders')
        .select('id,relationship_stage,next_follow_up_at,last_contacted_at,created_at,updated_at')
      ,
      'lenders',
      issues,
      { maxRows: 1000 }
    ),
    safeRows<OutreachMessageRow>(
      () =>
        admin
        .from('lender_outreach_messages')
        .select('id,status,channel,approved_at,sent_at,created_at,updated_at')
      ,
      'lender_outreach_messages',
      issues,
      { maxRows: 2000 }
    ),
    safeRows<PartnerRow>(
      () =>
        admin
        .from('buyers')
        .select('id,relationship_stage,next_follow_up_at,last_contacted_at,created_at,updated_at')
      ,
      'buyers',
      issues,
      { maxRows: 1000 }
    ),
    safeRows<OutreachMessageRow>(
      () =>
        admin
        .from('buyer_outreach_messages')
        .select('id,status,channel,approved_at,sent_at,created_at,updated_at')
      ,
      'buyer_outreach_messages',
      issues,
      { maxRows: 2000 }
    ),
    safeRows<DailyReportRow>(
      () =>
        admin
        .from('daily_growth_reports')
        .select('id,report_date,summary_json,recommended_actions,created_at')
        .order('report_date', { ascending: false })
      ,
      'daily_growth_reports',
      issues,
      { maxRows: 50 }
    ),
    safeRows<ScrapeRunRow>(
      () =>
        admin
        .from('scrape_runs')
        .select('id,source_key,status,result_count,started_at,completed_at,created_at')
        .order('created_at', { ascending: false })
      ,
      'scrape_runs',
      issues,
      { maxRows: 500 }
    ),
  ])

  return {
    leads,
    outreachMessages,
    outreachSendEvents,
    adminTasks,
    contentAssets,
    fundingStrategyRequests,
    payments,
    fundingPayments,
    lenders,
    lenderOutreachMessages,
    buyers,
    buyerOutreachMessages,
    dailyReports,
    scrapeRuns,
  }
}

export async function getRevenueCommandCenterData() {
  const admin = createAdminClient()
  const dataSourceIssues: DataSourceIssue[] = []
  const tables = await loadRevenueCommandTables(admin, dataSourceIssues)
  const liveDataReachable = dataSourceIssues.length === 0

  const dailyTarget = envInt('LEADS_TARGET_EMAILS_PER_DAY', 100)
  const sentLeadEmails24h = tables.outreachSendEvents.filter(
    (event) =>
      lower(event.status) === 'sent' &&
      lower(event.channel) === 'email' &&
      isWithinHours(event.created_at, 24)
  ).length
  const partnerEmails24h =
    tables.lenderOutreachMessages.filter(
      (message) => lower(message.status) === 'sent' && isWithinHours(message.sent_at || message.updated_at, 24)
    ).length +
    tables.buyerOutreachMessages.filter(
      (message) => lower(message.status) === 'sent' && isWithinHours(message.sent_at || message.updated_at, 24)
    ).length
  const totalOutreach24h = sentLeadEmails24h + partnerEmails24h
  const sendReadyMessages = tables.outreachMessages.filter((message) =>
    lower(message.channel) === 'email' && ['approved', 'queued'].includes(lower(message.status))
  ).length
  const needsReviewMessages = tables.outreachMessages.filter(
    (message) => lower(message.channel) === 'email' && lower(message.status) === 'needs_review'
  ).length
  const newLeads24h = tables.leads.filter((lead) => isWithinHours(lead.created_at, 24)).length
  const usableEmailLeads = tables.leads.filter(hasEmail).length
  const freshEmailReadyLeads = tables.leads.filter(
    (lead) =>
      hasEmail(lead) &&
      ['scored', 'outreach_ready'].includes(lower(lead.status)) &&
      ['not_started', 'failed', ''].includes(lower(lead.outreach_status))
  ).length
  const freshProductionEligibleEmailLeads = tables.leads.filter(
    (lead) =>
      hasEmail(lead) &&
      ['scored', 'outreach_ready'].includes(lower(lead.status)) &&
      ['not_started', 'failed', ''].includes(lower(lead.outreach_status)) &&
      evaluateOutreachV2Lead(lead as any).eligible
  ).length
  const sentOrContactedLeads = tables.leads.filter((lead) =>
    ['contacted', 'sent', 'followup_due'].includes(lower(lead.outreach_status))
  ).length
  const replySignals7d = tables.leads.filter(
    (lead) =>
      ['replied', 'interested', 'qualified', 'closed_won'].includes(lower(lead.status)) &&
      isWithinDays(lead.updated_at || lead.last_contacted_at || lead.created_at, 7)
  ).length

  const completedPayments = tables.payments.filter((payment) =>
    ['completed', 'paid', 'succeeded'].includes(lower(payment.status))
  )
  const paidFundingPayments = tables.fundingPayments.filter((payment) =>
    ['paid', 'completed'].includes(lower(payment.status))
  )
  const trailing30Revenue =
    completedPayments
      .filter((payment) => isWithinDays(payment.created_at || payment.updated_at, 30))
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0) +
    paidFundingPayments
      .filter((payment) => isWithinDays(payment.created_at || payment.updated_at, 30))
      .reduce((sum, payment) => sum + Number(payment.amount_paid || 0), 0)
  const monthlyRevenueTarget = envInt('VESTBLOCK_MONTHLY_REVENUE_TARGET', 100000)
  const hotFundingRequests = tables.fundingStrategyRequests.filter(
    (request) =>
      ['submitted', 'paid', 'in_review', 'strategy_ready'].includes(lower(request.status)) &&
      Number(request.readiness_score || 0) >= 70
  ).length
  const paidFundingRequests = tables.fundingStrategyRequests.filter(
    (request) => lower(request.payment_status) === 'paid'
  ).length
  const activePartnerConversations =
    tables.lenders.filter((partner) =>
      ['contacted', 'responded', 'reviewing', 'active_partner'].includes(lower(partner.relationship_stage))
    ).length +
    tables.buyers.filter((partner) =>
      ['contacted', 'responded', 'reviewing', 'active_buyer'].includes(lower(partner.relationship_stage))
    ).length

  const openTasks = tables.adminTasks.filter((task) => !['done', 'completed', 'closed'].includes(lower(task.status)))
  const urgentTasks = openTasks.filter((task) => ['urgent', 'high'].includes(lower(task.priority)))
  const overdueTasks = openTasks.filter((task) => task.due_at && Date.parse(task.due_at) < Date.now())
  const publishedContent = tables.contentAssets.filter((asset) => lower(asset.status) === 'published')
  const publishedContent7d = publishedContent.filter((asset) =>
    isWithinDays(asset.published_at || asset.updated_at || asset.created_at, 7)
  ).length
  const indexedContent = publishedContent.filter((asset) =>
    ['indexed', 'submitted', 'published'].includes(lower(asset.indexed_status))
  ).length
  const latestReport = tables.dailyReports[0] || null
  const recentScrapeRuns = tables.scrapeRuns.filter((run) => isWithinHours(run.created_at || run.started_at, 24))
  const successfulScrapeRuns24h = recentScrapeRuns.filter((run) =>
    ['completed', 'partial'].includes(lower(run.status))
  ).length
  const failedScrapeRuns24h = recentScrapeRuns.filter((run) => lower(run.status) === 'failed').length

  const metrics = [
    metric({
      label: 'Revenue last 30d',
      value: money(trailing30Revenue),
      target: money(monthlyRevenueTarget),
      status: trailing30Revenue > 0 ? 'yellow' : 'red',
      helper: `${money(Math.max(0, monthlyRevenueTarget - trailing30Revenue))} gap to monthly target.`,
    }),
    metric({
      label: 'Emails sent 24h',
      value: totalOutreach24h,
      target: dailyTarget,
      status: getCadenceStatus(totalOutreach24h, dailyTarget),
      helper: `${Math.max(0, dailyTarget - totalOutreach24h)} remaining to the daily safe-send target.`,
    }),
    metric({
      label: 'Send-ready queue',
      value: sendReadyMessages,
      target: 25,
      status: sendReadyMessages >= 25 ? 'green' : sendReadyMessages > 0 ? 'yellow' : 'red',
      helper: `${needsReviewMessages} email drafts still need review.`,
    }),
    metric({
      label: 'Fresh V2-ready leads',
      value: freshProductionEligibleEmailLeads,
      target: 25,
      status: getCadenceStatus(freshProductionEligibleEmailLeads, 25),
      helper: `${newLeads24h} new leads in 24h; ${freshEmailReadyLeads} email-ready leads are not yet V2 production eligible.`,
    }),
    metric({
      label: 'Reply signals 7d',
      value: replySignals7d,
      target: 7,
      status: getCadenceStatus(replySignals7d, 7),
      helper: 'Replies, interested, qualified, or won lead statuses.',
    }),
    metric({
      label: 'Published content 7d',
      value: publishedContent7d,
      target: 5,
      status: getCadenceStatus(publishedContent7d, 5),
      helper: `${indexedContent}/${publishedContent.length || 0} published assets have indexing/submission status.`,
    }),
  ]

  const redCount = metrics.filter((item) => item.status === 'red').length
  const yellowCount = metrics.filter((item) => item.status === 'yellow').length

  const cityMix = countBy(tables.leads, (lead) =>
    lead.city ? `${lead.city}${lead.state ? `, ${lead.state}` : ''}` : null
  )
  const sourceMix = countBy(tables.leads, (lead) => lead.source || null)
  const offerMix = countBy(tables.leads, (lead) => lead.best_offer || null)

  const nextActions = (
    liveDataReachable
      ? [
          sendReadyMessages === 0
            ? 'Run source refill, scoring, enrichment, and draft generation before trying to send more email.'
            : null,
          needsReviewMessages > 0 && freshProductionEligibleEmailLeads > 0
            ? `Review the best ${Math.min(25, needsReviewMessages)} V2-eligible outreach drafts before approving sends.`
            : null,
          needsReviewMessages > 0 && freshProductionEligibleEmailLeads === 0
            ? 'Do not force-approve the stale review queue. Refill with V2-eligible leads first, then approve only drafts that pass production gates.'
            : null,
          freshProductionEligibleEmailLeads === 0
            ? 'Add or rotate higher-fit lead sources; the current V2 production-safe pool is exhausted or already contacted.'
            : null,
          failedScrapeRuns24h > 0
            ? 'Inspect failed scrape runs before increasing volume so the system does not repeat bad inputs.'
            : null,
          replySignals7d === 0
            ? 'Prioritize reply tracking and Gmail triage before judging outreach quality from sends alone.'
            : null,
          publishedContent7d < 5
            ? 'Publish or refresh proof-backed AEO assets for DealVault, AI Receptionist, visibility, and funding prep.'
            : null,
          overdueTasks.length > 0
            ? 'Clear overdue admin tasks tied to hot leads, funding requests, or partner follow-ups.'
            : null,
        ]
      : [
          'Live Supabase reads are unavailable in this environment. Re-run the scorecards from a networked runner before treating any zero counts as real.',
        ]
  ).filter(Boolean) as string[]

  return {
    generatedAt: new Date().toISOString(),
    grade: getOverallGrade(redCount, yellowCount),
    liveDataReachable,
    dataSourceIssues,
    metrics,
    revenue: {
      trailing30Revenue,
      monthlyRevenueTarget,
      revenueGap: Math.max(0, monthlyRevenueTarget - trailing30Revenue),
      paidFundingRequests,
      hotFundingRequests,
      activePartnerConversations,
    },
    outreach: {
      dailyTarget,
      sentLeadEmails24h,
      partnerEmails24h,
      totalOutreach24h,
      sendReadyMessages,
      needsReviewMessages,
      usableEmailLeads,
      freshEmailReadyLeads,
      freshProductionEligibleEmailLeads,
      sentOrContactedLeads,
      replySignals7d,
      cityMix,
      sourceMix,
      offerMix,
      topBlocker:
        !liveDataReachable
          ? 'Live Supabase data is unavailable in this environment.'
          : sendReadyMessages === 0
          ? 'Qualified send-ready pool is empty.'
          : totalOutreach24h < dailyTarget
            ? 'Safe-send cadence is below target.'
            : 'Follow-up and replies are the next bottleneck.',
    },
    visibility: {
      publishedContent: publishedContent.length,
      publishedContent7d,
      indexedContent,
      latestReportDate: latestReport?.report_date || null,
      latestReportActions: latestReport?.recommended_actions || [],
      aeoScorecardCommand: 'npm run visibility:aeo-scorecard',
      indexingDryRunCommand: 'npm run visibility:indexing-dry-run',
    },
    operations: {
      openTasks: openTasks.length,
      urgentTasks: urgentTasks.length,
      overdueTasks: overdueTasks.length,
      successfulScrapeRuns24h,
      failedScrapeRuns24h,
      recentScrapeRuns: recentScrapeRuns.length,
    },
    capabilitySystem: [
      {
        name: 'Specialist agent swarms',
        status: 'active',
        proof: 'VestBlock Agent Board routes specialist agents by revenue, outreach, visibility, security, and product layer.',
      },
      {
        name: 'Reusable skills',
        status: 'active',
        proof: 'Operator skills live in .agents/skills/vestblock and are linked from CODEX_FAST_CONTEXT.',
      },
      {
        name: 'Daily scorecards',
        status: 'active',
        proof: 'Outreach, visibility, indexing, and revenue metrics are exposed from scripts and this page.',
      },
      {
        name: 'Browser QA',
        status: 'ready',
        proof: 'Production launch skill defines the browser QA ladder for local and live route checks.',
      },
      {
        name: 'Gmail reply triage',
        status: 'ready',
        proof: 'Gmail triage operator is read-only first and blocks sending without approval.',
      },
      {
        name: 'Vercel production monitoring',
        status: 'ready',
        proof: 'Release operator covers deployments, function errors, cron health, env drift, and domains.',
      },
      {
        name: 'GitHub discipline',
        status: 'ready',
        proof: 'GitHub discipline operator keeps branch, commit, PR, and dirty-worktree rules explicit.',
      },
      {
        name: 'Content factory',
        status: 'ready',
        proof: 'Content command center turns ideas into compliant posts, proof assets, sales PDFs, and repurposed content.',
      },
      {
        name: 'AEO authority map',
        status: 'active',
        proof: 'AI citation operator tracks entity, offer, proof, prompt, page, off-site mention, schema, and recheck cadence.',
      },
      {
        name: 'Self-learning logs',
        status: 'active',
        proof: 'Continuous improvement operator records signal, bottleneck, change, verification, and next experiment.',
      },
    ],
    nextActions: nextActions.slice(0, 7),
  }
}
