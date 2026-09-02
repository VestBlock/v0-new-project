import { addDays, format } from 'date-fns'

import { sendEmail } from '@/lib/email/sendEmail'
import {
  getDailyGrowthReportByDate,
  replaceDailyGrowthReportSections,
  upsertDailyGrowthReport,
} from '@/lib/reporting/repository'
import type { DailyIntelligenceSummary } from '@/lib/reporting/types'
import { countUniqueProviderAcceptedSends } from '@/lib/outreach/delivery-status'
import { createAdminClient } from '@/lib/supabase/admin'
import { logEvent } from '@/lib/system/logEvent'

function compact<T>(values: Array<T | null | undefined | false>) {
  return values.filter(Boolean) as T[]
}

function asNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function rankEntries(map: Map<string, number>, limit = 8) {
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}

function cityKey(city?: string | null, state?: string | null) {
  return [city, state].filter(Boolean).join(', ')
}

function bestLabel(entries: Array<{ label: string; value: number }>) {
  return entries[0]?.label || null
}

function summaryMetric(section: Record<string, unknown>, key: string) {
  return asNumber(section[key])
}

const nonReportableNiches = new Set([
  'dealmachine_export_needed',
  'contact_enrichment_required',
  'skip_trace_required',
])

function isReportableNiche(value?: string | null) {
  return Boolean(value && !nonReportableNiches.has(value.toLowerCase()))
}

function jobIsBlocked(job: { status?: string | null; last_status?: string | null }) {
  return ['blocked', 'failed', 'disconnected'].includes(String(job.status || '').toLowerCase()) ||
    ['blocked', 'failed', 'disconnected'].includes(String(job.last_status || '').toLowerCase())
}

function jobIsDelayed(job: { status?: string | null; next_run_at?: string | null }, now = Date.now()) {
  if (['paused', 'blocked', 'failed', 'disconnected'].includes(String(job.status || '').toLowerCase())) return false
  const nextRunAt = Date.parse(String(job.next_run_at || ''))
  return Number.isFinite(nextRunAt) && nextRunAt < now - 90 * 60 * 1000
}

function buildDigestHtml(summary: DailyIntelligenceSummary) {
  const actions = summary.recommendedActions.map((item) => `<li style="margin-bottom:8px;">${item}</li>`).join('')
  const leadSends = summaryMetric(summary.leads, 'sends')
  const leadReplies = summaryMetric(summary.leads, 'replies')
  const buyerSends = summaryMetric(summary.buyers, 'outreachSent')
  const buyerApproved = summaryMetric(summary.buyers, 'outreachApproved')
  const lenderSends = summaryMetric(summary.lenders, 'outreachSent')
  const lenderReplies = summaryMetric(summary.lenders, 'respondedLenders')
  const propertyCandidates = summaryMetric(summary.leads, 'propertyCandidates')
  const contactableLeads = summaryMetric(summary.leads, 'contactableLeads')
  const contactEnrichmentRequired = summaryMetric(summary.leads, 'contactEnrichmentRequired')
  const automationStatus = String(summary.automation.status || 'unavailable')
  const activeJobs = summaryMetric(summary.automation, 'activeJobs')
  const blockedJobs = summaryMetric(summary.automation, 'blockedJobs')
  const delayedJobs = summaryMetric(summary.automation, 'delayedJobs')
  const latestStrategyStatus = String(summary.automation.latestStrategyStatus || 'not yet recorded')
  return `
    <div style="font-family:Arial,sans-serif;background:#081019;color:#eef6f8;padding:24px;">
      <h2 style="color:#fff;margin:0 0 12px;">VestBlock daily intelligence report</h2>
      <p style="margin:0 0 16px;color:#a7c0c7;">
        Best city: <strong>${summary.bestCity || 'n/a'}</strong> ·
        Best niche: <strong>${summary.bestNiche || 'n/a'}</strong> ·
        Best SEO opportunity: <strong>${summary.bestSeoOpportunity || 'n/a'}</strong>
      </p>
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 18px;">
        <tr><td style="padding:8px;border:1px solid #29404a;">Seller outreach</td><td style="padding:8px;border:1px solid #29404a;">${leadSends} provider-accepted · ${leadReplies} replies</td></tr>
        <tr><td style="padding:8px;border:1px solid #29404a;">Seller inventory</td><td style="padding:8px;border:1px solid #29404a;">${propertyCandidates} properties · ${contactableLeads} contactable · ${contactEnrichmentRequired} need enrichment</td></tr>
        <tr><td style="padding:8px;border:1px solid #29404a;">Buyer outreach</td><td style="padding:8px;border:1px solid #29404a;">${buyerSends} sent · ${buyerApproved} approved/queued</td></tr>
        <tr><td style="padding:8px;border:1px solid #29404a;">Lender outreach</td><td style="padding:8px;border:1px solid #29404a;">${lenderSends} sent · ${lenderReplies} replies</td></tr>
        <tr><td style="padding:8px;border:1px solid #29404a;">Automation health</td><td style="padding:8px;border:1px solid #29404a;">${automationStatus} · ${activeJobs} active · ${blockedJobs} blocked · ${delayedJobs} delayed · strategy ${latestStrategyStatus}</td></tr>
      </table>
      <h3 style="color:#fff;margin:18px 0 8px;">Recommended actions</h3>
      <ul>${actions}</ul>
    </div>
  `
}

