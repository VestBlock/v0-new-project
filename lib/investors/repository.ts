import { createAdminClient } from '@/lib/supabase/admin'
import { buildInvestorOutreachMessage, inferFollowUpTasks } from '@/lib/investors/outreach'
import {
  buildInvestorPipelineMetadata,
  buildInvestorPipelineSnapshot,
  buildInvestorPipelineSnapshotFromRecord,
} from '@/lib/investors/pipeline'
import { calculateInvestorScore } from '@/lib/investors/scoring'
import type {
  InvestorDashboardSummary,
  InvestorOutreachStatus,
  InvestorProfileRecord,
  InvestorRelationshipStage,
  NormalizedInvestorInput,
} from '@/lib/investors/types'

function cleanArray(values?: string[] | null) {
  return Array.from(new Set((values || []).map((value) => value.trim()).filter(Boolean)))
}

function sourceIdentityFor(input: NormalizedInvestorInput) {
  if (input.sourceIdentity) return input.sourceIdentity
  if (input.contactEmail) return `email:${input.contactEmail.toLowerCase()}`
  if (input.website) return `website:${input.website.toLowerCase()}`
  return null
}

export async function upsertInvestorProfile(input: NormalizedInvestorInput) {
  const admin = createAdminClient()
  const score = calculateInvestorScore(input)
  const sourceIdentity = sourceIdentityFor(input)
  let existing: InvestorProfileRecord | null = null

  if (sourceIdentity) {
    const { data } = await admin
      .from('investor_profiles')
      .select('*')
      .eq('metadata_json->>sourceIdentity', sourceIdentity)
      .maybeSingle()
    existing = (data as InvestorProfileRecord | null) || null
  }

  const sourceConfidenceScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (input.evidence || []).reduce((sum, row) => sum + (row.confidenceScore || 50), 0) /
          Math.max(1, input.evidence?.length || 1)
      )
    )
  )
  const pipeline = buildInvestorPipelineSnapshot({
    relationshipStage: existing?.relationship_stage,
    outreachStatus: existing?.outreach_status,
    contactEmail: input.contactEmail || existing?.contact_email,
    contactPhone: input.contactPhone || existing?.contact_phone,
    website: input.website || existing?.website,
    markets: input.markets || existing?.markets,
    propertyTypes: input.propertyTypes || existing?.property_types,
    classificationTags: input.classificationTags || existing?.classification_tags,
    estimatedBuyBox: input.estimatedBuyBox || existing?.estimated_buy_box,
    metadata: {
      ...((existing?.metadata_json || {}) as Record<string, unknown>),
      ...(input.metadata || {}),
      ...(sourceIdentity ? { sourceIdentity } : {}),
    },
    sourceConfidenceScore: sourceConfidenceScore || existing?.source_confidence_score,
    sourceNames: input.sourceNames || existing?.source_names,
    sourceEvidenceCount: input.evidence?.length,
    displayName: input.displayName || existing?.display_name,
    primaryInvestorType: input.primaryInvestorType || existing?.primary_investor_type,
    notes: input.notes || existing?.notes,
  })
  const preserveRelationshipStage =
    existing?.relationship_stage &&
    ['contacted', 'followup_due', 'responded', 'qualified', 'active_buyer', 'active_borrower', 'active_seller', 'active_partner', 'revenue_opportunity', 'paused', 'not_a_fit'].includes(
      existing.relationship_stage
    )
      ? existing.relationship_stage
      : null
  const preserveOutreachStatus =
    existing?.outreach_status &&
    ['queued', 'sent', 'responded', 'followup_due', 'failed', 'do_not_contact'].includes(existing.outreach_status)
      ? existing.outreach_status
      : null
  const relationshipStage =
    preserveRelationshipStage ||
    (pipeline.stage === 'discovered'
      ? 'discovered'
      : pipeline.stage === 'outreach_ready'
        ? 'outreach_ready'
        : 'researched')
  const outreachStatus = preserveOutreachStatus || (pipeline.outreachReady ? 'draft_ready' : 'not_started')
  const payload = {
    display_name: input.displayName,
    person_name: input.personName || null,
    llc_name: input.llcName || null,
    company_name: input.companyName || null,
    primary_investor_type: input.primaryInvestorType || 'fix_and_flip',
    classification_tags: cleanArray(input.classificationTags),
    contact_email: input.contactEmail || null,
    contact_phone: input.contactPhone || null,
    website: input.website || null,
    linkedin_url: input.linkedinUrl || null,
    facebook_url: input.facebookUrl || null,
    markets: cleanArray(input.markets),
    property_types: cleanArray(input.propertyTypes),
    estimated_buy_box: input.estimatedBuyBox || {},
    financing_indicators: cleanArray(input.financingIndicators),
    source_names: cleanArray(input.sourceNames),
    source_confidence_score: sourceConfidenceScore,
    recent_activity_score: score.recentActivity,
    transaction_volume_score: score.transactionVolume,
    geographic_fit_score: score.geographicFit,
    financing_need_score: score.financingNeed,
    disposition_need_score: score.dispositionNeed,
    partnership_potential_score: score.partnershipPotential,
    partnership_score: score.partnershipScore,
    deal_flow_fit: score.dealFlowFit,
    disposition_fit: score.dispositionFit,
    financing_fit: score.financingFit,
    partnership_fit: score.partnershipFit,
    assigned_sequence: score.assignedSequence,
    outreach_status: outreachStatus,
    relationship_stage: relationshipStage,
    notes: input.notes || existing?.notes || score.fitSummary,
    last_scored_at: new Date().toISOString(),
    metadata_json: buildInvestorPipelineMetadata(
      {
        relationshipStage,
        outreachStatus,
        contactEmail: input.contactEmail || existing?.contact_email,
        contactPhone: input.contactPhone || existing?.contact_phone,
        website: input.website || existing?.website,
        markets: input.markets || existing?.markets,
        propertyTypes: input.propertyTypes || existing?.property_types,
        classificationTags: input.classificationTags || existing?.classification_tags,
        estimatedBuyBox: input.estimatedBuyBox || existing?.estimated_buy_box,
        metadata: {
          ...((existing?.metadata_json || {}) as Record<string, unknown>),
          ...(input.metadata || {}),
        },
        sourceConfidenceScore,
        sourceNames: input.sourceNames || existing?.source_names,
        sourceEvidenceCount: input.evidence?.length,
        displayName: input.displayName || existing?.display_name,
        primaryInvestorType: input.primaryInvestorType || existing?.primary_investor_type,
        notes: input.notes || existing?.notes,
      },
      {
        ...(sourceIdentity ? { sourceIdentity } : {}),
        scoreSummary: score.fitSummary,
      }
    ),
    automation_flags_json: {
      ...((existing?.automation_flags_json || {}) as Record<string, unknown>),
      researchGate: {
        ready: pipeline.researchReady,
        outreachReady: pipeline.outreachReady,
        blockedReasons: pipeline.blockedReasons,
        nextAction: pipeline.nextAction,
      },
    },
  }

  let investor: InvestorProfileRecord
  if (existing?.id) {
    const { data, error } = existing?.id
      ? await admin
          .from('investor_profiles')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select('*')
          .single()
      : await admin.from('investor_profiles').insert(payload).select('*').single()
    if (error) throw error
    investor = data as InvestorProfileRecord
  } else {
    const { data, error } = await admin.from('investor_profiles').insert(payload).select('*').single()
    if (error) throw error
    investor = data as InvestorProfileRecord
  }

  if (input.transactions?.length) {
    await admin.from('investor_transactions').delete().eq('investor_profile_id', investor.id)
    const { error } = await admin.from('investor_transactions').insert(
      input.transactions.map((transaction) => ({
        investor_profile_id: investor.id,
        property_address: transaction.propertyAddress || null,
        city: transaction.city || null,
        state: transaction.state || null,
        zip_code: transaction.zipCode || null,
        property_type: transaction.propertyType || null,
        transaction_type: transaction.transactionType || 'purchase',
        transaction_date: transaction.transactionDate || null,
        purchase_price: transaction.purchasePrice ?? null,
        sale_price: transaction.salePrice ?? null,
        estimated_rehab: transaction.estimatedRehab ?? null,
        estimated_profit: transaction.estimatedProfit ?? null,
        financing_type: transaction.financingType || null,
        source_type: transaction.sourceType || null,
        source_url: transaction.sourceUrl || null,
        metadata_json: transaction.metadata || {},
      }))
    )
    if (error) throw error
  }

  if (input.evidence?.length) {
    const { error } = await admin.from('investor_source_evidence').insert(
      input.evidence.map((evidence) => ({
        investor_profile_id: investor.id,
        source_type: evidence.sourceType,
        source_name: evidence.sourceName || null,
        source_url: evidence.sourceUrl || null,
        external_id: evidence.externalId || null,
        record_date: evidence.recordDate || null,
        confidence_score: evidence.confidenceScore ?? 50,
        evidence_summary: evidence.evidenceSummary || null,
        raw_payload: evidence.rawPayload || {},
      }))
    )
    if (error) throw error
  }

  if (investor.contact_email || investor.contact_phone || investor.linkedin_url) {
    const contactPayload = {
      investor_profile_id: investor.id,
      name: investor.person_name || investor.display_name,
      email: investor.contact_email,
      phone: investor.contact_phone,
      linkedin_url: investor.linkedin_url,
      is_primary: true,
      confidence_score: investor.contact_email ? 85 : 60,
    }

    if (investor.contact_email) {
      const { data: existingContact } = await admin
        .from('investor_contacts')
        .select('id')
        .eq('investor_profile_id', investor.id)
        .ilike('email', investor.contact_email)
        .maybeSingle()

      if (existingContact?.id) {
        await admin.from('investor_contacts').update(contactPayload).eq('id', existingContact.id)
      } else {
        await admin.from('investor_contacts').insert(contactPayload)
      }
    } else {
      await admin.from('investor_contacts').insert(contactPayload)
    }
  }

  return investor
}

