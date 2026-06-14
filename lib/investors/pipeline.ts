import { isBuilderPartnerLike } from '@/lib/investors/builderStrategy'
import { phaseOneMarkets, type InvestorBuyBox, type InvestorProfileRecord } from '@/lib/investors/types'

export const partnerPipelineStages = [
  'discovered',
  'researched',
  'buy_box_inferred',
  'outreach_ready',
  'contacted',
  'replied',
  'buy_box_confirmed',
] as const

export type PartnerPipelineStage = (typeof partnerPipelineStages)[number]

export type InvestorPipelineSnapshot = {
  stage: PartnerPipelineStage
  stageLabel: string
  builderLane: boolean
  dealMachineAligned: boolean
  researchReady: boolean
  outreachReady: boolean
  buyBoxInferred: boolean
  buyBoxConfirmed: boolean
  contactQuality: 'missing' | 'usable' | 'strong'
  sourceConfidence: number
  sourceEvidenceCount: number
  researchChecklistRecommended: boolean
  blockedReasons: string[]
  nextAction: string
}

type PipelineInput = {
  relationshipStage?: string | null
  outreachStatus?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  website?: string | null
  markets?: string[] | null
  propertyTypes?: string[] | null
  classificationTags?: string[] | null
  estimatedBuyBox?: InvestorBuyBox | null
  metadata?: Record<string, unknown> | null
  sourceConfidenceScore?: number | null
  sourceNames?: string[] | null
  sourceEvidenceCount?: number | null
  displayName?: string | null
  primaryInvestorType?: string | null
  notes?: string | null
}

const PHASE_ONE_MARKETS = new Set<string>(phaseOneMarkets)

function lower(value?: string | null) {
  return String(value || '').trim().toLowerCase()
}

function cleanArray(values?: string[] | null) {
  return (values || []).map((value) => String(value || '').trim()).filter(Boolean)
}

function hasBuyBoxShape(buyBox?: InvestorBuyBox | null) {
  if (!buyBox) return false
  const cities = cleanArray(buyBox.cities)
  const states = cleanArray(buyBox.states)
  const propertyTypes = cleanArray(buyBox.propertyTypes)
  const dealTypes = cleanArray(buyBox.dealTypes)
  return cities.length > 0 || states.length > 0 || propertyTypes.length > 0 || dealTypes.length > 0
}

function contactQuality(input: PipelineInput): InvestorPipelineSnapshot['contactQuality'] {
  const email = lower(input.contactEmail)
  const phone = String(input.contactPhone || '').trim()
  const website = lower(input.website)

  if (email && phone) return 'strong'
  if (email || phone || website) return 'usable'
  return 'missing'
}

function readMetadataBoolean(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key]
  return value === true
}

function readMetadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key]
  return typeof value === 'string' ? value : null
}

function readPartnerPipelineStage(metadata: Record<string, unknown> | null | undefined) {
  const stage = metadata?.partnerPipeline
  if (!stage || typeof stage !== 'object') return null
  const value = typeof (stage as Record<string, unknown>).stage === 'string' ? String((stage as Record<string, unknown>).stage) : null
  return value && (partnerPipelineStages as readonly string[]).includes(value) ? (value as PartnerPipelineStage) : null
}

function inferBaseStage(input: PipelineInput) {
  const relationshipStage = lower(input.relationshipStage)
  if (['qualified', 'active_buyer', 'active_borrower', 'active_partner', 'revenue_opportunity'].includes(relationshipStage)) {
    return 'buy_box_confirmed' as const
  }
  if (['responded', 'followup_due'].includes(relationshipStage) || lower(input.outreachStatus) === 'responded') {
    return 'replied' as const
  }
  if (relationshipStage === 'contacted' || ['sent', 'followup_due'].includes(lower(input.outreachStatus))) {
    return 'contacted' as const
  }
  if (relationshipStage === 'outreach_ready') {
    return 'outreach_ready' as const
  }
  if (relationshipStage === 'researched') {
    return 'researched' as const
  }
  return 'discovered' as const
}

