import { createClient } from '@supabase/supabase-js'

import { buildMailboxFalsePositiveRepairPlan } from './lib/mailbox-false-positive-repair.mjs'

const apply = process.argv.includes('--apply')
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error(JSON.stringify({ ok: false, error: 'missing_supabase_admin_configuration' }))
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const SEND_STATUSES = ['accepted', 'sent', 'delivered', 'opened', 'clicked', 'replied']
const REPLY_TASK_TYPES = [
  'buyer_reply_buy_box_capture',
  'lender_reply_box_capture',
  'lender_reply_criteria_capture',
  'investor_reply_buy_box_capture',
  'seller_reply_qualification',
]
const REPAIR_WINDOW_START = process.env.MAILBOX_INTEGRITY_REPAIR_SINCE || '2026-09-01T00:00:00.000Z'

function chunks(values, size = 100) {
  const result = []
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size))
  return result
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

async function selectByEmailChunks({ table, column, values, select, configure }) {
  const rows = []
  for (const chunk of chunks(values)) {
    for (let offset = 0; ; offset += 1000) {
      let query = admin.from(table).select(select).in(column, chunk)
      if (configure) query = configure(query)
      const { data, error } = await query.range(offset, offset + 999)
      if (error) throw error
      rows.push(...(data || []))
      if ((data || []).length < 1000) break
    }
  }
  return rows
}

async function loadReplyRows() {
  const rows = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin
      .from('command_center_reply_memory')
      .select('id,message_id,thread_id,from_email,subject,reply_summary,classification,metadata_json,received_at')
      .gte('received_at', REPAIR_WINDOW_START)
      .order('received_at', { ascending: false })
      .range(offset, offset + 999)
    if (error) throw error
    rows.push(...(data || []))
    if ((data || []).length < 1000) break
  }
  return rows
}

async function loadReplyTasks() {
  const rows = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin
      .from('admin_tasks')
      .select('id,task_type,status,metadata_json')
      .in('task_type', REPLY_TASK_TYPES)
      .in('status', ['open', 'in_progress', 'waiting'])
      .gte('created_at', REPAIR_WINDOW_START)
      .range(offset, offset + 999)
    if (error) throw error
    rows.push(...(data || []))
    if ((data || []).length < 1000) break
  }
  return rows
}

async function loadPlanInputs() {
  const replyRows = await loadReplyRows()

  const senderEmails = Array.from(
    new Set(replyRows.map((row) => normalizeEmail(row.from_email)).filter(Boolean))
  )

  const enrollmentRows = senderEmails.length
    ? await selectByEmailChunks({
        table: 'command_center_outbound_enrollments',
        column: 'recipient',
        values: senderEmails,
        select: 'recipient,status,last_message_id,metadata_json,created_at,updated_at',
        configure: (query) => query.eq('channel', 'email').in('status', SEND_STATUSES),
      })
    : []
  const sendEventRows = senderEmails.length
    ? await selectByEmailChunks({
        table: 'outreach_send_events',
        column: 'recipient',
        values: senderEmails,
        select: 'recipient,status,outreach_message_id,metadata_json,created_at',
        configure: (query) => query.eq('channel', 'email').in('status', SEND_STATUSES),
      })
    : []

  const [tasks, suppressions, buyers] = await Promise.all([
    loadReplyTasks(),
    senderEmails.length
      ? selectByEmailChunks({
          table: 'lead_suppressions',
          column: 'email',
          values: senderEmails,
          select: 'id,email,status,reason',
          configure: (query) =>
            query
              .eq('status', 'active')
              .eq('reason', 'Explicit email opt-out received in Outlook.')
              .gte('created_at', REPAIR_WINDOW_START),
        })
      : [],
    senderEmails.length
      ? selectByEmailChunks({
          table: 'buyers',
          column: 'contact_email',
          values: senderEmails,
          select: 'id,contact_email,source,relationship_stage,outreach_status,metadata_json',
          configure: (query) => query.eq('source', 'outlook_partner_reply').gte('created_at', REPAIR_WINDOW_START),
        })
      : [],
  ])

  return {
    replyRows,
    outboundRows: [...enrollmentRows, ...sendEventRows],
    tasks,
    suppressions,
    buyers,
  }
}