export async function listInvestorProfiles(filters: {
  search?: string | null
  market?: string | null
  investorType?: string | null
  relationshipStage?: string | null
  outreachStatus?: string | null
  sequence?: string | null
  lane?: string | null
  page?: number
  limit?: number
}) {
  const admin = createAdminClient()
  const page = filters.page || 1
  const limit = filters.limit || 100
  const offset = (page - 1) * limit

  let query = admin.from('investor_profiles').select('*', { count: 'exact' })
  if (filters.market && filters.market !== 'all') query = query.contains('markets', [filters.market])
  if (filters.investorType && filters.investorType !== 'all') query = query.eq('primary_investor_type', filters.investorType)
  if (filters.relationshipStage && filters.relationshipStage !== 'all') query = query.eq('relationship_stage', filters.relationshipStage)
  if (filters.outreachStatus && filters.outreachStatus !== 'all') query = query.eq('outreach_status', filters.outreachStatus)
  if (filters.sequence && filters.sequence !== 'all') query = query.eq('assigned_sequence', filters.sequence)
  if (filters.lane === 'builder') {
    query = query.overlaps('classification_tags', ['builder_partner', 'developer_partner', 'construction_company'])
  }
  if (filters.search) {
    const cleaned = filters.search.replace(/[,%()]/g, ' ').trim()
    if (cleaned) {
      query = query.or(
        [
          `display_name.ilike.%${cleaned}%`,
          `person_name.ilike.%${cleaned}%`,
          `llc_name.ilike.%${cleaned}%`,
          `company_name.ilike.%${cleaned}%`,
          `contact_email.ilike.%${cleaned}%`,
          `contact_phone.ilike.%${cleaned}%`,
          `website.ilike.%${cleaned}%`,
        ].join(',')
      )
    }
  }

  const [{ data, error, count }, summary] = await Promise.all([
    query.order('partnership_score', { ascending: false }).order('updated_at', { ascending: false }).range(offset, offset + limit - 1),
    getInvestorDashboardSummary(),
  ])

  if (error) throw error
  return {
    investors: (data || []) as InvestorProfileRecord[],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
    summary,
  }
}

