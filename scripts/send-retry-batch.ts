import { runDailyBuyerSend } from '@/lib/buyers/automation'
import { updateBuyerOutreachMessage } from '@/lib/buyers/repository'
import { runDailyLeadSendQueue } from '@/lib/leads/dailyAutomation'
import { updateOutreachMessage } from '@/lib/leads/repository'
import { runDailyLenderSend } from '@/lib/lenders/automation'
import { updateLenderOutreachMessage } from '@/lib/lenders/repository'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'
import { createAdminClient } from '@/lib/supabase/admin'

async function reapproveFailedLenderEmails(limit = 3) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lender_outreach_messages')
    .select('id,lender_id,send_error,lenders!inner(id,name,contact_email)')
    .eq('channel', 'email_intro')
    .eq('status', 'failed')
    .order('updated_at', { ascending: false })
    .limit(20)

  if (error) throw error

  const reapproved: string[] = []
  for (const row of (data || []) as any[]) {
    if (!isUsableContactEmail(row?.lenders?.contact_email)) continue
    await updateLenderOutreachMessage(row.id, {
      status: 'approved',
      send_error: null,
      approved_at: new Date().toISOString(),
    })
    reapproved.push(`${row.lenders.name} <${row.lenders.contact_email}>`)
    if (reapproved.length >= limit) break
  }

  return reapproved
}

async function reapproveFailedBuyerEmails(limit = 3) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('buyer_outreach_messages')
    .select('id,buyer_id,send_error,buyers!inner(id,name,contact_email)')
    .eq('channel', 'email_intro')
    .eq('status', 'failed')
    .order('updated_at', { ascending: false })
    .limit(20)

  if (error) throw error

  const reapproved: string[] = []
  for (const row of (data || []) as any[]) {
    if (!isUsableContactEmail(row?.buyers?.contact_email)) continue
    await updateBuyerOutreachMessage(row.id, {
      status: 'approved',
      send_error: null,
      approved_at: new Date().toISOString(),
    })
    reapproved.push(`${row.buyers.name} <${row.buyers.contact_email}>`)
    if (reapproved.length >= limit) break
  }

  return reapproved
}

async function reapproveFailedLeadEmails(limit = 3) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('outreach_messages')
    .select('id,lead_id,send_error,leads!inner(id,business_name,email)')
    .eq('channel', 'email')
    .eq('status', 'failed')
    .order('updated_at', { ascending: false })
    .limit(20)

  if (error) throw error

  const reapproved: string[] = []
  for (const row of (data || []) as any[]) {
    if (!isUsableContactEmail(row?.leads?.email)) continue
    await updateOutreachMessage(row.id, {
      status: 'approved',
      send_error: null,
      approved_at: new Date().toISOString(),
    })
    reapproved.push(`${row.leads.business_name || row.leads.id} <${row.leads.email}>`)
    if (reapproved.length >= limit) break
  }

  return reapproved
}

async function main() {
  process.env.LENDER_AUTO_SEND_ENABLED = 'true'
  process.env.BUYER_AUTO_SEND_ENABLED = 'true'
  process.env.AUTO_SEND_ENABLED = 'true'
  process.env.LEADS_AUTO_SEND_MIN_SCORE = process.env.LEADS_AUTO_SEND_MIN_SCORE || '70'

  const reapprovedLenders = await reapproveFailedLenderEmails(3)
  const reapprovedBuyers = await reapproveFailedBuyerEmails(3)
  const reapprovedLeads = await reapproveFailedLeadEmails(3)

  const lenderSend = await runDailyLenderSend(3)
  const buyerSend = await runDailyBuyerSend(3)
  const leadSend = await runDailyLeadSendQueue({ sendLimit: 5 })

  console.log(
    JSON.stringify(
      {
        ok: true,
        reapprovedLenders,
        reapprovedBuyers,
        reapprovedLeads,
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