async function applyPlan(plan, inputs) {
  const now = new Date().toISOString()
  const applied = {
    repliesReclassified: 0,
    footerFlagsReconciled: 0,
    tasksDismissed: 0,
    suppressionsReleased: 0,
    leadDeliveryFlagsReleased: 0,
    buyersQuarantined: 0,
  }

  for (const row of plan.replyUpdates) {
    const { data, error } = await admin
      .from('command_center_reply_memory')
      .update({
        classification: 'low_priority',
        next_step: 'No outbound correlation. Keep out of revenue and reply queues.',
        metadata_json: {
          ...row.metadata,
          correlatedOutbound: false,
          actionableReply: false,
          suppressionAuthorized: false,
          integrityRepair: {
            repairedAt: now,
            reason: 'uncorrelated_campaign_like_inbound',
            originalClassification: row.originalClassification,
          },
        },
        updated_at: now,
      })
      .eq('id', row.id)
      .eq('classification', row.originalClassification)
      .select('id')
    if (error) throw error
    applied.repliesReclassified += data?.length || 0
  }

  for (const row of plan.footerUpdates) {
    const existingIntegrityRepair =
      row.metadata?.integrityRepair &&
      typeof row.metadata.integrityRepair === 'object' &&
      !Array.isArray(row.metadata.integrityRepair)
        ? row.metadata.integrityRepair
        : {}
    const { data, error } = await admin
      .from('command_center_reply_memory')
      .update({
        metadata_json: {
          ...row.metadata,
          explicitOptOut: false,
          suppressionAuthorized: false,
          integrityRepair: {
            ...existingIntegrityRepair,
            outlookFooterFalseOptOut: true,
            footerRepairedAt: now,
          },
        },
        updated_at: now,
      })
      .eq('id', row.id)
      .select('id')
    if (error) throw error
    if (!data?.length) throw new Error('Outlook footer integrity marker was not saved.')
    applied.footerFlagsReconciled += data.length
  }

  if (plan.taskIds.length) {
    const { data, error } = await admin
      .from('admin_tasks')
      .update({ status: 'dismissed', completed_at: now, updated_at: now })
      .in('id', plan.taskIds)
      .in('status', ['open', 'in_progress', 'waiting'])
      .in('task_type', REPLY_TASK_TYPES)
      .select('id')
    if (error) throw error
    applied.tasksDismissed = data?.length || 0
  }

  for (const email of plan.suppressionEmails) {
    const { data, error } = await admin
      .from('leads')
      .update({ delivery_status: 'not_sent', suppression_reason: null, updated_at: now })
      .eq('email', email)
      .eq('delivery_status', 'suppressed')
      .eq('suppression_reason', 'Explicit email opt-out.')
      .select('id')
    if (error) throw error
    applied.leadDeliveryFlagsReleased += data?.length || 0
  }

  // Release the source suppression only after every exact lead flag has been
  // reconciled. The durable reply marker above also lets a retry recover the
  // email cohort if a prior process stopped after this release.
  if (plan.suppressionIds.length) {
    const { data, error } = await admin
      .from('lead_suppressions')
      .update({ status: 'released', updated_at: now })
      .in('id', plan.suppressionIds)
      .eq('status', 'active')
      .eq('reason', 'Explicit email opt-out received in Outlook.')
      .select('id')
    if (error) throw error
    applied.suppressionsReleased = data?.length || 0
  }

  const buyersById = new Map(inputs.buyers.map((buyer) => [String(buyer.id), buyer]))
  for (const buyerId of plan.buyerIds) {
    const buyer = buyersById.get(buyerId)
    if (!buyer) continue
    const { data, error } = await admin
      .from('buyers')
      .update({
        relationship_stage: 'not_a_fit',
        outreach_status: 'do_not_contact',
        next_follow_up_at: null,
        metadata_json: {
          ...(buyer.metadata_json || {}),
          integrityRepair: {
            repairedAt: now,
            reason: 'uncorrelated_outlook_partner_false_positive',
          },
        },
        updated_at: now,
      })
      .eq('id', buyerId)
      .eq('source', 'outlook_partner_reply')
      .select('id')
    if (error) throw error
    applied.buyersQuarantined += data?.length || 0
  }

  return applied
}

try {
  const inputs = await loadPlanInputs()
  const plan = buildMailboxFalsePositiveRepairPlan(inputs)
  const appliedCounts = apply
      ? await applyPlan(plan, inputs)
      : {
          repliesReclassified: 0,
          footerFlagsReconciled: 0,
          tasksDismissed: 0,
        suppressionsReleased: 0,
        leadDeliveryFlagsReleased: 0,
        buyersQuarantined: 0,
      }

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: apply ? 'apply' : 'dry_run',
        selected: plan.counts,
        applied: appliedCounts,
      },
      null,
      2
    )
  )
} catch (error) {
  console.error(
    JSON.stringify({
      ok: false,
      error: 'mailbox_false_positive_repair_failed',
      code: typeof error?.code === 'string' ? error.code : null,
    })
  )
  process.exit(1)
}