export async function getInvestorDashboardSummary(): Promise<InvestorDashboardSummary> {
  const admin = createAdminClient()
  const [{ data: investors }, { data: opportunities }, { data: events }] = await Promise.all([
    admin
      .from('investor_profiles')
      .select(
        'partnership_score,relationship_stage,outreach_status,markets,classification_tags,source_confidence_score,estimated_buy_box,metadata_json,contact_email,contact_phone,website,property_types,display_name,primary_investor_type,notes'
      )
      .limit(2000),
    admin.from('investor_opportunities').select('opportunity_type,status').neq('status', 'archived').limit(2000),
    admin.from('investor_engagement_events').select('event_type').limit(2000),
  ])

  const rows = investors || []
  const opportunityRows = opportunities || []
  const eventRows = events || []
  const pipelineRows = rows.map((row) => ({
    row,
    pipeline: buildInvestorPipelineSnapshot({
      relationshipStage: row.relationship_stage,
      outreachStatus: row.outreach_status,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      website: row.website,
      markets: row.markets,
      propertyTypes: row.property_types,
      classificationTags: row.classification_tags,
      estimatedBuyBox: row.estimated_buy_box,
      metadata: row.metadata_json,
      sourceConfidenceScore: row.source_confidence_score,
      displayName: row.display_name,
      primaryInvestorType: row.primary_investor_type,
      notes: row.notes,
    }),
  }))
  const countBy = (items: string[]) =>
    Object.entries(
      items.reduce<Record<string, number>>((acc, item) => {
        acc[item] = (acc[item] || 0) + 1
        return acc
      }, {})
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value]) => ({ label, value }))

  return {
    total: rows.length,
    averageScore: rows.length ? Math.round(rows.reduce((sum, row) => sum + Number(row.partnership_score || 0), 0) / rows.length) : 0,
    activeBuyers: rows.filter((row) => row.relationship_stage === 'active_buyer').length,
    activeBorrowers: rows.filter((row) => row.relationship_stage === 'active_borrower').length,
    activeSellers: rows.filter((row) => row.relationship_stage === 'active_seller').length,
    lendingOpportunities: opportunityRows.filter((row) => row.opportunity_type === 'lending_opportunity' || row.opportunity_type === 'funding_request').length,
    partnershipOpportunities: opportunityRows.filter((row) => row.opportunity_type === 'partnership_opportunity').length,
    revenueOpportunities: opportunityRows.filter((row) => row.opportunity_type === 'revenue_opportunity').length,
    outreachReady: pipelineRows.filter((item) => item.pipeline.outreachReady).length,
    researchReady: pipelineRows.filter((item) => item.pipeline.researchReady).length,
    buyBoxInferred: pipelineRows.filter((item) => item.pipeline.buyBoxInferred).length,
    buyBoxConfirmed: pipelineRows.filter((item) => item.pipeline.buyBoxConfirmed).length,
    builderPartners: pipelineRows.filter((item) => item.pipeline.builderLane).length,
    dealMachineAligned: pipelineRows.filter((item) => item.pipeline.dealMachineAligned).length,
    replies: eventRows.filter((row) => row.event_type === 'reply').length,
    callsBooked: eventRows.filter((row) => row.event_type === 'call_booked').length,
    fundingClosed: eventRows.filter((row) => row.event_type === 'funding_closed').length,
    markets: countBy(rows.flatMap((row) => row.markets || [])),
    classifications: countBy(rows.flatMap((row) => row.classification_tags || [])),
  }
}

