import { publishEntitySeoOpportunity } from '@/lib/content/entitySeoExpansion'
import { runDailyBuyerPipeline, runDailyBuyerSend } from '@/lib/buyers/automation'
import { updateBuyerOutreachMessage, updateBuyerRecord } from '@/lib/buyers/repository'
import { runDailyLenderPipeline, runDailyLenderSend } from '@/lib/lenders/automation'
import { updateLenderOutreachMessage, updateLenderRecord } from '@/lib/lenders/repository'
import { runDailyLeadSendQueue } from '@/lib/leads/dailyAutomation'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'
import { listEntitySeoOpportunities } from '@/lib/reporting/repository'
import { createAdminClient } from '@/lib/supabase/admin'

async function publishQueuedSeoPages() {
  const rows = await listEntitySeoOpportunities({ limit: 500 })
  const toPublish = rows.filter(
    (row) =>
      row.publish_status === 'queued' &&
      row.cluster_type !== 'named_partner_profile' &&
      ['ready', 'approved', 'suggested'].includes(row.approval_status)
  )

  const published: string[] = []
  for (const row of toPublish) {
    await publishEntitySeoOpportunity(row.id)
    published.push(row.suggested_slug)
  }

  return { queuedEligible: toPublish.length, publishedCount: published.length, published }
}

async function approveLenderEmails(limit = 3) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lender_outreach_messages')
    .select('*, lenders(*)')
    .eq('channel', 'email_intro')
    .eq('status', 'needs_review')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error

  const preferredNames = [
    'Bank Five Nine',
    'Wisconsin Mortgage Group',
    'Ethan Brooks - Refined Mortgage Group',
    'Joonago Mortgage Services NMLS 249858',
    'Structured Lending Co',
  ]

  const approved: Array<{ lenderId: string; messageId: string; name: string; email: string }> = []
  const candidates = (data || [])
    .filter((row: any) => isUsableContactEmail(row?.lenders?.contact_email))
    .sort((a: any, b: any) => {
      const aPreferred = preferredNames.includes(a?.lenders?.name || '') ? 1 : 0
      const bPreferred = preferredNames.includes(b?.lenders?.name || '') ? 1 : 0
      return bPreferred - aPreferred
    })
    .slice(0, limit)

  for (const row of candidates as any[]) {
    await updateLenderOutreachMessage(row.id, {
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by_user_id: null,
    })
    await updateLenderRecord(row.lender_id, { outreach_status: 'approved' })
    approved.push({
      lenderId: row.lender_id,
      messageId: row.id,
      name: row.lenders.name,
      email: row.lenders.contact_email,
    })
  }

  return approved
}

async function approveBuyerEmails(limit = 3) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('buyer_outreach_messages')
    .select('*, buyers(*)')
    .eq('channel', 'email_intro')
    .eq('status', 'needs_review')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error

  const preferredNames = [
    'Sell My House Fast Chicagoland',
    'Phoenix Investors LLC',
    'We Buy Houses Milwaukee',
    'Brookline Real Estate & Investments',
    'Locust Investments | Buying Homes Cash',
  ]

  const approved: Array<{ buyerId: string; messageId: string; name: string; email: string }> = []
  const candidates = (data || [])
    .filter((row: any) => isUsableContactEmail(row?.buyers?.contact_email))
    .sort((a: any, b: any) => {
      const aPreferred = preferredNames.includes(a?.buyers?.name || '') ? 1 : 0
      const bPreferred = preferredNames.includes(b?.buyers?.name || '') ? 1 : 0
      return bPreferred - aPreferred
    })
    .slice(0, limit)

  for (const row of candidates as any[]) {
    await updateBuyerOutreachMessage(row.id, {
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by_user_id: null,
    })
    await updateBuyerRecord(row.buyer_id, { outreach_status: 'approved' })
    approved.push({
      buyerId: row.buyer_id,
      messageId: row.id,
      name: row.buyers.name,
      email: row.buyers.contact_email,
    })
  }

  return approved
}

async function main() {
  process.env.LENDER_AUTO_SEND_ENABLED = 'true'
  process.env.BUYER_AUTO_SEND_ENABLED = 'true'
  process.env.AUTO_SEND_ENABLED = 'true'
  process.env.LEADS_AUTO_SEND_MIN_SCORE = process.env.LEADS_AUTO_SEND_MIN_SCORE || '70'

  const seo = await publishQueuedSeoPages()
  const lenderPipeline = await runDailyLenderPipeline({ dryRun: false })
  const buyerPipeline = await runDailyBuyerPipeline({ dryRun: false })

  const approvedLenders = await approveLenderEmails(3)
  const approvedBuyers = await approveBuyerEmails(3)

  const lenderSend = await runDailyLenderSend(3)
  const buyerSend = await runDailyBuyerSend(3)
  const leadSend = await runDailyLeadSendQueue({ sendLimit: 5 })

  console.log(
    JSON.stringify(
      {
        ok: true,
        seo,
        lenderPipeline,
        buyerPipeline,
        approvedLenders,
        approvedBuyers,
        lenderSend,
        buyerSend,
        leadSend,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
