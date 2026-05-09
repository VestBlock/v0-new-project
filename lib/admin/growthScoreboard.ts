import type { SupabaseClient } from '@supabase/supabase-js'
import { adminTaskDueDates, createAdminTask } from '@/lib/admin/tasks'
import { logEvent } from '@/lib/system/logEvent'

type LeadRow = {
  id: string
  status?: string | null
  delivery_status?: string | null
  last_contacted_at?: string | null
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

type OutreachMessageRow = {
  id: string
  status?: string | null
  sent_at?: string | null
  updated_at?: string | null
}

type OutreachSendEventRow = {
  id: string
  channel?: string | null
  status?: string | null
  created_at?: string | null
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

function envInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export type HardScoreboard = {
  monthlyRevenueTarget: number
  trailing30Revenue: number
  revenueGap: number
  immediateRevenueAngle: string
  dailyCadence: {
    newLeads24h: { actual: number; target: number; status: 'on_track' | 'behind' }
    totalOutreach24h: { actual: number; target: number; status: 'on_track' | 'behind' }
    partnerOutreach24h: { actual: number; target: number; status: 'on_track' | 'behind' }
    replySignals7d: { actual: number; target: number; status: 'on_track' | 'behind' }
    bookedOrWon7d: { actual: number; target: number; status: 'on_track' | 'behind' }
  }
  pipeline: {
    leadEmailSends24h: number
    lenderOutreach24h: number
    buyerOutreach24h: number
    activeLenderConversations: number
    activeBuyerConversations: number
    approvedPartnerMessagesReady: number
    overduePartnerFollowups: number
    hotFundingRequests: number
  }
}

function hoursSince(value?: string | null) {
  if (!value) return Number.POSITIVE_INFINITY
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return Number.POSITIVE_INFINITY
  return (Date.now() - timestamp) / (1000 * 60 * 60)
}

function daysSince(value?: string | null) {
  return hoursSince(value) / 24
}

function isWithinDays(value: string | null | undefined, days: number) {
  return daysSince(value) <= days
}

function isWithinHours(value: string | null | undefined, hours: number) {
  return hoursSince(value) <= hours
}

export function computeHardScoreboard(input: {
  leads: LeadRow[]
  outreachSendEvents: OutreachSendEventRow[]
  lenders: PartnerRow[]
  lenderOutreachMessages: OutreachMessageRow[]
  buyers: PartnerRow[]
  buyerOutreachMessages: OutreachMessageRow[]
  fundingStrategyRequests: FundingStrategyRequestRow[]
  payments: PaymentRow[]
  fundingPayments: FundingPaymentRow[]
}) {
  const completedPayments = input.payments.filter((payment) =>
    ['completed', 'paid', 'succeeded'].includes(String(payment.status || '').toLowerCase())
  )
  const paidFundingPayments = input.fundingPayments.filter((payment) =>
    ['paid', 'completed'].includes(String(payment.status || '').toLowerCase())
  )
  const trailing30CompletedPayments = completedPayments.filter((payment) =>
    isWithinDays(payment.created_at || payment.updated_at, 30)
  )
  const trailing30FundingPayments = paidFundingPayments.filter((payment) =>
    isWithinDays(payment.created_at || payment.updated_at, 30)
  )
  const trailing30Revenue =
    trailing30CompletedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0) +
    trailing30FundingPayments.reduce((sum, payment) => sum + Number(payment.amount_paid || 0), 0)
  const monthlyRevenueTarget = 100000
  const newLeads24h = input.leads.filter((lead) => isWithinHours(lead.created_at, 24)).length
  const leadEmailSends24h = input.outreachSendEvents.filter(
    (event) =>
      String(event.status || '').toLowerCase() === 'sent' &&
      String(event.channel || '').toLowerCase() === 'email' &&
      isWithinHours(event.created_at, 24)
  ).length
  const lenderOutreach24h = input.lenderOutreachMessages.filter(
    (message) =>
      String(message.status || '').toLowerCase() === 'sent' &&
      isWithinHours(message.sent_at || message.updated_at, 24)
  ).length
  const buyerOutreach24h = input.buyerOutreachMessages.filter(
    (message) =>
      String(message.status || '').toLowerCase() === 'sent' &&
      isWithinHours(message.sent_at || message.updated_at, 24)
  ).length
  const totalOutreach24h = leadEmailSends24h + lenderOutreach24h + buyerOutreach24h
  const replySignals7d =
    input.leads.filter(
      (lead) =>
        ['replied', 'interested', 'qualified', 'closed_won'].includes(
          String(lead.status || '').toLowerCase()
        ) && isWithinDays(lead.updated_at || lead.created_at, 7)
    ).length +
    input.lenders.filter(
      (lender) =>
        ['responded', 'active_partner'].includes(
          String(lender.relationship_stage || '').toLowerCase()
        ) && isWithinDays(lender.last_contacted_at || lender.updated_at || lender.created_at, 7)
    ).length +
    input.buyers.filter(
      (buyer) =>
        ['responded', 'active_buyer'].includes(
          String(buyer.relationship_stage || '').toLowerCase()
        ) && isWithinDays(buyer.last_contacted_at || buyer.updated_at || buyer.created_at, 7)
    ).length
  const bookedOrWon7d =
    input.leads.filter(
      (lead) =>
        (String(lead.status || '').toLowerCase() === 'closed_won' ||
          String(lead.delivery_status || '').toLowerCase() === 'booked') &&
        isWithinDays(lead.updated_at || lead.created_at, 7)
    ).length +
    input.fundingStrategyRequests.filter(
      (request) =>
        ['strategy_ready', 'closed'].includes(String(request.status || '').toLowerCase()) &&
        isWithinDays(request.updated_at || request.created_at, 7)
    ).length
  const approvedPartnerMessagesReady =
    input.lenderOutreachMessages.filter(
      (message) => String(message.status || '').toLowerCase() === 'approved'
    ).length +
    input.buyerOutreachMessages.filter(
      (message) => String(message.status || '').toLowerCase() === 'approved'
    ).length
  const activeLenderConversations = input.lenders.filter((lender) =>
    ['contacted', 'responded', 'reviewing', 'active_partner'].includes(
      String(lender.relationship_stage || '').toLowerCase()
    )
  ).length
  const activeBuyerConversations = input.buyers.filter((buyer) =>
    ['contacted', 'responded', 'reviewing', 'active_buyer'].includes(
      String(buyer.relationship_stage || '').toLowerCase()
    )
  ).length
  const overduePartnerFollowups =
    input.lenders.filter(
      (lender) =>
        lender.next_follow_up_at &&
        new Date(lender.next_follow_up_at).getTime() < Date.now() &&
        !['dormant', 'paused', 'not_a_fit'].includes(
          String(lender.relationship_stage || '').toLowerCase()
        )
    ).length +
    input.buyers.filter(
      (buyer) =>
        buyer.next_follow_up_at &&
        new Date(buyer.next_follow_up_at).getTime() < Date.now() &&
        !['dormant', 'paused', 'not_a_fit'].includes(
          String(buyer.relationship_stage || '').toLowerCase()
        )
    ).length
  const hotFundingRequests = input.fundingStrategyRequests.filter(
    (request) =>
      ['submitted', 'paid', 'in_review', 'strategy_ready'].includes(
        String(request.status || '').toLowerCase()
      ) && Number(request.readiness_score || 0) >= 70
  ).length
  const hardScoreboardTargets = {
    monthlyRevenue: monthlyRevenueTarget,
    newLeads24h: 10,
    totalOutreach24h: envInt('LEADS_TARGET_EMAILS_PER_DAY', 100),
    partnerOutreach24h: 6,
    replySignals7d: 7,
    bookedOrWon7d: 3,
  }
  const immediateRevenueAngle =
    hotFundingRequests > 0
      ? 'Push funding-readiness and paid strategy conversions first. High-readiness funding requests are the fastest path to near-term cash.'
      : approvedPartnerMessagesReady >= 5
        ? 'Send approved lender and buyer outreach now. Partner conversations are queued and waiting, so speed-to-send is the fastest unlock.'
        : newLeads24h < hardScoreboardTargets.newLeads24h
          ? 'Lead flow is too soft. Lean harder into demand generation, higher-intent SEO output, and direct outreach that produces immediate conversations.'
          : totalOutreach24h < hardScoreboardTargets.totalOutreach24h
            ? 'Cadence is too low. Increase same-day contact volume across leads, lenders, and buyers before adding more complexity.'
            : 'Follow-up and conversion are the lever. The machine is creating movement, so tighten objections, routing, and close paths.'

  const hardScoreboard: HardScoreboard = {
    monthlyRevenueTarget,
    trailing30Revenue,
    revenueGap: Math.max(0, monthlyRevenueTarget - trailing30Revenue),
    immediateRevenueAngle,
    dailyCadence: {
      newLeads24h: {
        actual: newLeads24h,
        target: hardScoreboardTargets.newLeads24h,
        status: newLeads24h >= hardScoreboardTargets.newLeads24h ? 'on_track' : 'behind',
      },
      totalOutreach24h: {
        actual: totalOutreach24h,
        target: hardScoreboardTargets.totalOutreach24h,
        status: totalOutreach24h >= hardScoreboardTargets.totalOutreach24h ? 'on_track' : 'behind',
      },
      partnerOutreach24h: {
        actual: lenderOutreach24h + buyerOutreach24h,
        target: hardScoreboardTargets.partnerOutreach24h,
        status:
          lenderOutreach24h + buyerOutreach24h >= hardScoreboardTargets.partnerOutreach24h
            ? 'on_track'
            : 'behind',
      },
      replySignals7d: {
        actual: replySignals7d,
        target: hardScoreboardTargets.replySignals7d,
        status: replySignals7d >= hardScoreboardTargets.replySignals7d ? 'on_track' : 'behind',
      },
      bookedOrWon7d: {
        actual: bookedOrWon7d,
        target: hardScoreboardTargets.bookedOrWon7d,
        status: bookedOrWon7d >= hardScoreboardTargets.bookedOrWon7d ? 'on_track' : 'behind',
      },
    },
    pipeline: {
      leadEmailSends24h,
      lenderOutreach24h,
      buyerOutreach24h,
      activeLenderConversations,
      activeBuyerConversations,
      approvedPartnerMessagesReady,
      overduePartnerFollowups,
      hotFundingRequests,
    },
  }

  return hardScoreboard
}

export async function loadGrowthScoreboardTables(admin: SupabaseClient<any, any, any>) {
  const [
    leadsResult,
    outreachSendEventsResult,
    lendersResult,
    lenderOutreachMessagesResult,
    buyersResult,
    buyerOutreachMessagesResult,
    fundingStrategyRequestsResult,
    paymentsResult,
    fundingPaymentsResult,
  ] = await Promise.all([
    admin
      .from('leads')
      .select('id,status,delivery_status,last_contacted_at,created_at,updated_at')
      .limit(1000),
    admin
      .from('outreach_send_events')
      .select('id,channel,status,created_at')
      .limit(5000),
    admin
      .from('lenders')
      .select('id,relationship_stage,next_follow_up_at,last_contacted_at,created_at,updated_at')
      .limit(500),
    admin
      .from('lender_outreach_messages')
      .select('id,status,sent_at,updated_at')
      .limit(2000),
    admin
      .from('buyers')
      .select('id,relationship_stage,next_follow_up_at,last_contacted_at,created_at,updated_at')
      .limit(500),
    admin
      .from('buyer_outreach_messages')
      .select('id,status,sent_at,updated_at')
      .limit(2000),
    admin
      .from('funding_strategy_requests')
      .select('id,status,payment_status,readiness_score,created_at,updated_at')
      .limit(1000),
    admin
      .from('payments')
      .select('amount,status,created_at,updated_at')
      .limit(1000),
    admin
      .from('funding_payments')
      .select('amount_paid,status,created_at,updated_at')
      .limit(1000),
  ])

  if (leadsResult.error) throw leadsResult.error
  if (outreachSendEventsResult.error) throw outreachSendEventsResult.error
  if (lendersResult.error) throw lendersResult.error
  if (lenderOutreachMessagesResult.error) throw lenderOutreachMessagesResult.error
  if (buyersResult.error) throw buyersResult.error
  if (buyerOutreachMessagesResult.error) throw buyerOutreachMessagesResult.error
  if (fundingStrategyRequestsResult.error) throw fundingStrategyRequestsResult.error
  if (paymentsResult.error) throw paymentsResult.error
  if (fundingPaymentsResult.error) throw fundingPaymentsResult.error

  return {
    leads: (leadsResult.data || []) as LeadRow[],
    outreachSendEvents: (outreachSendEventsResult.data || []) as OutreachSendEventRow[],
    lenders: (lendersResult.data || []) as PartnerRow[],
    lenderOutreachMessages: (lenderOutreachMessagesResult.data || []) as OutreachMessageRow[],
    buyers: (buyersResult.data || []) as PartnerRow[],
    buyerOutreachMessages: (buyerOutreachMessagesResult.data || []) as OutreachMessageRow[],
    fundingStrategyRequests: (fundingStrategyRequestsResult.data || []) as FundingStrategyRequestRow[],
    payments: (paymentsResult.data || []) as PaymentRow[],
    fundingPayments: (fundingPaymentsResult.data || []) as FundingPaymentRow[],
  }
}

export async function runGrowthScoreboardMonitor(input: {
  admin: SupabaseClient<any, any, any>
  dryRun?: boolean
}) {
  const tables = await loadGrowthScoreboardTables(input.admin)
  const scoreboard = computeHardScoreboard(tables)
  const createdTasks: Array<{ metric: string; title: string }> = []

  const breaches = [
    {
      metric: 'new_leads_24h',
      data: scoreboard.dailyCadence.newLeads24h,
      title: 'Growth scoreboard: lead volume behind target',
      description:
        'New lead creation fell behind the daily target. Review traffic sources, scraping cadence, SEO output, and immediate lead-capture angles.',
      priority: 'urgent' as const,
    },
    {
      metric: 'total_outreach_24h',
      data: scoreboard.dailyCadence.totalOutreach24h,
      title: 'Growth scoreboard: total outreach behind target',
      description:
        'Combined lead, lender, and buyer outreach volume is behind target. Push same-day contact volume before adding new complexity.',
      priority: 'urgent' as const,
    },
    {
      metric: 'partner_outreach_24h',
      data: scoreboard.dailyCadence.partnerOutreach24h,
      title: 'Growth scoreboard: partner outreach behind target',
      description:
        'Lender and buyer outreach volume is behind target. Approved partner messages should be sent and new partner conversations should be opened.',
      priority: 'high' as const,
    },
    {
      metric: 'reply_signals_7d',
      data: scoreboard.dailyCadence.replySignals7d,
      title: 'Growth scoreboard: reply signals behind target',
      description:
        'Reply volume is weak. Audit messaging, objection handling, and follow-up timing to improve response quality.',
      priority: 'high' as const,
    },
    {
      metric: 'booked_or_won_7d',
      data: scoreboard.dailyCadence.bookedOrWon7d,
      title: 'Growth scoreboard: bookings and wins behind target',
      description:
        'Booked conversations or closed-won movement is below target. Prioritize the fastest-cash path and tighten conversion follow-through.',
      priority: 'urgent' as const,
    },
  ].filter((item) => item.data.status === 'behind')

  if (!input.dryRun) {
    for (const breach of breaches) {
      const result = await createAdminTask({
        title: breach.title,
        description: `${breach.description}\n\nCurrent: ${breach.data.actual}. Target: ${breach.data.target}. Immediate money path: ${scoreboard.immediateRevenueAngle}`,
        taskType: 'growth_scoreboard_breach',
        priority: breach.priority,
        entityType: 'growth_scoreboard',
        entityId: breach.metric,
        dueAt: adminTaskDueDates.now(),
        metadata: {
          metric: breach.metric,
          actual: breach.data.actual,
          target: breach.data.target,
          trailing30Revenue: scoreboard.trailing30Revenue,
          revenueGap: scoreboard.revenueGap,
          immediateRevenueAngle: scoreboard.immediateRevenueAngle,
        },
      })

      if (result.ok && !result.duplicate) {
        createdTasks.push({ metric: breach.metric, title: breach.title })
      }
    }

    await logEvent({
      eventType: 'admin_action',
      entityType: 'growth_scoreboard',
      entityId: 'daily_monitor',
      metadata: {
        breaches: breaches.map((breach) => ({
          metric: breach.metric,
          actual: breach.data.actual,
          target: breach.data.target,
        })),
        createdTaskCount: createdTasks.length,
        immediateRevenueAngle: scoreboard.immediateRevenueAngle,
      },
    })
  }

  return {
    ok: true,
    scoreboard,
    breaches: breaches.map((breach) => ({
      metric: breach.metric,
      actual: breach.data.actual,
      target: breach.data.target,
    })),
    createdTaskCount: createdTasks.length,
    createdTasks,
  }
}