export async function generateInvestorOutreach(investorId: string, status: 'needs_review' | 'approved' = 'needs_review') {
  const admin = createAdminClient()
  const { data: investor, error } = await admin.from('investor_profiles').select('*').eq('id', investorId).single()
  if (error) throw error
  const investorRecord = investor as InvestorProfileRecord
  const pipeline = buildInvestorPipelineSnapshotFromRecord(investorRecord)
  if (!pipeline.outreachReady) {
    throw new Error(
      `Partner is not ready for outreach yet: ${pipeline.blockedReasons.join(', ') || 'finish research and confirm criteria first'}.`
    )
  }

  const message = buildInvestorOutreachMessage(investorRecord)
  const { data, error: messageError } = await admin
    .from('investor_outreach_messages')
    .upsert(
      {
        investor_profile_id: investorId,
        sequence_code: message.sequenceCode,
        step_number: 1,
        channel: 'email',
        subject: message.subject,
        body: message.body,
        cta: message.cta,
        status,
        generated_with: 'vestblock-investor-engine',
        last_generated_at: new Date().toISOString(),
      },
      { onConflict: 'investor_profile_id,sequence_code,step_number,channel' }
    )
    .select('*')
    .single()

  if (messageError) throw messageError

  await admin
    .from('investor_profiles')
    .update({
      outreach_status: status,
      relationship_stage: ['contacted', 'responded', 'followup_due'].includes(investorRecord.relationship_stage)
        ? investorRecord.relationship_stage
        : 'outreach_ready',
      last_outreach_generated_at: new Date().toISOString(),
      metadata_json: buildInvestorPipelineMetadata(
        {
          relationshipStage: 'outreach_ready',
          outreachStatus: status,
          contactEmail: investorRecord.contact_email,
          contactPhone: investorRecord.contact_phone,
          website: investorRecord.website,
          markets: investorRecord.markets,
          propertyTypes: investorRecord.property_types,
          classificationTags: investorRecord.classification_tags,
          estimatedBuyBox: investorRecord.estimated_buy_box,
          metadata: investorRecord.metadata_json,
          sourceConfidenceScore: investorRecord.source_confidence_score,
          sourceNames: investorRecord.source_names,
          displayName: investorRecord.display_name,
          primaryInvestorType: investorRecord.primary_investor_type,
          notes: investorRecord.notes,
        },
        { lastOutreachGeneratedAt: new Date().toISOString() }
      ),
    })
    .eq('id', investorId)

  return data
}