export function buildInvestorPipelineSnapshot(input: PipelineInput): InvestorPipelineSnapshot {
  const markets = cleanArray(input.markets)
  const propertyTypes = cleanArray(input.propertyTypes)
  const tags = cleanArray(input.classificationTags)
  const buyBox = input.estimatedBuyBox || null
  const sourceEvidenceCount =
    Number.isFinite(Number(input.sourceEvidenceCount)) && Number(input.sourceEvidenceCount) > 0
      ? Number(input.sourceEvidenceCount)
      : Array.isArray(input.sourceNames)
        ? cleanArray(input.sourceNames).length
        : 0
  const sourceConfidence = Math.max(0, Math.min(100, Math.round(Number(input.sourceConfidenceScore || 0))))
  const quality = contactQuality(input)
  const builderLane = isBuilderPartnerLike({
    displayName: input.displayName,
    primaryInvestorType: input.primaryInvestorType,
    classificationTags: tags,
    notes: input.notes,
    metadata: input.metadata,
  })
  const buyBoxInferred =
    hasBuyBoxShape(buyBox) ||
    (markets.length > 0 && propertyTypes.length > 0) ||
    builderLane ||
    tags.some((tag) => ['builder_partner', 'developer_partner', 'construction_company', 'ground_up_builder', 'land_or_teardown_buyer'].includes(tag))
  const buyBoxConfirmed =
    readMetadataBoolean(input.metadata, 'buyBoxConfirmed') ||
    Boolean(readMetadataString(input.metadata, 'buyBoxConfirmedAt')) ||
    Boolean(readMetadataString(input.metadata, 'buyBoxNotes')) ||
    ['qualified', 'active_buyer', 'active_borrower', 'active_partner', 'revenue_opportunity'].includes(lower(input.relationshipStage))
  const researchReady =
    quality !== 'missing' &&
    (markets.length > 0 || propertyTypes.length > 0 || buyBoxInferred) &&
    (sourceConfidence >= 45 || sourceEvidenceCount > 0)
  const outreachReady = researchReady && sourceConfidence >= 55 && (buyBoxInferred || buyBoxConfirmed)
  const dealMachineAligned = markets.some((market) => PHASE_ONE_MARKETS.has(market))

  const blockedReasons: string[] = []
  if (quality === 'missing') blockedReasons.push('no usable contact path')
  if (!(markets.length > 0 || propertyTypes.length > 0 || buyBoxInferred)) blockedReasons.push('criteria still too thin')
  if (sourceConfidence < 55 && sourceEvidenceCount === 0) blockedReasons.push('source confidence is still light')

  let stage = readPartnerPipelineStage(input.metadata) || inferBaseStage(input)
  if (buyBoxConfirmed) {
    stage = 'buy_box_confirmed'
  } else if (stage === 'discovered' && researchReady) {
    stage = buyBoxInferred ? 'buy_box_inferred' : 'researched'
  } else if (stage === 'researched' && buyBoxInferred) {
    stage = 'buy_box_inferred'
  } else if (['discovered', 'researched', 'buy_box_inferred'].includes(stage) && outreachReady) {
    stage = 'outreach_ready'
  }

  const stageLabel = stage.replaceAll('_', ' ')
  const nextAction =
    stage === 'buy_box_confirmed'
      ? 'Route matched opportunities and keep criteria fresh.'
      : stage === 'replied'
        ? 'Work the reply and capture the missing buy box or funding criteria.'
        : stage === 'contacted'
          ? 'Follow up for criteria, proof of funds, or builder rules.'
          : stage === 'outreach_ready'
            ? 'Draft or approve outreach using the current criteria summary.'
            : stage === 'buy_box_inferred'
              ? 'Create or review the research checklist, then confirm the inferred criteria by outreach.'
              : researchReady
                ? 'Move this record into research review and confirm criteria before sending.'
                : 'Enrich the partner record before any outreach is drafted.'

  return {
    stage,
    stageLabel,
    builderLane,
    dealMachineAligned,
    researchReady,
    outreachReady,
    buyBoxInferred,
    buyBoxConfirmed,
    contactQuality: quality,
    sourceConfidence,
    sourceEvidenceCount,
    researchChecklistRecommended: researchReady && !buyBoxConfirmed,
    blockedReasons,
    nextAction,
  }
}

export function buildInvestorPipelineMetadata(
  input: PipelineInput,
  extras: Record<string, unknown> = {}
): Record<string, unknown> {
  const snapshot = buildInvestorPipelineSnapshot(input)
  return {
    ...(input.metadata || {}),
    partnerPipeline: {
      stage: snapshot.stage,
      builderLane: snapshot.builderLane,
      dealMachineAligned: snapshot.dealMachineAligned,
      researchReady: snapshot.researchReady,
      outreachReady: snapshot.outreachReady,
      buyBoxInferred: snapshot.buyBoxInferred,
      buyBoxConfirmed: snapshot.buyBoxConfirmed,
      contactQuality: snapshot.contactQuality,
      sourceConfidence: snapshot.sourceConfidence,
      sourceEvidenceCount: snapshot.sourceEvidenceCount,
      blockedReasons: snapshot.blockedReasons,
      nextAction: snapshot.nextAction,
      updatedAt: new Date().toISOString(),
    },
    ...extras,
  }
}

export function buildInvestorPipelineSnapshotFromRecord(investor: InvestorProfileRecord) {
  const metadata = (investor.metadata_json || {}) as Record<string, unknown>
  const partnerPipeline = metadata.partnerPipeline
  const sourceEvidenceCount =
    partnerPipeline && typeof partnerPipeline === 'object' && Number.isFinite(Number((partnerPipeline as Record<string, unknown>).sourceEvidenceCount))
      ? Number((partnerPipeline as Record<string, unknown>).sourceEvidenceCount)
      : undefined

  return buildInvestorPipelineSnapshot({
    relationshipStage: investor.relationship_stage,
    outreachStatus: investor.outreach_status,
    contactEmail: investor.contact_email,
    contactPhone: investor.contact_phone,
    website: investor.website,
    markets: investor.markets,
    propertyTypes: investor.property_types,
    classificationTags: investor.classification_tags,
    estimatedBuyBox: investor.estimated_buy_box,
    metadata,
    sourceConfidenceScore: investor.source_confidence_score,
    sourceNames: investor.source_names,
    sourceEvidenceCount,
    displayName: investor.display_name,
    primaryInvestorType: investor.primary_investor_type,
    notes: investor.notes,
  })
}