export async function generateDailyIntelligenceReport(options: { dryRun?: boolean } = {}) {
  const admin = createAdminClient()
  const reportDate = format(new Date(), 'yyyy-MM-dd')
  const startedAt = addDays(new Date(), -1).toISOString()

  const [
    leadsResult,
    sendEventsResult,
    outreachMessagesResult,
    lendersResult,
    lenderMessagesResult,
    buyersResult,
    buyerMessagesResult,
    buyerMatchesResult,
    usersResult,
    reportsResult,
    jobsResult,
    paymentsResult,
    serviceDeliverablesResult,
    contentAssetsResult,
    seoOpportunitiesResult,
    automationJobsResult,
    strategyReportsResult,
  ] = await Promise.all([
    admin
      .from('leads')
      .select('id,city,state,niche,best_offer,category,email,phone,property_address,source,metadata_json,lead_score,outreach_status,language_segment,created_at')
      .gte('created_at', startedAt),
    admin
      .from('outreach_send_events')
      .select('id,status,lead_id,outreach_message_id,created_at')
      .gte('created_at', startedAt),
    admin
      .from('outreach_messages')
      .select('id,status,lead_id,updated_at')
      .gte('updated_at', startedAt),
    admin
      .from('lenders')
      .select('id,category,headquarters_city,headquarters_state,relationship_stage,last_scored_at,last_outreach_generated_at,created_at')
      .or(`created_at.gte.${startedAt},last_scored_at.gte.${startedAt},last_outreach_generated_at.gte.${startedAt}`),
    admin
      .from('lender_outreach_messages')
      .select('id,status,created_at,updated_at')
      .or(`created_at.gte.${startedAt},updated_at.gte.${startedAt}`),
    admin
      .from('buyers')
      .select('id,category,headquarters_city,headquarters_state,relationship_stage,last_scored_at,last_outreach_generated_at,created_at')
      .or(`created_at.gte.${startedAt},last_scored_at.gte.${startedAt},last_outreach_generated_at.gte.${startedAt}`),
    admin
      .from('buyer_outreach_messages')
      .select('id,status,created_at,updated_at')
      .or(`created_at.gte.${startedAt},updated_at.gte.${startedAt}`),
    admin
      .from('buyer_matches')
      .select('id,city,state,created_at')
      .gte('created_at', startedAt),
    admin
      .from('user_profiles')
      .select('id,user_id,email,full_name,is_subscribed,created_at')
      .gte('created_at', startedAt),
    admin
      .from('credit_reports')
      .select('id,user_id,uploaded_at,updated_at')
      .gte('uploaded_at', startedAt),
    admin
      .from('analysis_jobs')
      .select('id,status,created_at,updated_at')
      .gte('created_at', startedAt),
    admin
      .from('payments')
      .select('id,status,amount,created_at')
      .gte('created_at', startedAt),
    admin
      .from('service_deliverables')
      .select('id,status,generated_at,customer_sent_at,customer_viewed_at')
      .gte('created_at', startedAt),
    admin
      .from('content_assets')
      .select('id,title,slug,status,service_key,language,published_at,updated_at,indexed_status')
      .or(`published_at.gte.${startedAt},updated_at.gte.${startedAt}`),
    admin
      .from('entity_seo_opportunities')
      .select('id,suggested_title,city,state,entity_type,cluster_type,opportunity_score,approval_status,publish_status,created_at')
      .gte('created_at', startedAt),
    admin
      .from('command_center_jobs')
      .select('job_key,title,status,last_status,last_error,last_run_at,next_run_at,updated_at')
      .limit(200),
    admin
      .from('strategy_daily_reports')
      .select('report_date,status,cities_attempted,sources_attempted,leads_discovered,leads_qualified,drafts_created,accepted_count,delivered_count,reply_count,updated_at')
      .order('report_date', { ascending: false })
      .limit(1),
  ])

  if (leadsResult.error) throw leadsResult.error
  if (sendEventsResult.error) throw sendEventsResult.error
  if (outreachMessagesResult.error) throw outreachMessagesResult.error
  if (lendersResult.error) throw lendersResult.error
  if (lenderMessagesResult.error) throw lenderMessagesResult.error
  if (buyersResult.error) throw buyersResult.error
  if (buyerMessagesResult.error) throw buyerMessagesResult.error
  if (buyerMatchesResult.error) throw buyerMatchesResult.error
  if (usersResult.error) throw usersResult.error
  if (reportsResult.error) throw reportsResult.error
  if (jobsResult.error) throw jobsResult.error
  if (paymentsResult.error) throw paymentsResult.error
  if (serviceDeliverablesResult.error) throw serviceDeliverablesResult.error
  if (contentAssetsResult.error) throw contentAssetsResult.error
  if (seoOpportunitiesResult.error) throw seoOpportunitiesResult.error

  const leads = leadsResult.data || []
  const sendEvents = sendEventsResult.data || []
  const outreachMessages = outreachMessagesResult.data || []
  const lenders = lendersResult.data || []
  const lenderMessages = lenderMessagesResult.data || []
  const buyers = buyersResult.data || []
  const buyerMessages = buyerMessagesResult.data || []
  const buyerMatches = buyerMatchesResult.data || []
  const users = usersResult.data || []
  const reports = reportsResult.data || []
  const jobs = jobsResult.data || []
  const payments = paymentsResult.data || []
  const serviceDeliverables = serviceDeliverablesResult.data || []
  const contentAssets = contentAssetsResult.data || []
  const seoOpportunities = seoOpportunitiesResult.data || []
  const automationJobs = automationJobsResult.error ? [] : automationJobsResult.data || []
  const latestStrategyReport = strategyReportsResult.error ? null : strategyReportsResult.data?.[0] || null

  const leadCities = new Map<string, number>()
  const leadNiches = new Map<string, number>()
  const leadOffers = new Map<string, number>()
  const leadCategories = new Map<string, number>()

  for (const lead of leads) {
    const city = cityKey(lead.city, lead.state)
    if (city) leadCities.set(city, (leadCities.get(city) || 0) + 1)
    if (isReportableNiche(lead.niche)) {
      leadNiches.set(lead.niche, (leadNiches.get(lead.niche) || 0) + 1)
    }
    if (lead.best_offer) leadOffers.set(lead.best_offer, (leadOffers.get(lead.best_offer) || 0) + 1)
    if (lead.category) leadCategories.set(lead.category, (leadCategories.get(lead.category) || 0) + 1)
  }

  const lenderCategories = new Map<string, number>()
  const lenderMarkets = new Map<string, number>()
  for (const lender of lenders) {
    if (lender.category) lenderCategories.set(lender.category, (lenderCategories.get(lender.category) || 0) + 1)
    const market = cityKey(lender.headquarters_city, lender.headquarters_state)
    if (market) lenderMarkets.set(market, (lenderMarkets.get(market) || 0) + 1)
  }

  const buyerCategories = new Map<string, number>()
  const buyerMarkets = new Map<string, number>()
  for (const buyer of buyers) {
    if (buyer.category) buyerCategories.set(buyer.category, (buyerCategories.get(buyer.category) || 0) + 1)
    const market = cityKey(buyer.headquarters_city, buyer.headquarters_state)
    if (market) buyerMarkets.set(market, (buyerMarkets.get(market) || 0) + 1)
  }

  const seoClusters = new Map<string, number>()
  const seoCities = new Map<string, number>()
  for (const opportunity of seoOpportunities) {
    seoClusters.set(opportunity.cluster_type, (seoClusters.get(opportunity.cluster_type) || 0) + 1)
    const market = cityKey(opportunity.city, opportunity.state)
    if (market) seoCities.set(market, (seoCities.get(market) || 0) + 1)
  }

  const topCities = rankEntries(
    new Map<string, number>([
      ...Array.from(leadCities.entries()),
      ...Array.from(lenderMarkets.entries()).map(([label, value]) => [label, (leadCities.get(label) || 0) + value] as [string, number]),
      ...Array.from(buyerMarkets.entries()).map(([label, value]) => [label, ((leadCities.get(label) || 0) + (lenderMarkets.get(label) || 0) + value)] as [string, number]),
    ]),
    10
  )
  const topNiches = rankEntries(leadNiches, 10)
  const topOffers = rankEntries(leadOffers, 10)

  const contactableLeads = leads.filter((lead) => Boolean(lead.email || lead.phone))
  const propertyCandidates = leads.filter((lead) => Boolean(lead.property_address))
  const contactEnrichmentRequired = propertyCandidates.filter(
    (lead) => !lead.email && !lead.phone
  )

  const leadsSummary = {
    newLeadsToday: leads.length,
    propertyCandidates: propertyCandidates.length,
    contactableLeads: contactableLeads.length,
    contactEnrichmentRequired: contactEnrichmentRequired.length,
    scoredLeads: leads.filter((lead) => asNumber(lead.lead_score) > 0).length,
    emailReadyLeads: leads.filter((lead) => !!lead.email).length,
    outreachReadyLeads: contactableLeads.filter((lead) =>
      ['needs_review', 'approved', 'queued'].includes(String(lead.outreach_status || ''))
    ).length,
    replies: sendEvents.filter((event) => event.status === 'replied').length,
    sends: countUniqueProviderAcceptedSends(sendEvents),
    approvals: outreachMessages.filter((message) => message.status === 'approved').length,
    topCities: topCities.slice(0, 5),
    topNiches: topNiches.slice(0, 5),
    topOffers: topOffers.slice(0, 5),
  }

  const lendersSummary = {
    newLendersDiscovered: lenders.filter((row) => new Date(row.created_at).toISOString() >= startedAt).length,
    lendersScored: lenders.filter((row) => row.last_scored_at && row.last_scored_at >= startedAt).length,
    outreachDrafted: lenders.filter((row) => row.last_outreach_generated_at && row.last_outreach_generated_at >= startedAt).length,
    outreachApproved: lenderMessages.filter((row) => row.status === 'approved').length,
    outreachSent: lenderMessages.filter((row) => row.status === 'sent').length,
    outreachFailed: lenderMessages.filter((row) => row.status === 'failed').length,
    respondedLenders: lenders.filter((row) => row.relationship_stage === 'responded').length,
    activePartners: lenders.filter((row) => row.relationship_stage === 'active_partner').length,
    strongestCategories: rankEntries(lenderCategories, 5),
    strongestMarkets: rankEntries(lenderMarkets, 5),
  }

  const buyersSummary = {
    newBuyersDiscovered: buyers.filter((row) => new Date(row.created_at).toISOString() >= startedAt).length,
    buyersScored: buyers.filter((row) => row.last_scored_at && row.last_scored_at >= startedAt).length,
    outreachDrafted: buyers.filter((row) => row.last_outreach_generated_at && row.last_outreach_generated_at >= startedAt).length,
    outreachApproved: buyerMessages.filter((row) => row.status === 'approved').length,
    outreachSent: buyerMessages.filter((row) => row.status === 'sent').length,
    outreachFailed: buyerMessages.filter((row) => row.status === 'failed').length,
    respondedBuyers: buyers.filter((row) => ['responded', 'reviewing', 'active_buyer'].includes(row.relationship_stage)).length,
    activeBuyers: buyers.filter((row) => row.relationship_stage === 'active_buyer').length,
    propertyMatchesCreated: buyerMatches.length,
    topBuyerCategories: rankEntries(buyerCategories, 5),
    topBuyerMarkets: rankEntries(buyerMarkets, 5),
  }

  const paidUsers = payments.filter((payment) => String(payment.status).toLowerCase() === 'completed').length
  const completedAnalyses = jobs.filter((job) => String(job.status).toLowerCase() === 'completed').length
  const stalledUsers = Math.max(0, users.length - reports.length)
  const usersSummary = {
    newUsers: users.length,
    uploads: reports.length,
    completedAnalyses,
    paidUsers,
    serviceRequests: serviceDeliverables.length,
    stalledUsers,
    noUploadUsers: stalledUsers,
  }

  const publishedToday = contentAssets.filter((asset) => asset.published_at && asset.published_at >= startedAt)
  const queuedPages = seoOpportunities.filter((row) => row.publish_status === 'queued')
  const spanishPages = contentAssets.filter((asset) => asset.language === 'es')
  const bestSeoOpportunity = seoOpportunities.sort((a, b) => b.opportunity_score - a.opportunity_score)[0] || null
  const seoSummary = {
    pagesPublishedToday: publishedToday.length,
    pagesQueued: queuedPages.length,
    bestPerformingClusters: rankEntries(seoClusters, 5),
    spanishPagesAdded: spanishPages.length,
    nextRecommendedClusters: seoOpportunities
      .sort((a, b) => b.opportunity_score - a.opportunity_score)
      .slice(0, 5)
      .map((row) => row.suggested_title),
    entityDerivedOpportunitiesCreated: seoOpportunities.length,
  }

  const activeAutomationJobs = automationJobs.filter((job) => String(job.status || '').toLowerCase() === 'active')
  const blockedAutomationJobs = automationJobs.filter(jobIsBlocked)
  const delayedAutomationJobs = automationJobs.filter((job) => jobIsDelayed(job))
  const automationUnavailable = Boolean(automationJobsResult.error || strategyReportsResult.error)
  const automationSummary = {
    status: automationUnavailable
      ? 'unavailable'
      : blockedAutomationJobs.length
        ? 'needs_attention'
        : delayedAutomationJobs.length
          ? 'delayed'
          : 'healthy',
    activeJobs: activeAutomationJobs.length,
    blockedJobs: blockedAutomationJobs.length,
    delayedJobs: delayedAutomationJobs.length,
    blockedJobNames: blockedAutomationJobs.slice(0, 5).map((job) => job.title || job.job_key),
    latestStrategyStatus: latestStrategyReport?.status || 'not_yet_recorded',
    latestStrategyReportDate: latestStrategyReport?.report_date || null,
    latestStrategyUpdatedAt: latestStrategyReport?.updated_at || null,
    latestStrategyDrafts: asNumber(latestStrategyReport?.drafts_created),
    latestStrategyAccepted: asNumber(latestStrategyReport?.accepted_count),
    latestStrategyDelivered: asNumber(latestStrategyReport?.delivered_count),
    latestStrategyReplies: asNumber(latestStrategyReport?.reply_count),
    dataWarning: automationJobsResult.error?.message || strategyReportsResult.error?.message || null,
  }

  const recommendedActions = compact<string>([
    automationSummary.status === 'unavailable'
      ? 'Automation health could not be read. Check the command-center data connection before acting on volume.'
      : null,
    automationSummary.blockedJobs > 0
      ? `${automationSummary.blockedJobs} automation job${automationSummary.blockedJobs === 1 ? '' : 's'} need repair: ${automationSummary.blockedJobNames.join(', ')}.`
      : null,
    automationSummary.delayedJobs > 0
      ? `${automationSummary.delayedJobs} scheduled job${automationSummary.delayedJobs === 1 ? ' is' : 's are'} overdue by more than 90 minutes; review the command-center execution history.`
      : null,
    leadsSummary.contactEnrichmentRequired > 0
      ? `${leadsSummary.contactEnrichmentRequired} property candidates need verified phone or email enrichment before outreach.`
      : null,
    leadsSummary.emailReadyLeads > 20 ? `Work the ${leadsSummary.emailReadyLeads} email-ready leads first.` : null,
    lendersSummary.outreachApproved === 0 && lendersSummary.outreachDrafted > 0 ? 'Approve lender outreach so the partner pipeline can start moving.' : null,
    buyersSummary.propertyMatchesCreated === 0 ? 'Push more seller and real-estate property intakes so buyer matching can build real history.' : null,
    seoSummary.pagesQueued > 0 ? `Review the ${seoSummary.pagesQueued} queued SEO opportunities.` : null,
    usersSummary.noUploadUsers > 0 ? `Nudge ${usersSummary.noUploadUsers} new users who still have not uploaded a report.` : null,
  ])

  const summary: DailyIntelligenceSummary = {
    reportDate,
    leads: leadsSummary,
    lenders: lendersSummary,
    buyers: buyersSummary,
    users: usersSummary,
    seo: seoSummary,
    automation: automationSummary,
    topCities,
    topNiches,
    topOffers,
    bestCity: bestLabel(topCities),
    bestNiche: bestLabel(topNiches),
    bestLeadCategory: bestLabel(rankEntries(leadCategories, 5)),
    bestLenderSegment: bestLabel(rankEntries(lenderCategories, 5)),
    bestBuyerSegment: bestLabel(rankEntries(buyerCategories, 5)),
    bestSeoOpportunity: bestSeoOpportunity?.suggested_title || null,
    recommendedActions,
  }

  if (options.dryRun) {
    return summary
  }

  const report = await upsertDailyGrowthReport({
    reportDate,
    leadsSummary,
    lendersSummary,
    buyersSummary,
    usersSummary,
    seoSummary,
    topCities,
    topNiches,
    topOffers,
    recommendedActions,
    summary: {
      bestCity: summary.bestCity,
      bestNiche: summary.bestNiche,
      bestLeadCategory: summary.bestLeadCategory,
      bestLenderSegment: summary.bestLenderSegment,
      bestBuyerSegment: summary.bestBuyerSegment,
      bestSeoOpportunity: summary.bestSeoOpportunity,
      automationStatus: automationSummary.status,
      blockedAutomationJobs: automationSummary.blockedJobs,
      delayedAutomationJobs: automationSummary.delayedJobs,
    },
  })

  await replaceDailyGrowthReportSections(report.id, [
    { sectionKey: 'leads', sectionTitle: 'Leads', summary: leadsSummary },
    { sectionKey: 'lenders', sectionTitle: 'Lenders', summary: lendersSummary },
    { sectionKey: 'buyers', sectionTitle: 'Buyers', summary: buyersSummary },
    { sectionKey: 'users', sectionTitle: 'Users', summary: usersSummary },
    { sectionKey: 'seo', sectionTitle: 'SEO', summary: seoSummary },
    { sectionKey: 'automation', sectionTitle: 'Automation health', summary: automationSummary },
  ])

  await logEvent({
    eventType: 'admin_action',
    entityType: 'daily_growth_report',
    entityId: report.id,
    metadata: {
      reportDate,
      bestCity: summary.bestCity,
      bestNiche: summary.bestNiche,
    },
  })

  const reportRecipient = (
    process.env.OPERATIONS_REPORT_EMAIL ||
    process.env.OUTREACH_ALERT_EMAIL ||
    process.env.ACQUISITIONS_ALERT_EMAIL ||
    process.env.ADMIN_ALERT_EMAIL ||
    'acquisitions@vestblock.io'
  ).trim()
  let delivery: Awaited<ReturnType<typeof sendEmail>> | null = null
  if (reportRecipient) {
    delivery = await sendEmail({
      to: reportRecipient,
      subject: `VestBlock daily intelligence: ${summary.bestCity || 'operations'}`,
      html: buildDigestHtml(summary),
      eventType: 'admin_lead_run_daily_report',
    })
    if (!delivery.ok) {
      await logEvent({
        eventType: 'admin_action',
        entityType: 'daily_growth_report',
        entityId: report.id,
        metadata: {
          action: 'daily_report_delivery_failed',
          reportDate,
          recipient: reportRecipient,
          error: delivery.error || 'Unknown delivery failure.',
        },
      })
    }
  }

  const deliverySnapshot = {
    attempted: Boolean(reportRecipient),
    ok: Boolean(delivery?.ok),
    recipient: reportRecipient || null,
    provider: delivery?.provider || null,
    providerMessageId: delivery?.id || null,
    error: delivery?.error || null,
    attemptedAt: new Date().toISOString(),
  }
  const { error: deliveryPersistError } = await createAdminClient()
    .from('daily_growth_reports')
    .update({
      summary_json: {
        ...(report.summary_json || {}),
        delivery: deliverySnapshot,
      },
    })
    .eq('id', report.id)
  if (deliveryPersistError) {
    console.warn('[daily-intelligence] delivery status could not be persisted:', deliveryPersistError.message)
  }

  const storedReport = await getDailyGrowthReportByDate(reportDate)
  return { ...storedReport, delivery }
}