export async function bulkUpdateInvestors(input: {
  investorIds: string[]
  action: string
  actorUserId?: string | null
}) {
  const admin = createAdminClient()
  const ids = input.investorIds
  if (!ids.length) return { updated: 0 }

  if (input.action === 'generate_outreach') {
    await Promise.all(ids.map((id) => generateInvestorOutreach(id)))
    return { updated: ids.length }
  }

  if (input.action === 'approve_outreach') {
    await Promise.all(ids.map((id) => generateInvestorOutreach(id, 'approved')))
    return { updated: ids.length }
  }

  const updates: Record<string, unknown> = {}
  const now = new Date().toISOString()
  if (input.action === 'mark_researched') updates.relationship_stage = 'researched'
  if (input.action === 'mark_buy_box_inferred') updates.relationship_stage = 'researched'
  if (input.action === 'confirm_buy_box') updates.relationship_stage = 'qualified'
  if (input.action === 'queue_outreach') updates.outreach_status = 'queued'
  if (input.action === 'mark_sent') {
    updates.outreach_status = 'sent'
    updates.relationship_stage = 'contacted'
    updates.last_contacted_at = now
    updates.next_follow_up_at = new Date(Date.now() + 4 * 86400000).toISOString()
  }
  if (input.action === 'mark_responded') {
    updates.outreach_status = 'responded'
    updates.relationship_stage = 'responded'
  }
  if (input.action === 'active_partner') updates.relationship_stage = 'active_partner'
  if (input.action === 'do_not_contact') updates.outreach_status = 'do_not_contact'

  if (!Object.keys(updates).length) throw new Error(`Unsupported investor bulk action: ${input.action}`)

  const { error } = await admin.from('investor_profiles').update(updates).in('id', ids)
  if (error) throw error

  await admin.from('investor_engagement_events').insert(
    ids.map((id) => ({
      investor_profile_id: id,
      event_type: 'manual_status_change',
      event_value: input.action,
      metadata_json: { actorUserId: input.actorUserId || null },
    }))
  )

  return { updated: ids.length }
}

