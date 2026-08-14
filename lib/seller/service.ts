import type { User } from '@supabase/supabase-js'
import { adminTaskDueDates, createAdminTask } from '@/lib/admin/tasks'
import type { SellerCaseInput } from '@/lib/seller/schemas'
import { assessSellerCompleteness } from '@/lib/seller/readiness'
import type { SellerCaseRecord, SellerCaseStatus } from '@/lib/seller/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { logEvent } from '@/lib/system/logEvent'

type NormalizedSellerInput = SellerCaseInput & { email: string }

export async function recordSellerCaseEvent(input: {
  caseId: string
  actorUserId?: string | null
  eventType: string
  fromStatus?: SellerCaseStatus | null
  toStatus?: SellerCaseStatus | null
  note?: string | null
  metadata?: Record<string, unknown>
}) {
  const admin = createAdminClient()
  const { error } = await admin.from('seller_case_events').insert({
    seller_case_id: input.caseId,
    actor_user_id: input.actorUserId || null,
    event_type: input.eventType,
    from_status: input.fromStatus || null,
    to_status: input.toStatus || null,
    note: input.note || null,
    metadata_json: input.metadata || {},
  })
  if (error) throw error
}

export function sellerCasePayload(input: NormalizedSellerInput) {
  const completeness = assessSellerCompleteness(input)
  return {
    completeness,
    payload: {
      seller_name: input.sellerName,
      email: input.email,
      phone: input.phone,
      property_address: input.propertyAddress,
      city: input.city,
      state: input.state,
      postal_code: input.postalCode,
      property_type: input.propertyType,
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      property_condition: input.propertyCondition,
      occupancy_status: input.occupancyStatus,
      timeline_to_sell: input.timelineToSell,
      reason_for_selling: input.reasonForSelling,
      preferred_sale_path: input.preferredSalePath,
      estimated_value: input.estimatedValue,
      asking_price: input.askingPrice,
      mortgage_balance: input.mortgageBalance,
      liens_or_taxes: input.liensOrTaxes,
      best_time_to_contact: input.bestTimeToContact,
      communication_preference: input.communicationPreference,
      analysis_consent: input.analysisConsent,
      contact_consent: input.contactConsent,
      marketing_consent: input.marketingConsent,
      seller_notes: input.sellerNotes,
      source_path: input.sourcePath,
      source: 'seller_case',
      attribution: input.attribution,
      completeness_score: completeness.score,
      completeness_gaps: completeness.gaps,
    },
  }
}

async function ensureSellerLead(caseRecord: SellerCaseRecord, input: NormalizedSellerInput) {
  const admin = createAdminClient()
  const externalId = `seller-case:${caseRecord.id}`
  const leadPayload = {
    lead_type: 'sell_house',
    status: 'new',
    source: 'seller_case',
    source_url: caseRecord.source_path,
    external_id: externalId,
    category: 'seller_lead',
    name: input.sellerName,
    email: input.email,
    phone: input.phone,
    property_address: input.propertyAddress,
    city: input.city,
    state: input.state,
    best_offer: 'Property sale-path review',
    pain_signal: `${input.reasonForSelling}; timeline ${input.timelineToSell}.`,
    contact_info: {
      name: input.sellerName,
      email: input.email,
      phone: input.phone,
      communicationPreference: input.communicationPreference,
      bestTimeToContact: input.bestTimeToContact,
      contactConsent: input.contactConsent,
      marketingConsent: input.marketingConsent,
    },
    form_data: {
      sellerCaseId: caseRecord.id,
      propertyType: input.propertyType,
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      propertyCondition: input.propertyCondition,
      occupancyStatus: input.occupancyStatus,
      timelineToSell: input.timelineToSell,
      reasonForSelling: input.reasonForSelling,
      preferredSalePath: input.preferredSalePath,
      estimatedValue: input.estimatedValue,
      askingPrice: input.askingPrice,
      mortgageBalance: input.mortgageBalance,
      liensOrTaxes: input.liensOrTaxes,
      sellerNotes: input.sellerNotes,
      analysisConsent: input.analysisConsent,
      contactConsent: input.contactConsent,
      marketingConsent: input.marketingConsent,
      attribution: input.attribution,
      completenessScore: caseRecord.completeness_score,
    },
    metadata_json: {
      sellerCaseId: caseRecord.id,
      customerRequestedReview: true,
      automatedMatchingAuthorized: false,
      automatedOutreachAuthorized: false,
    },
    market_segment: 'seller_lead',
    outreach_angle: 'Customer-requested property review',
    outreach_status: 'needs_review',
    owner_user_id: caseRecord.user_id,
    notes: input.sellerNotes || `${input.propertyAddress}; seller objective: ${input.reasonForSelling}.`,
  }
  const { data: existing, error: lookupError } = await admin
    .from('leads')
    .select('id')
    .eq('source', 'seller_case')
    .eq('external_id', externalId)
    .maybeSingle()
  if (lookupError) throw lookupError
  const result = existing?.id
    ? await admin.from('leads').update(leadPayload).eq('id', existing.id).select('id').single()
    : await admin.from('leads').insert(leadPayload).select('id').single()
  if (result.error || !result.data?.id) throw result.error || new Error('Seller CRM record was not created.')
  return result.data.id as string
}

export async function routeSubmittedSellerCase(caseRecord: SellerCaseRecord, input: NormalizedSellerInput, actor: User | null) {
  const admin = createAdminClient()
  const leadId = await ensureSellerLead(caseRecord, input)
  const task = await createAdminTask({
    title: `Review seller case: ${input.propertyAddress}`,
    description: [
      `${input.sellerName} requested a property sale-path review for ${input.propertyAddress}, ${input.city}, ${input.state}.`,
      `Timeline: ${input.timelineToSell}. Seller objective: ${input.reasonForSelling}.`,
      'Verify the submitted facts, request missing information when necessary, and do not promise an offer, price, buyer, financing, closing date, or sale outcome.',
    ].join('\n\n'),
    taskType: 'seller_case_review',
    priority: input.timelineToSell.toLowerCase().includes('asap') ? 'high' : 'normal',
    userId: caseRecord.user_id,
    userEmail: input.email,
    entityType: 'seller_case',
    entityId: caseRecord.id,
    dueAt: adminTaskDueDates.days(1),
    metadata: {
      sellerCaseId: caseRecord.id,
      leadId,
      nextAction: 'Review the seller case, assign an owner, and record the next status.',
    },
  })
  if (!task.ok || !task.task?.id) throw new Error(task.error || 'Seller operator task was not created.')
  const { data, error } = await admin.from('seller_cases').update({
    lead_id: leadId,
    operator_task_id: task.task.id,
  }).eq('id', caseRecord.id).select('*').single()
  if (error) throw error
  await logEvent({
    eventType: 'seller_case_submitted',
    actorUserId: actor?.id || caseRecord.user_id,
    entityType: 'seller_case',
    entityId: caseRecord.id,
    metadata: { leadId, taskId: task.task.id, sourcePath: caseRecord.source_path },
  })
  return data as SellerCaseRecord
}
