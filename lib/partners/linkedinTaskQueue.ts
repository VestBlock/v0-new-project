import { adminTaskDueDates, createAdminTask } from '@/lib/admin/tasks'
import { createAdminClient } from '@/lib/supabase/admin'
import { logEvent } from '@/lib/system/logEvent'

type QueueOptions = {
  dryRun?: boolean
  limit?: number
}

type QueueCandidate = {
  messageId: string
  partnerType: 'buyer' | 'lender' | 'investor'
  partnerId: string
  partnerName: string
  partnerWebsite: string | null
  contactName: string | null
  linkedinUrl: string | null
  body: string
  status: string
}

const eligibleStatuses = ['needs_review', 'approved', 'queued']

function positiveLimit(value: number | undefined) {
  return Number.isFinite(value) && Number(value) > 0
    ? Math.min(Math.floor(Number(value)), 100)
    : 40
}

async function findContact(
  table: 'buyer_contacts' | 'lender_contacts' | 'investor_contacts',
  ownerColumn: 'buyer_id' | 'lender_id' | 'investor_profile_id',
  ownerId: string,
  contactId: string | null
) {
  const admin = createAdminClient()
  if (contactId) {
    const { data } = await admin
      .from(table)
      .select('name,linkedin_url')
      .eq('id', contactId)
      .maybeSingle()
    if (data?.linkedin_url) return data
  }

  const { data } = await admin
    .from(table)
    .select('name,linkedin_url')
    .eq(ownerColumn, ownerId)
    .not('linkedin_url', 'is', null)
    .order('is_primary', { ascending: false })
    .order('confidence_score', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data || null
}

async function loadBuyerCandidates(limit: number): Promise<QueueCandidate[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('buyer_outreach_messages')
    .select('id,buyer_id,buyer_contact_id,body,status')
    .eq('channel', 'linkedin_dm')
    .in('status', eligibleStatuses)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw new Error(`Buyer LinkedIn queue failed: ${error.message}`)

  return Promise.all(
    (data || []).map(async (message) => {
      const [{ data: buyer }, contact] = await Promise.all([
        admin.from('buyers').select('name,website').eq('id', message.buyer_id).maybeSingle(),
        findContact('buyer_contacts', 'buyer_id', message.buyer_id, message.buyer_contact_id),
      ])
      return {
        messageId: message.id,
        partnerType: 'buyer' as const,
        partnerId: message.buyer_id,
        partnerName: buyer?.name || 'Buyer prospect',
        partnerWebsite: buyer?.website || null,
        contactName: contact?.name || null,
        linkedinUrl: contact?.linkedin_url || null,
        body: message.body,
        status: message.status,
      }
    })
  )
}

async function loadLenderCandidates(limit: number): Promise<QueueCandidate[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lender_outreach_messages')
    .select('id,lender_id,lender_contact_id,body,status')
    .eq('channel', 'linkedin_dm')
    .in('status', eligibleStatuses)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw new Error(`Lender LinkedIn queue failed: ${error.message}`)

  return Promise.all(
    (data || []).map(async (message) => {
      const [{ data: lender }, contact] = await Promise.all([
        admin.from('lenders').select('name,website').eq('id', message.lender_id).maybeSingle(),
        findContact('lender_contacts', 'lender_id', message.lender_id, message.lender_contact_id),
      ])
      return {
        messageId: message.id,
        partnerType: 'lender' as const,
        partnerId: message.lender_id,
        partnerName: lender?.name || 'Lender prospect',
        partnerWebsite: lender?.website || null,
        contactName: contact?.name || null,
        linkedinUrl: contact?.linkedin_url || null,
        body: message.body,
        status: message.status,
      }
    })
  )
}

async function loadInvestorCandidates(limit: number): Promise<QueueCandidate[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('investor_outreach_messages')
    .select('id,investor_profile_id,investor_contact_id,body,status')
    .eq('channel', 'linkedin_dm')
    .in('status', eligibleStatuses)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw new Error(`Investor LinkedIn queue failed: ${error.message}`)

  return Promise.all(
    (data || []).map(async (message) => {
      const [{ data: investor }, contact] = await Promise.all([
        admin
          .from('investor_profiles')
          .select('display_name,linkedin_url,website')
          .eq('id', message.investor_profile_id)
          .maybeSingle(),
        findContact(
          'investor_contacts',
          'investor_profile_id',
          message.investor_profile_id,
          message.investor_contact_id
        ),
      ])
      return {
        messageId: message.id,
        partnerType: 'investor' as const,
        partnerId: message.investor_profile_id,
        partnerName: investor?.display_name || 'Investor prospect',
        partnerWebsite: investor?.website || null,
        contactName: contact?.name || null,
        linkedinUrl: contact?.linkedin_url || investor?.linkedin_url || null,
        body: message.body,
        status: message.status,
      }
    })
  )
}

export async function runLinkedInTaskQueue(options: QueueOptions = {}) {
  const limit = positiveLimit(options.limit)
  const perLaneLimit = Math.max(1, Math.ceil(limit / 3))
  const candidates = (
    await Promise.all([
      loadBuyerCandidates(perLaneLimit),
      loadLenderCandidates(perLaneLimit),
      loadInvestorCandidates(perLaneLimit),
    ])
  )
    .flat()
    .slice(0, limit)

  const actionable = candidates.filter((candidate) => Boolean(candidate.linkedinUrl))
  const missingProfileUrl = candidates.filter((candidate) => !candidate.linkedinUrl)

  if (options.dryRun) {
    return {
      dryRun: true,
      scanned: candidates.length,
      actionable: actionable.length,
      missingProfileUrl: missingProfileUrl.length,
      preview: actionable.map((candidate) => ({
        messageId: candidate.messageId,
        partnerType: candidate.partnerType,
        partnerName: candidate.partnerName,
        contactName: candidate.contactName,
        linkedinUrl: candidate.linkedinUrl,
        status: candidate.status,
      })),
      enrichmentPreview: missingProfileUrl.map((candidate) => ({
        messageId: candidate.messageId,
        partnerType: candidate.partnerType,
        partnerName: candidate.partnerName,
        partnerWebsite: candidate.partnerWebsite,
        searchQuery: `site:linkedin.com/in \"${candidate.partnerName}\" ${candidate.partnerType}`,
      })),
    }
  }

  let created = 0
  let duplicates = 0
  let failed = 0
  let enrichmentTasksCreated = 0
  let enrichmentDuplicates = 0
  let enrichmentFailed = 0
  const failureReasons = new Set<string>()

  for (const candidate of actionable) {
    const result = await createAdminTask({
      title: `Send LinkedIn ${candidate.partnerType} message: ${candidate.partnerName}`,
      description: [
        candidate.contactName ? `Contact: ${candidate.contactName}` : null,
        `Profile: ${candidate.linkedinUrl}`,
        '',
        candidate.body,
        '',
        'Open the profile, verify the person and company still match, then send manually. Record the result in the relationship timeline.',
      ]
        .filter((line) => line !== null)
        .join('\n'),
      taskType: 'linkedin_manual_outreach',
      priority: candidate.status === 'approved' ? 'high' : 'normal',
      entityType: `${candidate.partnerType}_linkedin_message`,
      entityId: candidate.messageId,
      dueAt: adminTaskDueDates.days(1),
      metadata: {
        channel: 'linkedin_dm',
        deliveryMode: 'manual_verified',
        partnerType: candidate.partnerType,
        partnerId: candidate.partnerId,
        partnerName: candidate.partnerName,
        contactName: candidate.contactName,
        linkedinUrl: candidate.linkedinUrl,
        messageStatus: candidate.status,
      },
      createdBy: 'linkedin-task-queue',
    })

    if (!result.ok) {
      failed += 1
      if (result.error) failureReasons.add(result.error)
    }
    else if (result.duplicate) duplicates += 1
    else created += 1
  }

  for (const candidate of missingProfileUrl) {
    const searchQuery = `site:linkedin.com/in \"${candidate.partnerName}\" ${candidate.partnerType}`
    const result = await createAdminTask({
      title: `Find verified LinkedIn contact: ${candidate.partnerName}`,
      description: [
        `Company: ${candidate.partnerName}`,
        candidate.partnerWebsite ? `Website: ${candidate.partnerWebsite}` : null,
        `Suggested search: ${searchQuery}`,
        '',
        'Find a decision-maker profile, verify that the person still works at this company, and save the verified LinkedIn URL on the partner contact before outreach is approved.',
      ]
        .filter((line) => line !== null)
        .join('\n'),
      taskType: 'linkedin_profile_enrichment',
      priority: candidate.status === 'approved' ? 'high' : 'normal',
      entityType: `${candidate.partnerType}_linkedin_profile_enrichment`,
      entityId: candidate.messageId,
      dueAt: adminTaskDueDates.days(1),
      metadata: {
        channel: 'linkedin_dm',
        deliveryMode: 'manual_enrichment_required',
        partnerType: candidate.partnerType,
        partnerId: candidate.partnerId,
        partnerName: candidate.partnerName,
        partnerWebsite: candidate.partnerWebsite,
        messageId: candidate.messageId,
        messageStatus: candidate.status,
        searchQuery,
      },
      createdBy: 'linkedin-task-queue',
    })

    if (!result.ok) {
      enrichmentFailed += 1
      if (result.error) failureReasons.add(result.error)
    }
    else if (result.duplicate) enrichmentDuplicates += 1
    else enrichmentTasksCreated += 1
  }

  await logEvent({
    eventType: 'admin_action',
    entityType: 'linkedin_task_batch',
    metadata: {
      source: 'linkedin-task-queue',
      scanned: candidates.length,
      actionable: actionable.length,
      missingProfileUrl: missingProfileUrl.length,
      created,
      duplicates,
      failed,
      enrichmentTasksCreated,
      enrichmentDuplicates,
      enrichmentFailed,
      failureReasons: Array.from(failureReasons).slice(0, 5),
    },
  })

  return {
    dryRun: false,
    scanned: candidates.length,
    actionable: actionable.length,
    missingProfileUrl: missingProfileUrl.length,
    created,
    duplicates,
    failed,
    enrichmentTasksCreated,
    enrichmentDuplicates,
    enrichmentFailed,
    failureReasons: Array.from(failureReasons).slice(0, 5),
  }
}