export async function updateInvestorProfile(
  id: string,
  updates: {
    relationshipStage?: InvestorRelationshipStage
    outreachStatus?: InvestorOutreachStatus
    notes?: string | null
    routingOwner?: string | null
    nextFollowUpAt?: string | null
  }
) {
  const admin = createAdminClient()
  const payload = {
    relationship_stage: updates.relationshipStage,
    outreach_status: updates.outreachStatus,
    notes: updates.notes,
    routing_owner: updates.routingOwner,
    next_follow_up_at: updates.nextFollowUpAt,
  }
  const { data, error } = await admin
    .from('investor_profiles')
    .update(Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)))
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data as InvestorProfileRecord
}

export async function updateInvestorRecord(id: string, updates: Record<string, unknown>) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('investor_profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data as InvestorProfileRecord
}

export async function listInvestorsForScoring(limit = 100) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('investor_profiles')
    .select('*')
    .or('last_scored_at.is.null,last_scored_at.lt.' + new Date(Date.now() - 7 * 86400000).toISOString())
    .order('updated_at', { ascending: true })
    .limit(limit)

  if (error) throw error
  return (data || []) as InvestorProfileRecord[]
}

export async function listInvestorsNeedingOutreach(limit = 50) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('investor_profiles')
    .select('*')
    .in('outreach_status', ['draft_ready', 'not_started'])
    .not('outreach_status', 'eq', 'do_not_contact')
    .order('partnership_score', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(Math.max(limit * 4, 100))

  if (error) throw error
  return ((data || []) as InvestorProfileRecord[])
    .filter((investor) => {
      if (['paused', 'not_a_fit'].includes(investor.relationship_stage)) return false
      const pipeline = buildInvestorPipelineSnapshotFromRecord(investor)
      return pipeline.outreachReady
    })
    .slice(0, limit)
}

export async function listInvestorsNeedingFollowup(limit = 30) {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { data, error } = await admin
    .from('investor_profiles')
    .select('*')
    .in('outreach_status', ['sent', 'responded', 'followup_due'])
    .lte('next_follow_up_at', now)
    .order('next_follow_up_at', { ascending: true })
    .limit(limit)

  if (error) throw error
  return (data || []) as InvestorProfileRecord[]
}

export async function listApprovedInvestorEmailOutreach(limit = 25) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('investor_outreach_messages')
    .select('*, investor_profiles(*)')
    .eq('status', 'approved')
    .eq('channel', 'email')
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw error
  return data || []
}

export async function updateInvestorOutreachMessage(id: string, updates: Record<string, unknown>) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('investor_outreach_messages')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function insertInvestorEngagementEvent(input: {
  investorId: string
  outreachMessageId?: string | null
  eventType: string
  eventValue?: string | null
  eventAmount?: number | null
  metadata?: Record<string, unknown>
}) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('investor_engagement_events')
    .insert({
      investor_profile_id: input.investorId,
      outreach_message_id: input.outreachMessageId || null,
      event_type: input.eventType,
      event_value: input.eventValue || null,
      event_amount: input.eventAmount ?? null,
      metadata_json: input.metadata || {},
    })
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function startInvestorAutomationRun(input: {
  runType: string
  sourceKey?: string | null
  requestParams?: Record<string, unknown>
}) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('investor_automation_runs')
    .insert({
      run_type: input.runType,
      source_key: input.sourceKey || null,
      request_params: input.requestParams || {},
      status: 'running',
    })
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function finishInvestorAutomationRun(
  id: string,
  updates: { status: 'completed' | 'failed'; resultCount?: number; errorMessage?: string | null }
) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('investor_automation_runs')
    .update({
      status: updates.status,
      result_count: updates.resultCount ?? 0,
      error_message: updates.errorMessage || null,
      finished_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function runInvestorFollowUpAgent(input: {
  investorId: string
  inboundMessage: string
  actorUserId?: string | null
}) {
  const admin = createAdminClient()
  const tasks = inferFollowUpTasks(input.inboundMessage)
  const { data: currentInvestor, error: investorError } = await admin
    .from('investor_profiles')
    .select('*')
    .eq('id', input.investorId)
    .single()
  if (investorError) throw investorError
  const summary = `AI follow-up routed ${tasks.map((task) => task.assignedTeam).join(', ')} tasking from reply: ${input.inboundMessage.slice(0, 240)}`

  const { error: eventError } = await admin.from('investor_engagement_events').insert({
    investor_profile_id: input.investorId,
    event_type: 'reply',
    event_value: input.inboundMessage,
    metadata_json: { actorUserId: input.actorUserId || null, routedTasks: tasks.map((task) => task.taskType) },
  })
  if (eventError) throw eventError

  const { error: taskError } = await admin.from('investor_follow_up_tasks').insert(
    tasks.map((task) => ({
      investor_profile_id: input.investorId,
      task_type: task.taskType,
      assigned_team: task.assignedTeam,
      prompt: task.prompt,
      due_at: new Date(Date.now() + 2 * 86400000).toISOString(),
      metadata_json: { inboundMessage: input.inboundMessage },
    }))
  )
  if (taskError) throw taskError

  const opportunityRows = tasks.map((task) => {
    const opportunityType =
      task.taskType === 'collect_lending_requirements'
        ? 'lending_opportunity'
        : task.taskType === 'collect_disposition_requirements'
          ? 'disposition_request'
          : task.taskType === 'assignment_contract_prep'
            ? 'revenue_opportunity'
            : task.taskType === 'collect_builder_buy_box'
              ? 'active_buyer'
          : task.taskType === 'collect_buy_box'
            ? 'active_buyer'
            : 'partnership_opportunity'

    return {
      investor_profile_id: input.investorId,
      opportunity_type: opportunityType,
      title: task.prompt,
      status: 'open',
      priority: task.taskType === 'collect_lending_requirements' ? 'high' : 'medium',
      route_to_team: task.assignedTeam,
      details_json: { inboundMessage: input.inboundMessage },
    }
  })

  const { error: opportunityError } = await admin.from('investor_opportunities').insert(opportunityRows)
  if (opportunityError) throw opportunityError

  const { data, error } = await admin
    .from('investor_profiles')
    .update({
      outreach_status: 'responded',
      relationship_stage: 'followup_due',
      ai_follow_up_summary: summary,
      next_follow_up_at: new Date(Date.now() + 86400000).toISOString(),
      metadata_json: buildInvestorPipelineMetadata(
        {
          relationshipStage: 'followup_due',
          outreachStatus: 'responded',
          contactEmail: currentInvestor.contact_email,
          contactPhone: currentInvestor.contact_phone,
          website: currentInvestor.website,
          markets: currentInvestor.markets,
          propertyTypes: currentInvestor.property_types,
          classificationTags: currentInvestor.classification_tags,
          estimatedBuyBox: currentInvestor.estimated_buy_box,
          metadata: {
            ...(currentInvestor.metadata_json || {}),
            ...(tasks.some((task) => ['collect_buy_box', 'collect_builder_buy_box'].includes(task.taskType))
              ? { lastCriteriaReplyAt: new Date().toISOString() }
              : {}),
          },
          sourceConfidenceScore: currentInvestor.source_confidence_score,
          sourceNames: currentInvestor.source_names,
          displayName: currentInvestor.display_name,
          primaryInvestorType: currentInvestor.primary_investor_type,
          notes: currentInvestor.notes,
        },
        { lastReplyAt: new Date().toISOString() }
      ),
    })
    .eq('id', input.investorId)
    .select('*')
    .single()

  if (error) throw error
  return { investor: data as InvestorProfileRecord, tasksCreated: tasks.length, summary }
}
